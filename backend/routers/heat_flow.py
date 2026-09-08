"""Heat flow prediction router.

Implements Task 3 of the SIH 26051 problem statement:
'Heat flow details as per the temperature difference between ambient
and shelter temperature for a defined time period' coupled with
parametric geometry calculation for 3D visualization.
"""

import logging
import math
from typing import Dict, List, Tuple
from fastapi import APIRouter, HTTPException
import numpy as np
import pandas as pd

try:
    from schemas.heat_flow import (
        HeatFlowRequest,
        HeatFlowResponse,
        ShelterGeometry,
        EnvelopeUValues,
        HourlyHeatFlowPoint,
        HeatFlowSummary,
    )
    from services import model_loader, solar, climate
    from services.envelope_physics import (
        calculate_envelope_heat_loss_w,
        calculate_u_values as shared_calculate_u_values,
        MATERIAL_THERMAL_MASS,
    )
except ImportError:
    from backend.schemas.heat_flow import (
        HeatFlowRequest,
        HeatFlowResponse,
        ShelterGeometry,
        EnvelopeUValues,
        HourlyHeatFlowPoint,
        HeatFlowSummary,
    )
    from backend.services import model_loader, solar, climate
    from backend.services.envelope_physics import (
        calculate_envelope_heat_loss_w,
        calculate_u_values as shared_calculate_u_values,
        MATERIAL_THERMAL_MASS,
    )

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Heat Flow & 3D Visualization"])


def solve_shelter_geometry(volume_m3: float, glazing_ratio: float) -> ShelterGeometry:
    """Solve parametric gable-roof rectangular geometry matching 3D visual 1-to-1.

    Assumptions:
      - Length L = 1.5 * Width W
      - Wall height H_wall = 2.6 m
      - Gable roof pitch theta = 30° -> roof height h_roof = (W / 2) * tan(30°) = 0.288675 * W
      - Roof gable triangle area = 0.5 * W * h_roof = 0.1443376 * W^2
      - Roof prism volume = 0.1443376 * W^2 * (1.5 * W) = 0.21650635 * W^3
      - Box volume = W * L * H_wall = 1.5 * W^2 * 2.6 = 3.9 * W^2
      - Total volume V = 3.9 * W^2 + 0.21650635 * W^3
    """
    v = max(10.0, volume_m3)
    # Solve 0.21650635 * W^3 + 3.9 * W^2 - V = 0 using Newton-Raphson
    w = (v / 3.9) ** 0.5
    for _ in range(20):
        f = 0.21650635 * (w ** 3) + 3.9 * (w ** 2) - v
        f_prime = 3.0 * 0.21650635 * (w ** 2) + 7.8 * w
        diff = f / f_prime
        w -= diff
        if abs(diff) < 1e-6:
            break

    width = round(w, 3)
    length = round(1.5 * width, 3)
    wall_height = 2.6
    roof_height = round(0.28867513 * width, 3)

    # Gross vertical wall area:
    # 2 longitudinal walls (L * H_wall) + 2 gable ends (W * H_wall + 0.5 * W * h_roof)
    wall_gross = 2.0 * (length + width) * wall_height + width * roof_height

    # South window glazing area:
    # South wall is length * wall_height
    south_facade_area = length * wall_height
    glazing_area = round(glazing_ratio * south_facade_area, 3)

    # Standard entrance door (0.9m x 2.0m = 1.8 m2)
    door_area = 1.8
    wall_net = max(1.0, wall_gross - glazing_area - door_area)

    # Gable roof area: 2 pitches sloped at 30°
    # Slope length = (width / 2) / cos(30°)
    cos_30 = math.cos(math.radians(30.0))
    roof_area = round((width * length) / cos_30, 3)
    floor_area = round(width * length, 3)

    return ShelterGeometry(
        volume_m3=round(v, 2),
        width_m=width,
        length_m=length,
        wall_height_m=wall_height,
        roof_height_m=roof_height,
        wall_area_gross_m2=round(wall_gross, 2),
        glazing_area_m2=round(glazing_area, 2),
        door_area_m2=door_area,
        wall_area_net_m2=round(wall_net, 2),
        roof_area_m2=round(roof_area, 2),
        floor_area_m2=round(floor_area, 2),
    )


def calculate_u_values(
    wall_material: str,
    wall_thickness_cm: float,
    insulation_r_value: float,
) -> EnvelopeUValues:
    """Calculate thermal transmittance U (W/m2·K) for walls, glazing, roof, and floor."""
    shared = shared_calculate_u_values(wall_material, wall_thickness_cm, insulation_r_value)
    return EnvelopeUValues(**shared.__dict__)


def _get_indoor_material_label(wall_material: str, le_classes: list) -> str:
    """Map user-friendly material to the indoor_temp ML model's label encoded classes."""
    mat_lower = wall_material.strip().lower()
    if "stone" in mat_lower:
        # Match masonry / stone / adobe with high thermal mass
        candidates = [c for c in le_classes if "adobe" in c.lower() or "direct solar-gain" in c.lower()]
        return candidates[0] if candidates else le_classes[0]
    elif "rammed" in mat_lower:
        candidates = [c for c in le_classes if "rammed earth" in c.lower()]
        return candidates[0] if candidates else le_classes[0]
    elif "brick" in mat_lower or "mud" in mat_lower:
        candidates = [c for c in le_classes if "sun-dried" in c.lower() or "adobe" in c.lower()]
        return candidates[0] if candidates else le_classes[0]
    elif "concrete" in mat_lower:
        candidates = [c for c in le_classes if "super-insulated" in c.lower()]
        return candidates[0] if candidates else le_classes[-1]
    return le_classes[0]


@router.get("/predict/heat-flow", tags=["Heat Flow & 3D Visualization"])
def get_heat_flow_info():
    """Info endpoint for heat flow prediction."""
    return {"message": "Building envelope heat flow & 3D solar tracker — POST /predict/heat-flow"}


@router.post("/predict/heat-flow", response_model=HeatFlowResponse)
def predict_heat_flow(payload: HeatFlowRequest):
    """Predict 24-hour building envelope heat flow details based on temperature differences."""
    lat = payload.latitude
    lon = payload.longitude
    alt = payload.elevation_m if payload.elevation_m is not None else solar.get_altitude(lat, lon)

    # 1. Solve geometry & U-values
    geometry = solve_shelter_geometry(payload.volume_m3, payload.glazing_ratio)
    u_values = calculate_u_values(payload.wall_material, payload.wall_thickness_cm, payload.insulation_r_value)

    # 2. PVLib 24-hour solar calculations
    # Reference year 2024 to avoid leap year edge cases
    day = min(payload.day, 28 if payload.month == 2 else 30)
    times = pd.date_range(
        start=f"2024-{payload.month:02d}-{day:02d} 00:00",
        periods=24,
        freq="1h",
        tz="Asia/Kolkata",
    )

    clearsky = solar.get_clearsky_irradiance(lat, lon, alt, times)
    solar_pos = solar.get_solar_position(lat, lon, alt, times)

    # 3. Ambient temperature profile across 24h
    mean_temp = payload.ambient_temp_c
    if mean_temp is None:
        try:
            clim = climate.get_climate(lat, lon)
            mean_temp = clim.ambient_temp_c
        except Exception as exc:
            logger.warning("Climate lookup failed for heat flow, using Leh winter default: %s", exc)
            mean_temp = -6.0

    # Diurnal variation: peak around 14:00, trough around 06:00
    hourly_ambient = [
        round(mean_temp + 5.0 * math.sin((h - 8) * math.pi / 12.0), 2)
        for h in range(24)
    ]

    # 4. Predict indoor temperature for all 24 hours
    wind_spd = payload.wind_speed_mps if payload.wind_speed_mps is not None else 2.5
    thermal_mass = next(
        (value for name, value in MATERIAL_THERMAL_MASS.items()
         if name.lower() == payload.wall_material.strip().lower()),
        2.0,
    )

    indoor_temps = []
    ml_used = False

    # Attempt trained indoor_temp ML model
    try:
        model = model_loader.get_model("indoor_temp")
        scaler = model_loader.get_scaler("indoor_temp")
        le = model_loader.get_label_encoder("indoor_temp", "le_file")
        features = model_loader.get_features("indoor_temp")

        if model is not None and scaler is not None and le is not None and features:
            label_str = _get_indoor_material_label(payload.wall_material, list(le.classes_))
            mat_encoded = le.transform([label_str])[0]

            rows = []
            for h in range(24):
                ghi_val = float(clearsky["ghi"].iloc[h])
                rows.append({
                    "latitude": lat,
                    "longitude": lon,
                    "month": payload.month,
                    "hour": h,
                    "outdoor_temperature_C": hourly_ambient[h],
                    "wind_speed_mps": wind_spd,
                    "thermal_mass_MJ_m3K": thermal_mass,
                    "insulation_r_value_m2K_W": payload.insulation_r_value,
                    "glazing": payload.glazing_ratio,
                    "GHI_W_m2": ghi_val,
                    "best_shelter_material": mat_encoded,
                })

            batch_df = pd.DataFrame(rows, columns=features)
            batch_df["outdoor_temperature_C"] = scaler.transform(batch_df[["outdoor_temperature_C"]])
            predictions = model.predict(batch_df)

            # Add internal gain from occupants & active heater
            occupant_delta = payload.occupancy * 0.25
            heater_delta = payload.heater_power_kw * 2.0

            for h in range(24):
                pred_temp = float(predictions[h]) + occupant_delta + heater_delta
                indoor_temps.append(round(pred_temp, 2))
            ml_used = True
    except Exception as exc:
        logger.warning("ML indoor temp prediction failed, using physics model: %s", exc)

    # Physics fallback if ML not available
    if not ml_used:
        for h in range(24):
            ghi_val = float(clearsky["ghi"].iloc[h])
            solar_passive_lift = (ghi_val * payload.glazing_ratio * 0.015)
            insulation_lift = max(0.0, payload.insulation_r_value * 1.8)
            occupant_lift = payload.occupancy * 0.3
            heater_lift = payload.heater_power_kw * 2.5
            # Buffer against outdoor cold
            pred_temp = (
                hourly_ambient[h]
                + 12.0
                + insulation_lift
                + solar_passive_lift
                + occupant_lift
                + heater_lift
            )
            indoor_temps.append(round(pred_temp, 2))

    # 5. Compute Hourly Heat Flow (Q = U * A * Delta_T)
    hourly_points: List[HourlyHeatFlowPoint] = []
    total_q_loss_wh = 0.0
    total_solar_gain_wh = 0.0

    for h in range(24):
        elev = float(solar_pos["elevation"].iloc[h])
        azimuth = float(solar_pos["azimuth"].iloc[h])
        is_sun_up = elev > 0.0
        ghi = round(float(clearsky["ghi"].iloc[h]), 1)

        t_out = hourly_ambient[h]
        t_in = indoor_temps[h]
        delta_t = t_in - t_out

        if delta_t >= 0:
            direction = "loss"
            eff_dt = delta_t
        else:
            direction = "gain"
            eff_dt = abs(delta_t)

        heat_loss = calculate_envelope_heat_loss_w(
            u_values, geometry.wall_area_net_m2, geometry.glazing_area_m2,
            geometry.roof_area_m2, geometry.floor_area_m2, t_in, t_out,
        )
        q_walls = heat_loss["walls"]
        q_glazing = heat_loss["glazing"]
        q_roof = heat_loss["roof"]
        q_floor = heat_loss["floor"]
        q_total = heat_loss["total"]

        if direction == "loss":
            total_q_loss_wh += q_total

        # Solar heat gain entering through glazing (Watts)
        # SHGC approx 0.65 for double glazing
        if is_sun_up and ghi > 0:
            solar_gain_w = ghi * geometry.glazing_area_m2 * 0.65
            total_solar_gain_wh += solar_gain_w

        hourly_points.append(
            HourlyHeatFlowPoint(
                hour=h,
                sun_elevation_deg=round(elev, 2),
                sun_azimuth_deg=round(azimuth, 2),
                is_sun_up=is_sun_up,
                ghi_w_m2=ghi,
                ambient_temp_c=t_out,
                indoor_temp_c=t_in,
                delta_t_k=round(abs(delta_t), 2),
                q_walls_w=q_walls,
                q_glazing_w=q_glazing,
                q_roof_w=q_roof,
                q_floor_w=q_floor,
                q_total_w=q_total,
                heat_flow_direction=direction,
            )
        )

    # 6. Summary metrics
    losses = [p.q_total_w for p in hourly_points if p.heat_flow_direction == "loss"]
    if not losses:
        losses = [p.q_total_w for p in hourly_points]

    max_loss_val = max(losses)
    min_loss_val = min(losses)
    peak_hour = next(p.hour for p in hourly_points if p.q_total_w == max_loss_val)
    min_hour = next(p.hour for p in hourly_points if p.q_total_w == min_loss_val)

    summary = HeatFlowSummary(
        peak_heat_loss_w=round(max_loss_val, 1),
        peak_heat_loss_hour=peak_hour,
        min_heat_loss_w=round(min_loss_val, 1),
        min_heat_loss_hour=min_hour,
        total_heat_loss_kwh=round(total_q_loss_wh / 1000.0, 2),
        total_solar_gain_kwh=round(total_solar_gain_wh / 1000.0, 2),
        average_indoor_temp_c=round(float(np.mean(indoor_temps)), 2),
        average_ambient_temp_c=round(float(np.mean(hourly_ambient)), 2),
    )

    return HeatFlowResponse(
        status="ok",
        indoor_temp_source="ml_model" if ml_used else "physics_fallback",
        location={"latitude": lat, "longitude": lon, "altitude_m": round(alt, 1)},
        geometry=geometry,
        u_values=u_values,
        hourly_data=hourly_points,
        summary=summary,
    )
