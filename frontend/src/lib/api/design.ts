import { ApiError, type DesignPredictionRequest, type DesignPredictionResponse } from "@/lib/api"
import type { WallMaterial } from "@/lib/materials"

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000"

export type DesignResult = {
  status: string
  shelter_material_and_design: string
  material_class: number
  wwr: number
  wall_thickness_cm: number
  glazing_ratio: number
  insulation_r_value: number
  /** Canonical wall material name conforming to the 4 trained materials. */
  material_name?: WallMaterial | null
}

export const DESIGN_CLASS_TO_WALL_MATERIAL: Record<number, WallMaterial> = {
  0: "Stone",
  1: "Rammed_Earth",
  2: "Rammed_Earth",
  3: "Mud_Brick",
  4: "Concrete",
}

export function withWallMaterial(result: Omit<DesignResult, "material_name">): DesignResult {
  return { ...result, material_name: DESIGN_CLASS_TO_WALL_MATERIAL[result.material_class] ?? null }
}

export type { DesignPredictionRequest, DesignPredictionResponse }

export async function predictDesign(body: DesignPredictionRequest): Promise<DesignResult> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/predict/design`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, "The design service could not be reached. Check that the backend is running.")
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new ApiError(response.status, "The design service returned an invalid response.")
  }

  if (!response.ok) {
    const detail = typeof data === "object" && data !== null && "detail" in data
      ? String((data as { detail: unknown }).detail)
      : response.statusText || "Design prediction failed."
    throw new ApiError(response.status, detail)
  }

  if (!isDesignResult(data)) {
    throw new ApiError(response.status, "The design service returned an incomplete specification.")
  }
  return data
}

function isDesignResult(value: unknown): value is DesignResult {
  if (typeof value !== "object" || value === null) return false
  const result = value as Record<string, unknown>
  return typeof result.status === "string" &&
    typeof result.shelter_material_and_design === "string" &&
    ["material_class", "wwr", "wall_thickness_cm", "glazing_ratio", "insulation_r_value"]
      .every((key) => typeof result[key] === "number" && Number.isFinite(result[key] as number))
}
