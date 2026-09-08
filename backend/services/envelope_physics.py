"""Shared building-envelope heat-loss calculations.

Keep the wall, glazing, roof, and ground-coupled floor terms here so the
interactive heat-flow endpoint and the optimization objective cannot drift.
"""

from dataclasses import dataclass


MATERIAL_CONDUCTIVITY = {
    "Concrete": 1.4,
    "Mud_Brick": 0.6,
    "Rammed_Earth": 0.9,
    "Stone": 1.8,
}

# Volumetric thermal heat capacity / thermal mass in MJ/(m³·K)
MATERIAL_THERMAL_MASS = {
    "Concrete": 2.0,
    "Mud_Brick": 1.6,
    "Rammed_Earth": 1.9,
    "Stone": 2.2,
}

# Source: UT Ladakh Public Works (R&B) LSoR 2024 (effective 2024-08-01),
# Ch. 32 vernacular materials and Ch. 5/7 conventional materials, cross-checked
# with CPWD Delhi Schedule of Rates 2023 where Ladakh-specific items are absent.
# Cost ranges and midpoints in ₹/m³:
MATERIAL_COST_RANGES_INR_PER_M3 = {
    "Concrete": {
        "min": 7500,
        "max": 9000,
        "midpoint": 8250,
        "range_str": "₹7,500 – ₹9,000/m³",
    },
    "Mud_Brick": {
        "min": 2500,
        "max": 3500,
        "midpoint": 3000,
        "range_str": "₹2,500 – ₹3,500/m³",
    },
    "Rammed_Earth": {
        "min": 1600,
        "max": 2400,
        "midpoint": 2000,
        "range_str": "₹1,600 – ₹2,400/m³",
    },
    "Stone": {
        "min": 4500,
        "max": 6000,
        "midpoint": 5250,
        "range_str": "₹4,500 – ₹6,000/m³",
    },
}

MATERIAL_COSTS_INR_PER_M3 = {
    mat: data["midpoint"] for mat, data in MATERIAL_COST_RANGES_INR_PER_M3.items()
}



@dataclass(frozen=True)
class EnvelopeUValues:
    u_wall: float
    u_glazing: float
    u_roof: float
    u_floor: float
    r_wall_total: float


def calculate_shelter_areas(volume_m3: float, glazing_ratio: float) -> dict[str, float]:
    """Return the same gable-shelter surface areas used by heat-flow."""
    v = max(10.0, volume_m3)
    width = (v / 3.9) ** 0.5
    for _ in range(20):
        f = 0.21650635 * width**3 + 3.9 * width**2 - v
        derivative = 3.0 * 0.21650635 * width**2 + 7.8 * width
        width -= f / derivative
    length = 1.5 * width
    roof_height = 0.28867513 * width
    wall_gross = 2.0 * (length + width) * 2.6 + width * roof_height
    glazing = glazing_ratio * length * 2.6
    return {
        "wall": max(1.0, wall_gross - glazing - 1.8),
        "glazing": glazing,
        "roof": (width * length) / 0.8660254038,
        "floor": width * length,
    }


def calculate_u_values(
    wall_material: str,
    wall_thickness_cm: float,
    insulation_r_value: float,
) -> EnvelopeUValues:
    """Return the validated Chapter 6.5 wall/roof/floor U-values."""
    canonical_name = next(
        (name for name in MATERIAL_CONDUCTIVITY if name.lower() == wall_material.strip().lower()),
        "Stone",
    )
    k = MATERIAL_CONDUCTIVITY[canonical_name]
    d_m = max(0.05, wall_thickness_cm / 100.0)

    r_mat = d_m / k
    r_total = r_mat + max(0.0, insulation_r_value) + 0.17
    u_wall = round(1.0 / r_total, 4)
    u_glazing = 2.80

    r_roof = 0.4 + max(0.0, insulation_r_value) * 0.4 + 0.14
    u_roof = round(1.0 / r_roof, 4)

    r_floor = (0.15 / 1.4) + 2.0 + 0.17
    u_floor = round(1.0 / r_floor, 4)
    return EnvelopeUValues(u_wall, u_glazing, u_roof, u_floor, round(r_total, 3))


def calculate_envelope_heat_loss_w(
    u_values: EnvelopeUValues,
    wall_area_m2: float,
    glazing_area_m2: float,
    roof_area_m2: float,
    floor_area_m2: float,
    indoor_temp_c: float,
    ambient_temp_c: float,
    ground_temp_c: float = 5.0,
) -> dict[str, float]:
    """Calculate all four envelope heat-loss terms in watts.

    The floor is coupled to approximately 5°C deep ground, while the other
    three terms use the indoor/ambient temperature difference.
    """
    envelope_dt = abs(indoor_temp_c - ambient_temp_c)
    q_walls = u_values.u_wall * wall_area_m2 * envelope_dt
    q_glazing = u_values.u_glazing * glazing_area_m2 * envelope_dt
    q_roof = u_values.u_roof * roof_area_m2 * envelope_dt
    q_floor = u_values.u_floor * floor_area_m2 * abs(indoor_temp_c - ground_temp_c)
    rounded = {
        "walls": round(q_walls, 1),
        "glazing": round(q_glazing, 1),
        "roof": round(q_roof, 1),
        "floor": round(q_floor, 1),
    }
    rounded["total"] = round(sum(rounded.values()), 1)
    return rounded
