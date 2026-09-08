"use client"

import { Layers } from "lucide-react"
import type { CanonicalMaterial, MaterialProfile } from "@/lib/api/materials"
import { WALL_MATERIALS } from "@/lib/materials"

interface MaterialRationaleCardProps {
  material: CanonicalMaterial
  profile: MaterialProfile
}

export function MaterialRationaleCard({ material, profile }: MaterialRationaleCardProps) {
  return (
    <div className="border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Material properties · {WALL_MATERIALS[material].displayName}
        </h3>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="border border-border bg-card p-2">
          <span className="block text-[10px] text-muted-foreground">Thermal mass</span>
          <span className="font-mono font-semibold text-foreground">{profile.thermal_mass_MJ_m3K} MJ/m³K</span>
        </div>
        <div className="border border-border bg-card p-2">
          <span className="block text-[10px] text-muted-foreground">Conductivity k</span>
          <span className="font-mono font-semibold text-foreground">{profile.k_W_mK} W/mK</span>
        </div>
        <div className="border border-border bg-card p-2">
          <span className="block text-[10px] text-muted-foreground">LSoR 2024 midpoint</span>
          <span className="font-mono font-semibold text-foreground">₹{profile.lsor_cost_inr_m3.toLocaleString()}/m³</span>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        The thermal mass and conductivity are the values used by the envelope physics model; the displayed cost is the LSoR 2024 midpoint used by the optimizer.
      </p>
    </div>
  )
}

