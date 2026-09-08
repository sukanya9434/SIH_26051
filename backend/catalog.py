try:
    from services.envelope_physics import (
        MATERIAL_CONDUCTIVITY,
        MATERIAL_COSTS_INR_PER_M3,
        MATERIAL_COST_RANGES_INR_PER_M3,
    )
except ImportError:
    from backend.services.envelope_physics import (
        MATERIAL_CONDUCTIVITY,
        MATERIAL_COSTS_INR_PER_M3,
        MATERIAL_COST_RANGES_INR_PER_M3,
    )


MATERIALS = {
    mat: {
        "u_value": MATERIAL_CONDUCTIVITY[mat],
        "cost_per_m3_inr": MATERIAL_COSTS_INR_PER_M3[mat],
    }
    for mat in ("Concrete", "Mud_Brick", "Rammed_Earth", "Stone")
}
GLAZING = {
    "single": {"u_value": 5.6, "cost_per_m2_inr": 1800},
    "double": {"u_value": 2.8, "cost_per_m2_inr": 4300},
    "low_e": {"u_value": 1.4, "cost_per_m2_inr": 7000},
}

def material_name(index: int) -> str:
    return list(MATERIALS)[max(0, min(index, len(MATERIALS) - 1))]

def glazing_name(index: int) -> str:
    return list(GLAZING)[max(0, min(index, len(GLAZING) - 1))]
