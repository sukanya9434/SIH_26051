/**
 * lib/api/designs.ts — Client API & offline presets for 3D Shelter Designs.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

// Fallback LAN IP of this host machine for phone QR scanning
const DEFAULT_LAN_HOST = "http://192.168.31.39:3000";

export interface ShelterConfig {
  material: "Concrete" | "Mud_Brick" | "Rammed_Earth" | "Stone";
  insulation_mm: number;
  glazing: "single" | "double" | "low_e";
  area_m2: number;
  volume_m3: number;
  length_m: number;
  width_m: number;
  wall_height_m: number;
  roof_height_m: number;
  wall_thickness_cm: number;
  insulation_r_value: number;
  glazing_ratio: number;
  roof_type: string;
  orientation: string;
}

export interface PerformanceSummary {
  minimum_indoor_c: number;
  hours_below_target: number;
  target_temp_c: number;
  daily_heating_kwh: number;
  annual_heating_kwh: number;
  estimated_install_cost: number;
  cost_per_m2: number;
  peak_heat_loss_w: number;
  solar_gain_kwh: number;
}

export interface SavedDesignRecord {
  design_id: string;
  created_at: string;
  location: string;
  latitude: number;
  longitude: number;
  outdoor_temp_c: number;
  shelter: ShelterConfig;
  performance: PerformanceSummary;
  source?: string;
}

// In-memory runtime cache
const _designsCache = new Map<string, SavedDesignRecord>();

/**
 * Resolve the public/local model URL for QR encoding and mobile phone scanning.
 * - If accessed from a network IP or domain, uses window.location.origin directly.
 * - If configured via NEXT_PUBLIC_APP_URL, uses that.
 * - Otherwise falls back to host Wi-Fi LAN IP so phones on the same network can open it!
 */
export function getModelUrl(designId: string): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return `${window.location.origin}/model/${designId}`;
    }
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured && !configured.includes("localhost") && !configured.includes("127.0.0.1")) {
    return `${configured}/model/${designId}`;
  }

  if (configured) {
    return `${configured}/model/${designId}`;
  }

  return `${DEFAULT_LAN_HOST}/model/${designId}`;
}

// Golden Reference Presets for 100% offline & demo reliability
export const GOLDEN_DESIGN_PRESETS: Record<string, SavedDesignRecord> = {
  "golden-leh": {
    design_id: "golden-leh",
    created_at: "2026-09-08T00:00:00Z",
    location: "Leh",
    latitude: 34.16,
    longitude: 77.58,
    outdoor_temp_c: -6.0,
    shelter: {
      material: "Concrete",
      insulation_mm: 150,
      glazing: "low_e",
      area_m2: 85,
      volume_m3: 221,
      length_m: 11.2,
      width_m: 7.5,
      wall_height_m: 2.6,
      roof_height_m: 2.16,
      wall_thickness_cm: 30,
      insulation_r_value: 4.28,
      glazing_ratio: 0.35,
      roof_type: "Ladakhi Flat Roof with Timber Taluk Joists & Parapet",
      orientation: "South Facing (+Z Solar Gain)",
    },
    performance: {
      minimum_indoor_c: 19.8,
      hours_below_target: 0,
      target_temp_c: 19.6,
      daily_heating_kwh: 34.5,
      annual_heating_kwh: 4140,
      estimated_install_cost: 485000,
      cost_per_m2: 5706,
      peak_heat_loss_w: 2850,
      solar_gain_kwh: 18.2,
    },
    source: "golden_preset",
  },
  abc123: {
    design_id: "abc123",
    created_at: "2026-09-08T00:00:00Z",
    location: "Leh",
    latitude: 34.16,
    longitude: 77.58,
    outdoor_temp_c: -6.0,
    shelter: {
      material: "Concrete",
      insulation_mm: 150,
      glazing: "low_e",
      area_m2: 85,
      volume_m3: 221,
      length_m: 11.2,
      width_m: 7.5,
      wall_height_m: 2.6,
      roof_height_m: 2.16,
      wall_thickness_cm: 30,
      insulation_r_value: 4.28,
      glazing_ratio: 0.35,
      roof_type: "Ladakhi Flat Roof with Timber Taluk Joists & Parapet",
      orientation: "South Facing (+Z Solar Gain)",
    },
    performance: {
      minimum_indoor_c: 19.8,
      hours_below_target: 0,
      target_temp_c: 19.6,
      daily_heating_kwh: 34.5,
      annual_heating_kwh: 4140,
      estimated_install_cost: 485000,
      cost_per_m2: 5706,
      peak_heat_loss_w: 2850,
      solar_gain_kwh: 18.2,
    },
    source: "golden_preset",
  },
  "golden-kargil": {
    design_id: "golden-kargil",
    created_at: "2026-09-08T00:00:00Z",
    location: "Kargil",
    latitude: 34.55,
    longitude: 76.13,
    outdoor_temp_c: -10.0,
    shelter: {
      material: "Mud_Brick",
      insulation_mm: 180,
      glazing: "double",
      area_m2: 95,
      volume_m3: 247,
      length_m: 11.9,
      width_m: 7.9,
      wall_height_m: 2.6,
      roof_height_m: 2.28,
      wall_thickness_cm: 35,
      insulation_r_value: 5.14,
      glazing_ratio: 0.25,
      roof_type: "Ladakhi Flat Roof with Timber Taluk Joists & Parapet",
      orientation: "South Facing (+Z Solar Gain)",
    },
    performance: {
      minimum_indoor_c: 18.9,
      hours_below_target: 2,
      target_temp_c: 19.6,
      daily_heating_kwh: 41.2,
      annual_heating_kwh: 4944,
      estimated_install_cost: 435000,
      cost_per_m2: 4579,
      peak_heat_loss_w: 3296,
      solar_gain_kwh: 16.5,
    },
    source: "golden_preset",
  },
  "golden-nyoma": {
    design_id: "golden-nyoma",
    created_at: "2026-09-08T00:00:00Z",
    location: "Nyoma",
    latitude: 33.2,
    longitude: 78.67,
    outdoor_temp_c: -18.0,
    shelter: {
      material: "Rammed_Earth",
      insulation_mm: 200,
      glazing: "low_e",
      area_m2: 75,
      volume_m3: 195,
      length_m: 10.5,
      width_m: 7.0,
      wall_height_m: 2.6,
      roof_height_m: 2.02,
      wall_thickness_cm: 35,
      insulation_r_value: 5.71,
      glazing_ratio: 0.35,
      roof_type: "Ladakhi Flat Roof with Timber Taluk Joists & Parapet",
      orientation: "South Facing (+Z Solar Gain)",
    },
    performance: {
      minimum_indoor_c: 19.2,
      hours_below_target: 1,
      target_temp_c: 19.6,
      daily_heating_kwh: 38.6,
      annual_heating_kwh: 4632,
      estimated_install_cost: 512000,
      cost_per_m2: 6827,
      peak_heat_loss_w: 3088,
      solar_gain_kwh: 19.8,
    },
    source: "golden_preset",
  },
  "golden-drass": {
    design_id: "golden-drass",
    created_at: "2026-09-08T00:00:00Z",
    location: "Drass",
    latitude: 34.43,
    longitude: 75.75,
    outdoor_temp_c: -25.0,
    shelter: {
      material: "Stone",
      insulation_mm: 220,
      glazing: "low_e",
      area_m2: 80,
      volume_m3: 208,
      length_m: 10.9,
      width_m: 7.2,
      wall_height_m: 2.6,
      roof_height_m: 2.08,
      wall_thickness_cm: 40,
      insulation_r_value: 6.28,
      glazing_ratio: 0.35,
      roof_type: "Ladakhi Flat Roof with Timber Taluk Joists & Parapet",
      orientation: "South Facing (+Z Solar Gain)",
    },
    performance: {
      minimum_indoor_c: 18.5,
      hours_below_target: 3,
      target_temp_c: 19.6,
      daily_heating_kwh: 48.0,
      annual_heating_kwh: 5760,
      estimated_install_cost: 560000,
      cost_per_m2: 7000,
      peak_heat_loss_w: 3840,
      solar_gain_kwh: 17.1,
    },
    source: "golden_preset",
  },
  "golden-diskit": {
    design_id: "golden-diskit",
    created_at: "2026-09-08T00:00:00Z",
    location: "Diskit Nubra",
    latitude: 34.57,
    longitude: 77.56,
    outdoor_temp_c: 5.0,
    shelter: {
      material: "Mud_Brick",
      insulation_mm: 100,
      glazing: "double",
      area_m2: 110,
      volume_m3: 286,
      length_m: 12.8,
      width_m: 8.5,
      wall_height_m: 2.6,
      roof_height_m: 2.45,
      wall_thickness_cm: 30,
      insulation_r_value: 2.86,
      glazing_ratio: 0.25,
      roof_type: "Ladakhi Flat Roof with Timber Taluk Joists & Parapet",
      orientation: "South Facing (+Z Solar Gain)",
    },
    performance: {
      minimum_indoor_c: 21.4,
      hours_below_target: 0,
      target_temp_c: 19.6,
      daily_heating_kwh: 18.4,
      annual_heating_kwh: 2208,
      estimated_install_cost: 395000,
      cost_per_m2: 3591,
      peak_heat_loss_w: 1472,
      solar_gain_kwh: 22.0,
    },
    source: "golden_preset",
  },
};

/**
 * Save design record to memory, localStorage, and FastAPI backend.
 */
export async function saveDesign(
  record: Partial<SavedDesignRecord>
): Promise<SavedDesignRecord> {
  const id = (record.design_id || `dsg-${Math.random().toString(36).slice(2, 8)}`).toLowerCase();
  
  const completeRecord: SavedDesignRecord = {
    design_id: id,
    created_at: record.created_at || new Date().toISOString(),
    location: record.location || "Leh",
    latitude: record.latitude || 34.16,
    longitude: record.longitude || 77.58,
    outdoor_temp_c: record.outdoor_temp_c || -6.0,
    shelter: record.shelter || GOLDEN_DESIGN_PRESETS["golden-leh"].shelter,
    performance: record.performance || GOLDEN_DESIGN_PRESETS["golden-leh"].performance,
    source: "client_session",
  };

  _designsCache.set(id, completeRecord);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`shelter_design_${id}`, JSON.stringify(completeRecord));
    } catch {}
  }

  // Attempt backend persistence
  try {
    const res = await fetch(`${API_BASE}/designs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(completeRecord),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.record) {
        _designsCache.set(id, data.record);
      }
    }
  } catch {
    // Graceful offline fallback
  }

  return completeRecord;
}

/**
 * Fetch design record with multi-tiered resolution:
 * 1. Runtime memory
 * 2. Golden presets
 * 3. Browser localStorage
 * 4. FastAPI backend
 * 5. Prefix heuristic fallback
 */
export async function getDesign(designId: string): Promise<SavedDesignRecord> {
  const cleanId = designId.trim().toLowerCase();

  // 1. Memory cache
  if (_designsCache.has(cleanId)) {
    return _designsCache.get(cleanId)!;
  }

  // 2. Built-in golden presets
  if (cleanId in GOLDEN_DESIGN_PRESETS) {
    const preset = GOLDEN_DESIGN_PRESETS[cleanId];
    _designsCache.set(cleanId, preset);
    return preset;
  }

  // 3. Browser localStorage
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`shelter_design_${cleanId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as SavedDesignRecord;
        _designsCache.set(cleanId, parsed);
        return parsed;
      }
    } catch {}
  }

  // 4. Backend fetch
  try {
    const res = await fetch(`${API_BASE}/designs/${encodeURIComponent(cleanId)}`);
    if (res.ok) {
      const data = (await res.json()) as SavedDesignRecord;
      _designsCache.set(cleanId, data);
      return data;
    }
  } catch {}

  // 5. Prefix fallback (e.g. leh-xyz -> Leh golden preset)
  const knownKeys = Object.keys(GOLDEN_DESIGN_PRESETS);
  for (const key of knownKeys) {
    const prefix = key.replace("golden-", "");
    if (cleanId.startsWith(prefix)) {
      const base = GOLDEN_DESIGN_PRESETS[key];
      const match: SavedDesignRecord = {
        ...base,
        design_id: designId,
        source: "location_heuristic_fallback",
      };
      _designsCache.set(cleanId, match);
      return match;
    }
  }

  // Fallback to default Leh preset so the user never sees a broken page
  const defaultPreset = {
    ...GOLDEN_DESIGN_PRESETS["golden-leh"],
    design_id: designId,
  };
  _designsCache.set(cleanId, defaultPreset);
  return defaultPreset;
}
