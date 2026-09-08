"use client"

import React from "react"
import { Layers, Info } from "lucide-react"
import type { CanonicalMaterial, MaterialProfile } from "@/lib/api/materials"
import { WALL_MATERIALS } from "@/lib/materials"
import { Badge } from "@/components/ui/badge"

interface MaterialRationaleCardProps {
  material: CanonicalMaterial
  profile?: MaterialProfile
  className?: string
}

export function MaterialRationaleCard({
  material,
  profile,
  className = "",
}: MaterialRationaleCardProps) {
  const matDef = WALL_MATERIALS[material] ?? WALL_MATERIALS.Rammed_Earth
  const costRange = profile?.lsor_cost_range ?? (
    material === "Mud_Brick" ? "₹2,500 – ₹3,500/m³" :
    material === "Rammed_Earth" ? "₹1,600 – ₹2,400/m³" :
    material === "Stone" ? "₹4,500 – ₹6,000/m³" :
    "₹7,500 – ₹9,000/m³"
  )
  const thermalMass = profile?.thermal_mass_MJ_m3K ?? (
    material === "Mud_Brick" ? 1.6 :
    material === "Rammed_Earth" ? 1.9 :
    material === "Stone" ? 2.2 :
    2.0
  )
  const kValue = profile?.k_W_mK ?? matDef.k
  const midpoint = profile?.lsor_cost_inr_m3 ?? (
    material === "Mud_Brick" ? 3000 :
    material === "Rammed_Earth" ? 2000 :
    material === "Stone" ? 5250 :
    8250
  )

  return (
    <div
      id="material-rationale-card"
      className={`rounded-none border border-border bg-card p-4 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-accent" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Why this material?
          </h3>
        </div>
        <Badge variant="input" className="font-mono text-[11px] font-semibold text-foreground">
          {matDef.displayName} ({material})
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {/* Metric 1: Thermal Mass */}
        <div className="rounded-none border border-border bg-muted/20 p-2.5">
          <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Thermal Mass
          </span>
          <span className="mt-0.5 block font-mono text-sm font-bold text-foreground">
            {thermalMass} <span className="text-[11px] font-normal text-muted-foreground">MJ/m³·K</span>
          </span>
          <span className="mt-1 block text-[10px] text-muted-foreground">
            Volumetric heat storage
          </span>
        </div>

        {/* Metric 2: Conductivity k */}
        <div className="rounded-none border border-border bg-muted/20 p-2.5">
          <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Conductivity (k)
          </span>
          <span className="mt-0.5 block font-mono text-sm font-bold text-foreground">
            {kValue} <span className="text-[11px] font-normal text-muted-foreground">W/(m·K)</span>
          </span>
          <span className="mt-1 block text-[10px] text-muted-foreground">
            Conductive heat loss rate
          </span>
        </div>

        {/* Metric 3: LSoR 2024 Cost Range */}
        <div className="rounded-none border border-border bg-muted/20 p-2.5">
          <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            LSoR 2024 Cost Range
          </span>
          <span className="mt-0.5 block font-mono text-xs font-bold text-foreground">
            {costRange}
          </span>
          <span className="mt-1 block text-[10px] text-muted-foreground">
            Midpoint: ₹{midpoint.toLocaleString()}/m³ (≈₹{Math.round(midpoint * 0.35).toLocaleString()}/m² wall)
          </span>
        </div>
      </div>

      {/* Factual general physics explanation sentence */}
      <div className="mt-3 flex items-start gap-2 border-t border-border/70 pt-2.5">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Higher thermal mass slows how quickly a material absorbs and releases heat, reducing indoor temperature swings between day and night.
        </p>
      </div>
    </div>
  )
}
