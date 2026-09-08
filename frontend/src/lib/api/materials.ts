import { ApiError } from "@/lib/api"

export type CanonicalMaterial = "Concrete" | "Mud_Brick" | "Rammed_Earth" | "Stone"

export interface MaterialProfile {
  thermal_mass_MJ_m3K: number
  k_W_mK: number
  lsor_cost_inr_m3: number
}

export type MaterialCatalog = Record<CanonicalMaterial, MaterialProfile>

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000"

export async function getMaterialCatalog(): Promise<MaterialCatalog> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/materials`)
  } catch {
    throw new ApiError(0, "The material properties service could not be reached.")
  }
  if (!response.ok) {
    throw new ApiError(response.status, "The material properties service returned an error.")
  }
  return (await response.json()) as MaterialCatalog
}

