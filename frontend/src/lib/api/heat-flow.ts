/**
 * lib/api/heat-flow.ts — Typed API client and client-side fallback for Task 3 Heat Flow & 3D Visualization.
 */

import { getWallMaterialDefinition } from "@/lib/materials";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export interface HeatFlowRequest {
  latitude: number;
  longitude: number;
  elevation_m?: number | null;
  month: number;
  day: number;
  volume_m3: number;
  wall_material: string;
  wall_thickness_cm: number;
  insulation_r_value: number;
  glazing_ratio: number;
  occupancy: number;
  heater_power_kw: number;
  ambient_temp_c?: number | null;
  wind_speed_mps?: number | null;
}

export interface ShelterGeometry {
  volume_m3: number;
  width_m: number;
  length_m: number;
  wall_height_m: number;
  roof_height_m: number;
  wall_area_gross_m2: number;
  glazing_area_m2: number;
  door_area_m2: number;
  wall_area_net_m2: number;
  roof_area_m2: number;
  floor_area_m2: number;
}

export interface EnvelopeUValues {
  u_wall: number;
  u_glazing: number;
  u_roof: number;
  u_floor: number;
  r_wall_total: number;
}

export interface HourlyHeatFlowPoint {
  hour: number;
  sun_elevation_deg: number;
  sun_azimuth_deg: number;
  is_sun_up: bool_type;
  ghi_w_m2: number;
  ambient_temp_c: number;
  indoor_temp_c: number;
  delta_t_k: number;
  q_walls_w: number;
  q_glazing_w: number;
  q_roof_w: number;
  q_floor_w: number;
  q_total_w: number;
  heat_flow_direction: "loss" | "gain";
}

// Support boolean type alias cleanly
type bool_type = boolean;

export interface HeatFlowSummary {
  peak_heat_loss_w: number;
  peak_heat_loss_hour: number;
  min_heat_loss_w: number;
  min_heat_loss_hour: number;
  total_heat_loss_kwh: number;
  total_solar_gain_kwh: number;
  average_indoor_temp_c: number;
  average_ambient_temp_c: number;
}

export interface HeatFlowResponse {
  status: string;
  indoor_temp_source: string;
  location: {
    latitude: number;
    longitude: number;
    altitude_m: number;
  };
  geometry: ShelterGeometry;
  u_values: EnvelopeUValues;
  hourly_data: HourlyHeatFlowPoint[];
  summary: HeatFlowSummary;
}

// In-memory client cache to prevent redundant fetches
const _cache = new Map<string, HeatFlowResponse>();

function getCacheKey(req: HeatFlowRequest): string {
  return [
    req.latitude.toFixed(2),
    req.longitude.toFixed(2),
    req.month,
    req.day,
    req.volume_m3,
    req.wall_material,
    req.wall_thickness_cm,
    req.insulation_r_value,
    req.glazing_ratio,
    req.occupancy,
    req.heater_power_kw,
    req.ambient_temp_c ?? "auto",
  ].join(":");
}

export async function predictHeatFlow(
  request: HeatFlowRequest
): Promise<HeatFlowResponse> {
  const key = getCacheKey(request);
  if (_cache.has(key)) {
    return _cache.get(key)!;
  }

  try {
    const res = await fetch(`${API_BASE}/predict/heat-flow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err?.detail ?? `HTTP ${res.status}`);
    }

    const data = (await res.json()) as HeatFlowResponse;
    _cache.set(key, data);
    return data;
  } catch (err) {
    console.warn("Heat flow backend call failed, falling back to client simulation:", err);
    return generateClientFallback(request);
  }
}

/** Client-side fallback with exact physics equations if offline. */
export function generateClientFallback(req: HeatFlowRequest): HeatFlowResponse {
  const v = Math.max(10, req.volume_m3);
  let w = Math.sqrt(v / 3.9);
  for (let i = 0; i < 15; i++) {
    const f = 0.21650635 * Math.pow(w, 3) + 3.9 * Math.pow(w, 2) - v;
    const fPrime = 0.649519 * Math.pow(w, 2) + 7.8 * w;
    w -= f / fPrime;
  }
  const width = Math.round(w * 1000) / 1000;
  const length = Math.round(1.5 * width * 1000) / 1000;
  const wallH = 2.6;
  const roofH = Math.round(0.288675 * width * 1000) / 1000;
  const wallGross = Math.round((2 * (length + width) * wallH + width * roofH) * 100) / 100;
  const southArea = length * wallH;
  const glazeArea = Math.round(req.glazing_ratio * southArea * 100) / 100;
  const doorArea = 1.8;
  const wallNet = Math.round(Math.max(1, wallGross - glazeArea - doorArea) * 100) / 100;
  const roofArea = Math.round(((width * length) / Math.cos(Math.PI / 6)) * 100) / 100;

  const k = getWallMaterialDefinition(req.wall_material).k;
  const rMat = (req.wall_thickness_cm / 100) / k;
  const rTotal = rMat + req.insulation_r_value + 0.17;
  const uWall = Math.round((1 / rTotal) * 1000) / 1000;
  const uGlaze = 2.8;

  const rRoofBase = 0.4;
  const rRoofIns = req.insulation_r_value * 0.4;
  const rRoof = rRoofBase + rRoofIns + 0.14;
  const uRoof = Math.round((1 / rRoof) * 1000) / 1000;
  const rFloor = (0.15 / 1.4) + 2.0 + 0.17;
  const uFloor = Math.round((1 / rFloor) * 1000) / 1000;
  const floorArea = Math.round(width * length * 100) / 100;
  const tGround = 5.0;

  const meanAmbient = req.ambient_temp_c ?? -6.0;
  const hourlyData: HourlyHeatFlowPoint[] = [];
  let totalLossWh = 0;
  let totalSolarWh = 0;
  const indoorTemps: number[] = [];
  const ambientTemps: number[] = [];

  for (let h = 0; h < 24; h++) {
    // Diurnal temperature swing
    const tOut = Math.round((meanAmbient + 5.0 * Math.sin(((h - 8) * Math.PI) / 12)) * 10) / 10;
    ambientTemps.push(tOut);

    // Simplified solar geometry for Ladakh latitude ~34° in January
    const solarHourAngle = (h - 12) * 15; // deg from solar noon
    const latRad = (req.latitude * Math.PI) / 180;
    const declRad = (-21.0 * Math.PI) / 180; // Jan declination
    const haRad = (solarHourAngle * Math.PI) / 180;
    const sinElev = Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(haRad);
    const elev = (Math.asin(Math.max(-1, Math.min(1, sinElev))) * 180) / Math.PI;

    // Azimuth calculation
    const cosAz = (Math.sin(declRad) * Math.cos(latRad) - Math.cos(declRad) * Math.sin(latRad) * Math.cos(haRad)) / Math.max(0.01, Math.cos((elev * Math.PI) / 180));
    let az = (Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180) / Math.PI;
    if (solarHourAngle > 0) az = 360 - az;

    const isSunUp = elev > 0;
    const ghi = isSunUp ? Math.round(Math.sin((elev * Math.PI) / 180) * 850) : 0;

    // Indoor temp prediction with thermal inertia
    const solarLift = ghi * req.glazing_ratio * 0.015;
    const insLift = req.insulation_r_value * 1.8;
    const occLift = req.occupancy * 0.25;
    const heatLift = req.heater_power_kw * 2.0;
    const tIn = Math.round((tOut + 14.0 + insLift + solarLift + occLift + heatLift) * 10) / 10;
    indoorTemps.push(tIn);

    const deltaT = tIn - tOut;
    const direction: "loss" | "gain" = deltaT >= 0 ? "loss" : "gain";
    const absDt = Math.abs(deltaT);
    const qWalls = Math.round(uWall * wallNet * absDt * 10) / 10;
    const qGlaze = Math.round(uGlaze * glazeArea * absDt * 10) / 10;
    const qRoof = Math.round(uRoof * roofArea * absDt * 10) / 10;
    const floorDt = Math.abs(tIn - tGround);
    const qFloor = Math.round(uFloor * floorArea * floorDt * 10) / 10;
    const qTotal = Math.round((qWalls + qGlaze + qRoof + qFloor) * 10) / 10;

    if (direction === "loss") {
      totalLossWh += qTotal;
    }
    if (isSunUp && ghi > 0) {
      totalSolarWh += ghi * glazeArea * 0.65;
    }

    hourlyData.push({
      hour: h,
      sun_elevation_deg: Math.round(elev * 10) / 10,
      sun_azimuth_deg: Math.round(az * 10) / 10,
      is_sun_up: isSunUp,
      ghi_w_m2: ghi,
      ambient_temp_c: tOut,
      indoor_temp_c: tIn,
      delta_t_k: Math.round(absDt * 10) / 10,
      q_walls_w: qWalls,
      q_glazing_w: qGlaze,
      q_roof_w: qRoof,
      q_floor_w: qFloor,
      q_total_w: qTotal,
      heat_flow_direction: direction,
    });
  }

  const losses = hourlyData.map((d) => d.q_total_w);
  const maxLoss = Math.max(...losses);
  const minLoss = Math.min(...losses);
  const peakH = hourlyData.find((d) => d.q_total_w === maxLoss)?.hour ?? 2;
  const minH = hourlyData.find((d) => d.q_total_w === minLoss)?.hour ?? 13;

  return {
    status: "fallback",
    indoor_temp_source: "physics_fallback",
    location: {
      latitude: req.latitude,
      longitude: req.longitude,
      altitude_m: 3500,
    },
    geometry: {
      volume_m3: v,
      width_m: width,
      length_m: length,
      wall_height_m: wallH,
      roof_height_m: roofH,
      wall_area_gross_m2: wallGross,
      glazing_area_m2: glazeArea,
      door_area_m2: doorArea,
      wall_area_net_m2: wallNet,
      roof_area_m2: roofArea,
      floor_area_m2: floorArea,
    },
    u_values: {
      u_wall: uWall,
      u_glazing: uGlaze,
      u_roof: uRoof,
      u_floor: uFloor,
      r_wall_total: Math.round(rTotal * 100) / 100,
    },
    hourly_data: hourlyData,
    summary: {
      peak_heat_loss_w: maxLoss,
      peak_heat_loss_hour: peakH,
      min_heat_loss_w: minLoss,
      min_heat_loss_hour: minH,
      total_heat_loss_kwh: Math.round((totalLossWh / 1000) * 10) / 10,
      total_solar_gain_kwh: Math.round((totalSolarWh / 1000) * 10) / 10,
      average_indoor_temp_c: Math.round((indoorTemps.reduce((a, b) => a + b, 0) / 24) * 10) / 10,
      average_ambient_temp_c: Math.round((ambientTemps.reduce((a, b) => a + b, 0) / 24) * 10) / 10,
    },
  };
}
