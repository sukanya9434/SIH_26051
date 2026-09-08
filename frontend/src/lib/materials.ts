/**
 * Single source of truth for building wall materials across the frontend.
 * Conforms to the four notebook-trained, verified canonical categories:
 * Concrete, Mud_Brick, Rammed_Earth, Stone.
 */

export const CANONICAL_WALL_MATERIALS = [
  "Concrete",
  "Mud_Brick",
  "Rammed_Earth",
  "Stone",
] as const;

export type WallMaterial = (typeof CANONICAL_WALL_MATERIALS)[number];

export interface WallMaterialDefinition {
  name: WallMaterial;
  displayName: string;
  k: number; // Thermal conductivity in W/(m·K)
  baseColor: string; // Ladakhi vernacular 3D mesh base color
  description: string;
}

export const WALL_MATERIALS: Record<WallMaterial, WallMaterialDefinition> = {
  Concrete: {
    name: "Concrete",
    displayName: "Concrete",
    k: 1.4,
    baseColor: "#CBD5E1", // Bright architectural concrete light mist
    description: "Conventional reinforced / cast concrete",
  },
  Mud_Brick: {
    name: "Mud_Brick",
    displayName: "Mud Brick",
    k: 0.6,
    baseColor: "#E2DCD5", // Bright whitewashed adobe lime-plaster
    description: "Sun-dried adobe mud brick masonry",
  },
  Rammed_Earth: {
    name: "Rammed_Earth",
    displayName: "Rammed Earth",
    k: 0.9,
    baseColor: "#EDE4D8", // Bright warm limestone cream (vernacular default)
    description: "Compacted subsoil earthen wall construction",
  },
  Stone: {
    name: "Stone",
    displayName: "Stone",
    k: 1.8,
    baseColor: "#D4D8DD", // Bright Himalayan granite / silver stone
    description: "Traditional Ladakhi rough-hewn stone masonry",
  },
};

export const WALL_MATERIAL_K: Record<WallMaterial, number> = {
  Concrete: WALL_MATERIALS.Concrete.k,
  Mud_Brick: WALL_MATERIALS.Mud_Brick.k,
  Rammed_Earth: WALL_MATERIALS.Rammed_Earth.k,
  Stone: WALL_MATERIALS.Stone.k,
};

export function getWallMaterialDefinition(mat: string): WallMaterialDefinition {
  const normalized = mat.trim().toLowerCase();
  for (const key of CANONICAL_WALL_MATERIALS) {
    if (key.toLowerCase() === normalized) {
      return WALL_MATERIALS[key];
    }
  }
  // Fallbacks based on common substring identifiers
  if (normalized.includes("rammed")) return WALL_MATERIALS.Rammed_Earth;
  if (normalized.includes("mud") || normalized.includes("brick") || normalized.includes("adobe")) {
    return WALL_MATERIALS.Mud_Brick;
  }
  if (normalized.includes("concrete")) return WALL_MATERIALS.Concrete;
  if (normalized.includes("stone")) return WALL_MATERIALS.Stone;

  return WALL_MATERIALS.Rammed_Earth; // Default vernacular Ladakhi material
}
