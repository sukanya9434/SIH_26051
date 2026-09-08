import { ApiError } from "@/lib/api"

export type CanonicalMaterial = "Concrete" | "Mud_Brick" | "Rammed_Earth" | "Stone"

export interface MaterialProfile {
  thermal_mass_MJ_m3K: number
  k_W_mK: number
  lsor_cost_range?: string
  lsor_cost_inr_m3: number
}

export type MaterialCatalog = Record<CanonicalMaterial, MaterialProfile>

export const FALLBACK_MATERIAL_CATALOG: MaterialCatalog = {
  Concrete: {
    thermal_mass_MJ_m3K: 2.0,
    k_W_mK: 1.4,
    lsor_cost_range: "₹7,500 – ₹9,000/m³",
    lsor_cost_inr_m3: 8250,
  },
  Mud_Brick: {
    thermal_mass_MJ_m3K: 1.6,
    k_W_mK: 0.6,
    lsor_cost_range: "₹2,500 – ₹3,500/m³",
    lsor_cost_inr_m3: 3000,
  },
  Rammed_Earth: {
    thermal_mass_MJ_m3K: 1.9,
    k_W_mK: 0.9,
    lsor_cost_range: "₹1,600 – ₹2,400/m³",
    lsor_cost_inr_m3: 2000,
  },
  Stone: {
    thermal_mass_MJ_m3K: 2.2,
    k_W_mK: 1.8,
    lsor_cost_range: "₹4,500 – ₹6,000/m³",
    lsor_cost_inr_m3: 5250,
  },
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000"

export async function getMaterialCatalog(): Promise<MaterialCatalog> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/materials`)
  } catch {
    return FALLBACK_MATERIAL_CATALOG
  }
  if (!response.ok) {
    return FALLBACK_MATERIAL_CATALOG
  }
  try {
    const data = (await response.json()) as MaterialCatalog
    return data
  } catch {
    return FALLBACK_MATERIAL_CATALOG
  }
}


