"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Zap,
  AlertCircle,
  CheckCircle2,
  CloudSun,
  Flame,
} from "lucide-react"

import { type ThermalEnergyRequest } from "@/lib/api"
import { useClimateAutoFill } from "@/hooks/useClimateAutoFill"
import { predictThermalEnergy, type ThermalEnergyResult } from "@/lib/api/thermal-energy"
import type { DesignResult } from "@/lib/api/design"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CANONICAL_WALL_MATERIALS, WALL_MATERIALS } from "@/lib/materials"
import { MaterialRationaleCard } from "@/components/MaterialRationaleCard"
import { getMaterialCatalog, type MaterialCatalog } from "@/lib/api/materials"

type FormState = {
  latitude: string
  longitude: string
  shelter_volume_m3: string
  wall_material: string
  wall_thickness_cm: string
  glazing_ratio: string
  insulation_r_value: string
  ghi_w_m2: string
  ambient_temp_c: string
  thermal_mass_kj_k: string
}

const initialForm: FormState = {
  latitude: "34.16",
  longitude: "77.58",
  shelter_volume_m3: "120",
  wall_material: "Rammed_Earth",
  wall_thickness_cm: "45",
  glazing_ratio: "0.25",
  insulation_r_value: "5.2",
  ghi_w_m2: "",
  ambient_temp_c: "",
  thermal_mass_kj_k: "",
}

const GOLDEN_PRESETS = [
  { name: "Leh", lat: "34.16", lon: "77.58", elev: "3,500m", note: "-6°C Standard" },
  { name: "Kargil", lat: "34.55", lon: "76.13", elev: "2,676m", note: "-10°C Deep Valley" },
  { name: "Nyoma", lat: "33.20", lon: "78.67", elev: "4,180m", note: "-18°C High Plateau" },
  { name: "Diskit Nubra", lat: "34.57", lon: "77.56", elev: "3,048m", note: "+5°C Solar Oasis" },
  { name: "Drass", lat: "34.43", lon: "75.75", elev: "3,280m", note: "-25°C Sub-Zero Cold" },
]

function optionalNumber(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value)
}

export default function ThermalEnergyPage() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<ThermalEnergyResult | null>(null)
  const [designResult, setDesignResult] = useState<DesignResult | null>(null)
  const [prefillMessage, setPrefillMessage] = useState("")
  const [materialCatalog, setMaterialCatalog] = useState<MaterialCatalog | null>(null)

  function applyPreset(preset: (typeof GOLDEN_PRESETS)[number]) {
    setForm((prev) => ({
      ...prev,
      latitude: preset.lat,
      longitude: preset.lon,
    }))
    setResult(null)
  }

  useEffect(() => {
    getMaterialCatalog().then(setMaterialCatalog).catch(() => setMaterialCatalog(null))
  }, [])

  const { manualOverride, setManualOverride, climateLoading, climateError, climateSynced } = useClimateAutoFill({
    latitude: form.latitude,
    longitude: form.longitude,
    toFields: (climate) => ({
      ambient_temp_c: String(climate.ambient_temp_c),
      ghi_w_m2: String(Math.round((climate.ghi_kwh_m2_day * 1000) / 24)),
    }),
    onFields: (fields) => setForm((previous) => ({ ...previous, ...fields })),
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = sessionStorage.getItem("thermal-design-result")
      if (!stored) return
      try {
        setDesignResult(JSON.parse(stored) as DesignResult)
      } catch {
        sessionStorage.removeItem("thermal-design-result")
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  function updateField(field: keyof FormState, value: string) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  function pullFromDesign() {
    if (!designResult) return
    setForm((previous) => ({
      ...previous,
      wall_material: designResult.material_name ?? previous.wall_material,
      wall_thickness_cm: String(designResult.wall_thickness_cm),
      glazing_ratio: String(designResult.glazing_ratio),
      insulation_r_value: String(designResult.insulation_r_value),
    }))
    setPrefillMessage(designResult.material_name
      ? "Design result applied: material, wall thickness, glazing, and insulation."
      : "Design result applied: wall thickness, glazing, and insulation. Choose wall material manually because this design class has no source material label.")
    setError("")
  }

  async function useMyLocation() {
    setError("")

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.")
      return
    }

    setLocationLoading(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(4))
        const lon = Number(position.coords.longitude.toFixed(4))

        setForm((prev) => ({
          ...prev,
          latitude: String(lat),
          longitude: String(lon),
        }))

        setLocationLoading(false)
      },
      () => {
        setLocationLoading(false)
        setError("Unable to retrieve GPS coordinates. You can enter the coordinates manually.")
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    )
  }

  async function handleSubmit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setError("")
    setResult(null)

    const latitude = Number(form.latitude)
    const longitude = Number(form.longitude)
    const hour = 12
    const volume = Number(form.shelter_volume_m3)
    const thickness = Number(form.wall_thickness_cm)
    const glazing = Number(form.glazing_ratio)
    const insulation = Number(form.insulation_r_value)
    const ambient = optionalNumber(form.ambient_temp_c)
    const ghi = optionalNumber(form.ghi_w_m2)
    const thermalMass = optionalNumber(form.thermal_mass_kj_k)
    if (!form.latitude || !form.longitude || !form.shelter_volume_m3 || !form.wall_material || !form.wall_thickness_cm || !form.glazing_ratio || !form.insulation_r_value) {
      setError("Please fill in all required shelter parameters.")
      return
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(volume) || volume <= 0 || !Number.isFinite(thickness) || thickness <= 0 || !Number.isFinite(glazing) || glazing < 0 || glazing > 1 || !Number.isFinite(insulation) || insulation < 0 || ambient !== undefined && !Number.isFinite(ambient) || ghi !== undefined && (!Number.isFinite(ghi) || ghi < 0) || thermalMass !== undefined && (!Number.isFinite(thermalMass) || thermalMass <= 0)) {
      setError("Check the coordinates, shelter values, and optional climate details.")
      return
    }

    const request: ThermalEnergyRequest = {
      latitude,
      longitude,
      hour,
      shelter_volume_m3: volume,
      wall_material: form.wall_material,
      wall_thickness_cm: thickness,
      glazing_ratio: glazing,
      insulation_r_value: insulation,
      ghi_w_m2: ghi,
      ambient_temp_c: ambient,
      thermal_mass_kj_k: thermalMass,
    }

    try {
      setLoading(true)
      const response = await predictThermalEnergy(request)
      setResult(response)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Thermal energy prediction failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-accent selection:text-white">
      <div className="mx-auto w-full max-w-[1550px] px-4 py-8 sm:px-8 lg:px-12">
        {/* Navigation & Grand Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            BACK TO OVERVIEW
          </Link>

          <div className="flex flex-col justify-between gap-4 border-b border-border/70 pb-6 lg:flex-row lg:items-end">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold tracking-widest text-accent uppercase">
                  ◆ WORKSPACE 03 · HEATING DEMAND &amp; LOAD ESTIMATION ◆
                </span>
              </div>
              <h1 className="mt-1 font-cinzel text-3xl font-bold tracking-wide text-foreground sm:text-4xl lg:text-5xl">
                Thermal Energy &amp; Heating Demand
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                XGBoost regression estimating peak hourly kWh thermal loads and winter energy demand across harsh sub-zero Ladakh conditions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="input" className="font-mono text-xs">
                LADAKH REGION · 3,500m
              </Badge>
              <Badge variant="output" className="font-mono text-xs">
                XGBREGRESSOR R² = 0.988
              </Badge>
              <Badge variant="default" className="border border-border font-mono text-xs">
                HEATING SETPOINT: 19.6°C
              </Badge>
            </div>
          </div>
        </div>

        {/* Golden Presets Strip */}
        <div className="mb-8 rounded-none border border-border bg-card/60 p-4 backdrop-blur-sm">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ⚡ High-Altitude Ladakh Reference Presets (Instant Auto-Fill)
            </span>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              Select a location to sync coordinates &amp; climate parameters
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {GOLDEN_PRESETS.map((preset) => {
              const isSelected = form.latitude === preset.lat && form.longitude === preset.lon
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`flex flex-col rounded-none border p-2.5 text-left transition-all ${
                    isSelected
                      ? "border-accent bg-accent/15 text-foreground shadow-sm"
                      : "border-border bg-muted/20 text-muted-foreground hover:border-accent/60 hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{preset.name}</span>
                    <span className="font-mono text-[10px] text-accent">{preset.elev}</span>
                  </div>
                  <span className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {preset.lat}°N, {preset.lon}°E · {preset.note}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Main Grid: Expansive 12-Column Command Deck */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Form Deck (7 cols) */}
          <div className="space-y-6 lg:col-span-7">
            <Card className="rounded-none border-border bg-card p-6 shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Location & NASA Climate */}
                <div>
                  <div className="mb-3 flex items-center justify-between border-b border-border/80 pb-2">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <MapPin size={14} className="text-accent" />
                      1. Geolocation &amp; NASA POWER Sync
                    </h2>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={useMyLocation}
                      disabled={locationLoading}
                      className="text-xs font-mono"
                    >
                      {locationLoading ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <MapPin className="mr-1.5 h-3 w-3 text-accent" />
                      )}
                      Use my GPS + NASA POWER
                    </Button>
                  </div>

                  {climateSynced && (
                    <div className="mb-4 flex items-center gap-2 border border-success/40 bg-success/10 px-3.5 py-2.5 text-xs text-success">
                      <CloudSun className="h-4 w-4 shrink-0" />
                      <span>NASA POWER climate data successfully synced for coordinates.</span>
                    </div>
                  )}

                  {designResult && (
                    <div className="mb-4 border border-accent/40 bg-accent/10 p-3 text-xs text-accent">
                      <div className="flex items-center justify-between gap-3">
                        <span>Design result available for cross-flow prefill.</span>
                        <Button type="button" variant="outline" size="xs" onClick={pullFromDesign}>
                          Pull from Design result
                        </Button>
                      </div>
                      {prefillMessage && <p className="mt-2 text-muted-foreground">{prefillMessage}</p>}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Latitude (°N)" required>
                      <Input
                        type="number"
                        step="any"
                        className="font-mono text-sm"
                        value={form.latitude}
                        onChange={(e) => updateField("latitude", e.target.value)}
                      />
                    </Field>
                    <Field label="Longitude (°E)" required>
                      <Input
                        type="number"
                        step="any"
                        className="font-mono text-sm"
                        value={form.longitude}
                        onChange={(e) => updateField("longitude", e.target.value)}
                      />
                    </Field>
                  </div>
                </div>

                {/* Climate Context */}
                <div>
                  <div className="mb-3 border-b border-border/80 pb-2">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <CloudSun size={14} className="text-accent" />
                      2. Climate Conditions (In-Situ)
                    </h2>
                  </div>
                  <label className="mb-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={manualOverride}
                      onChange={(e) => setManualOverride(e.target.checked)}
                      className="h-4 w-4 accent-accent"
                    />
                    Add climate details manually (override NASA POWER)
                  </label>
                  {climateLoading && (
                    <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                      Fetching climate data...
                    </div>
                  )}
                  {climateError && (
                    <div className="mb-3 flex items-center gap-2 border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {climateError}
                    </div>
                  )}
                  {climateSynced && !climateLoading && !climateError && (
                    <div className="mb-3 flex items-center gap-2 text-xs text-success">
                      <CloudSun className="h-3.5 w-3.5" />
                      NASA POWER values synced for these coordinates.
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Ambient Temp (°C)">
                      <Input
                        type="number"
                        step="any"
                        className="font-mono text-sm"
                        value={form.ambient_temp_c}
                        disabled={!manualOverride && !climateError}
                        onChange={(e) => updateField("ambient_temp_c", e.target.value)}
                        placeholder="-6.0"
                      />
                    </Field>
                    <Field label="Solar GHI (W/m²)">
                      <Input
                        type="number"
                        step="any"
                        className="font-mono text-sm"
                        value={form.ghi_w_m2}
                        disabled={!manualOverride && !climateError}
                        onChange={(e) => updateField("ghi_w_m2", e.target.value)}
                        placeholder="450"
                      />
                    </Field>
                  </div>
                </div>

                {/* Envelope Geometry & Materials */}
                <div>
                  <div className="mb-3 border-b border-border/80 pb-2">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Zap size={14} className="text-accent" />
                      3. Shelter Geometry &amp; Construction
                    </h2>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Shelter Volume (m³)" required>
                        <Input
                          type="number"
                          step="any"
                          className="font-mono text-sm"
                          value={form.shelter_volume_m3}
                          onChange={(e) => updateField("shelter_volume_m3", e.target.value)}
                        />
                      </Field>
                      <Field label="Wall Material" required>
                        <select
                          className="w-full rounded-none border border-border bg-input px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                          value={form.wall_material}
                          onChange={(e) => updateField("wall_material", e.target.value)}
                        >
                          {CANONICAL_WALL_MATERIALS.map((mat) => (
                            <option key={mat} value={mat}>
                              {WALL_MATERIALS[mat].displayName}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Field label="Wall Thickness (cm)" required>
                        <Input
                          type="number"
                          step="any"
                          className="font-mono text-sm"
                          value={form.wall_thickness_cm}
                          onChange={(e) => updateField("wall_thickness_cm", e.target.value)}
                        />
                      </Field>
                      <Field label="Glazing Ratio" required>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          className="font-mono text-sm"
                          value={form.glazing_ratio}
                          onChange={(e) => updateField("glazing_ratio", e.target.value)}
                        />
                      </Field>
                      <Field label="Insulation R-Value" required>
                        <Input
                          type="number"
                          step="any"
                          className="font-mono text-sm"
                          value={form.insulation_r_value}
                          onChange={(e) => updateField("insulation_r_value", e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                    <Button type="button" variant="outline" size="xs" className="ml-auto" onClick={() => void handleSubmit()} disabled={loading}>
                      Retry
                    </Button>
                  </div>
                )}

                <Button type="submit" className="w-full bg-accent text-white font-semibold shadow-md hover:bg-accent/90" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Calculating Thermal Load...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Estimate Thermal Heating Demand
                    </>
                  )}
                </Button>
              </form>
            </Card>
          </div>

          {/* Heating Demand Output Cockpit (5 cols) */}
          <div className="space-y-6 lg:col-span-5">
            <Card className="rounded-none border-border bg-card shadow-sm">
              <div className="border-b border-border/80 bg-muted/30 px-5 py-3">
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  HEATING DEMAND OUTPUT · COCKPIT
                </p>
              </div>

              {result === null ? (
                <div className="p-6 space-y-5">
                  <div className="flex items-start gap-3 rounded-none border border-border bg-muted/20 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none border border-accent/40 bg-accent/10 text-accent">
                      <Flame size={20} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">
                        Awaiting Energy Estimation
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Submit the envelope configuration or choose a golden preset to compute hourly heating load (kWh) and winter thermal performance.
                      </p>
                    </div>
                  </div>

                  {/* Benchmark Targets */}
                  <div className="divide-y divide-border/80 rounded-none border border-border">
                    <div className="flex items-center justify-between p-3 text-xs">
                      <span className="text-muted-foreground">Shelter Volume</span>
                      <span className="font-mono font-bold text-foreground">{form.shelter_volume_m3} m³</span>
                    </div>
                    <div className="flex items-center justify-between p-3 text-xs">
                      <span className="text-muted-foreground">Selected Wall Material</span>
                      <span className="font-mono font-bold text-accent">{form.wall_material}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 text-xs">
                      <span className="text-muted-foreground">Wall Thickness</span>
                      <span className="font-mono font-bold text-foreground">{form.wall_thickness_cm} cm</span>
                    </div>
                    <div className="flex items-center justify-between p-3 text-xs">
                      <span className="text-muted-foreground">Insulation R-Value</span>
                      <span className="font-mono font-bold text-success">{form.insulation_r_value} m²K/W</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Big Number */}
                  <div className="rounded-none border border-border bg-gradient-to-b from-card to-muted/20 p-6 text-center">
                    <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      Hourly Heating Demand
                    </p>
                    <div className="mt-2 flex items-baseline justify-center">
                      <span className="data-value font-mono text-6xl font-bold tracking-tight text-foreground">
                        {result.thermal_energy_kwh.toFixed(2)}
                      </span>
                      <span className="ml-1 font-mono text-2xl text-muted-foreground">kWh</span>
                    </div>
                  </div>

                  {/* Model Context */}
                  <div className="space-y-2 rounded-none border border-border bg-background p-4">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border pb-1.5">
                      MODEL CONTEXT
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Trained XGBoost regression estimate for this specific hour in extreme Ladakhi sub-zero ambient conditions.
                    </p>
                  </div>

                  {/* Passive Efficiency Advice */}
                  <div className="rounded-none border border-border bg-muted/20 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-xs font-semibold text-foreground">High Thermal Retention</span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Higher insulation R-values and massive earth/stone construction dramatically dampen diurnal temperature swings.
                    </p>
                  </div>

                  <div className="border-t border-border pt-4 flex flex-col gap-2 text-center">
                    <Button type="button" variant="outline" size="sm" onClick={() => setResult(null)}>
                      Edit inputs / try another location
                    </Button>
                    <Link
                      href={`/dashboard?outdoor_temp_c=${form.ambient_temp_c}&material=${form.wall_material}`}
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-mono text-accent hover:underline"
                    >
                      Compare Pareto Trade-Offs in Dashboard →
                    </Link>
                  </div>
                </div>
              )}
            </Card>

            <div>
              <MaterialRationaleCard
                material={form.wall_material as keyof MaterialCatalog}
                profile={materialCatalog ? materialCatalog[form.wall_material as keyof MaterialCatalog] : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      {children}
    </div>
  )
}
