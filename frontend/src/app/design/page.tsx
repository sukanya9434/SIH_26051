"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Building2,
  AlertCircle,
  CheckCircle2,
  CloudSun,
} from "lucide-react"

import {
} from "@/lib/api"
import { useClimateAutoFill } from "@/hooks/useClimateAutoFill"
import { predictDesign, withWallMaterial, type DesignPredictionRequest, type DesignResult } from "@/lib/api/design"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dynamic3DView } from "@/components/heat-flow/Dynamic3DView"
import { MaterialRationaleCard } from "@/components/MaterialRationaleCard"
import { generateClientFallback } from "@/lib/api/heat-flow"
import { getMaterialCatalog, type MaterialCatalog } from "@/lib/api/materials"

type FormState = {
  latitude: string
  longitude: string
  ambient_temp_c: string
  wind_speed_ms: string
  wind_direction_deg: string
  ghi_kwh_m2_day: string
  warm_humidity_pct: string
  hot_air_index: string
  rain_last_7days_mm: string
}

const initialForm: FormState = {
  latitude: "34.16",
  longitude: "77.58",
  ambient_temp_c: "",
  wind_speed_ms: "",
  wind_direction_deg: "",
  ghi_kwh_m2_day: "",
  warm_humidity_pct: "",
  hot_air_index: "",
  rain_last_7days_mm: "",
}

const GOLDEN_PRESETS = [
  { name: "Leh", lat: "34.16", lon: "77.58", elev: "3,500m", note: "-6°C Standard" },
  { name: "Kargil", lat: "34.55", lon: "76.13", elev: "2,676m", note: "-10°C Deep Valley" },
  { name: "Nyoma", lat: "33.20", lon: "78.67", elev: "4,180m", note: "-18°C High Plateau" },
  { name: "Diskit Nubra", lat: "34.57", lon: "77.56", elev: "3,048m", note: "+5°C Solar Oasis" },
  { name: "Drass", lat: "34.43", lon: "75.75", elev: "3,280m", note: "-25°C Extreme Cold" },
]

const HOT_AIR_INDEX_OPTIONS = [
  "Extreme Freeze",
  "Very Low",
  "Low",
  "Moderate",
  "High",
]

function optionalNumber(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value)
}

export default function DesignPage() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [error, setError] = useState("")
  const [prediction, setPrediction] = useState<DesignResult | null>(null)
  const [materialCatalog, setMaterialCatalog] = useState<MaterialCatalog | null>(null)

  useEffect(() => {
    getMaterialCatalog().then(setMaterialCatalog).catch(() => setMaterialCatalog(null))
  }, [])

  const { manualOverride, setManualOverride, climateLoading, climateError, climateSynced } = useClimateAutoFill({
    latitude: form.latitude,
    longitude: form.longitude,
    toFields: (climate) => ({
      ambient_temp_c: String(climate.ambient_temp_c),
      wind_speed_ms: String(climate.wind_speed_ms),
      ghi_kwh_m2_day: String(climate.ghi_kwh_m2_day),
      warm_humidity_pct: String(climate.humidity_pct),
      rain_last_7days_mm: String(climate.rain_last_7days_mm),
    }),
    onFields: (fields) => setForm((previous) => ({ ...previous, ...fields })),
  })

  // Reuse the exact Heat Flow geometry/material pipeline for the embedded
  // preview. The Design model does not predict volume, so use the app's
  // canonical 100 m³ shelter volume while passing every predicted envelope
  // value through unchanged.
  const embeddedPreview = useMemo(() => {
    if (!prediction) return null
    return generateClientFallback({
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      month: 1,
      day: 15,
      volume_m3: 100,
      wall_material: prediction.material_name ?? "Rammed_Earth",
      wall_thickness_cm: prediction.wall_thickness_cm,
      insulation_r_value: prediction.insulation_r_value,
      glazing_ratio: prediction.glazing_ratio,
      occupancy: 2,
      heater_power_kw: 2,
      ambient_temp_c: Number(form.ambient_temp_c) || -6,
    })
  }, [form.ambient_temp_c, form.latitude, form.longitude, prediction])

  function updateField(field: keyof FormState, value: string) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  function applyPreset(preset: (typeof GOLDEN_PRESETS)[number]) {
    setForm((prev) => ({
      ...prev,
      latitude: preset.lat,
      longitude: preset.lon,
    }))
    setPrediction(null)
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
        setError("Unable to retrieve GPS coordinates. You can select a golden preset above.")
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    )
  }

  async function handleSubmit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setError("")
    setPrediction(null)

    const values = {
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      ambient: optionalNumber(form.ambient_temp_c),
      windSpeed: optionalNumber(form.wind_speed_ms),
      windDirection: optionalNumber(form.wind_direction_deg),
      ghi: optionalNumber(form.ghi_kwh_m2_day),
      humidity: optionalNumber(form.warm_humidity_pct),
      rain: optionalNumber(form.rain_last_7days_mm),
    }
    if (!Number.isFinite(values.latitude) || values.latitude < -90 || values.latitude > 90 || !Number.isFinite(values.longitude) || values.longitude < -180 || values.longitude > 180) {
      setError("Enter a valid latitude (-90 to 90) and longitude (-180 to 180).")
      return
    }
    if (values.ambient !== undefined && !Number.isFinite(values.ambient)) {
      setError("Ambient temperature must be a valid number.")
      return
    }
    if (values.windSpeed !== undefined && (!Number.isFinite(values.windSpeed) || values.windSpeed < 0)) {
      setError("Wind speed cannot be negative.")
      return
    }
    if (values.windDirection !== undefined && (!Number.isFinite(values.windDirection) || values.windDirection < 0 || values.windDirection > 360)) {
      setError("Wind direction must be between 0 and 360 degrees.")
      return
    }
    if (values.ghi !== undefined && (!Number.isFinite(values.ghi) || values.ghi < 0) || values.humidity !== undefined && (!Number.isFinite(values.humidity) || values.humidity < 0 || values.humidity > 100) || values.rain !== undefined && (!Number.isFinite(values.rain) || values.rain < 0)) {
      setError("GHI and rainfall cannot be negative; humidity must be between 0 and 100%.")
      return
    }

    const request: DesignPredictionRequest = {
      latitude: values.latitude,
      longitude: values.longitude,
      ambient_temp_c: values.ambient,
      wind_speed_ms: values.windSpeed,
      wind_direction_deg: values.windDirection,
      ghi_kwh_m2_day: values.ghi,
      warm_humidity_pct: values.humidity,
      hot_air_index: form.hot_air_index || null,
      rain_last_7days_mm: values.rain,
    }

    try {
      setLoading(true)
      const response = withWallMaterial(await predictDesign(request))
      setPrediction(response)
      sessionStorage.setItem("thermal-design-result", JSON.stringify(response))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Design prediction failed. Please try again.")
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
                  ◆ WORKSPACE 01 · ENVELOPE SYNTHESIS ◆
                </span>
              </div>
              <h1 className="mt-1 font-cinzel text-3xl font-bold tracking-wide text-foreground sm:text-4xl lg:text-5xl">
                Passive Shelter Design Classifier
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                XGBoost multi-class classifier predicting optimal building envelope geometry, vernacular materials, wall thickness, and glazing ratios tailored for Ladakh cold-arid microclimates.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="input" className="font-mono text-xs">
                LADAKH REGION · 3,500m
              </Badge>
              <Badge variant="output" className="font-mono text-xs">
                XGBCLASSIFIER ACCURACY: 99.35%
              </Badge>
              <Badge variant="default" className="border border-border font-mono text-xs">
                CANONICAL 100 m³ SHELTER
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

        {/* Conditional Layout: Form & Placeholder OR Results & Full-Width 3D Model */}
        {prediction === null ? (
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
                        1. Coordinates &amp; NASA POWER Sync
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
                        <span>NASA POWER climate data successfully synced for these coordinates.</span>
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

                  {/* Climate In-Situ */}
                  <div>
                    <div className="mb-3 border-b border-border/80 pb-2">
                      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <CloudSun size={14} className="text-accent" />
                        2. Regional Environmental Conditions
                      </h2>
                    </div>

                    <label className="mb-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={manualOverride}
                        onChange={(e) => setManualOverride(e.target.checked)}
                        className="h-4 w-4 accent-accent"
                      />
                      Add environmental details manually (override NASA POWER)
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

                    <div className="grid grid-cols-2 gap-4">
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
                      <Field label="Wind Speed (m/s)">
                        <Input
                          type="number"
                          step="any"
                          className="font-mono text-sm"
                          value={form.wind_speed_ms}
                          disabled={!manualOverride && !climateError}
                          onChange={(e) => updateField("wind_speed_ms", e.target.value)}
                          placeholder="3.2"
                        />
                      </Field>
                      <Field label="Wind Direction (°)">
                        <Input
                          type="number"
                          step="any"
                          className="font-mono text-sm"
                          value={form.wind_direction_deg}
                          onChange={(e) => updateField("wind_direction_deg", e.target.value)}
                          placeholder="180"
                        />
                      </Field>
                      <Field label="Solar GHI (kWh/m²/day)">
                        <Input
                          type="number"
                          step="any"
                          className="font-mono text-sm"
                          value={form.ghi_kwh_m2_day}
                          disabled={!manualOverride && !climateError}
                          onChange={(e) => updateField("ghi_kwh_m2_day", e.target.value)}
                          placeholder="5.4"
                        />
                      </Field>
                      <Field label="Relative Humidity (%)">
                        <Input
                          type="number"
                          step="any"
                          className="font-mono text-sm"
                          value={form.warm_humidity_pct}
                          disabled={!manualOverride && !climateError}
                          onChange={(e) => updateField("warm_humidity_pct", e.target.value)}
                          placeholder="35"
                        />
                      </Field>
                      <Field label="Rainfall Last 7 Days (mm)">
                        <Input
                          type="number"
                          step="any"
                          className="font-mono text-sm"
                          value={form.rain_last_7days_mm}
                          disabled={!manualOverride && !climateError}
                          onChange={(e) => updateField("rain_last_7days_mm", e.target.value)}
                          placeholder="0.0"
                        />
                      </Field>
                    </div>

                    {manualOverride && (
                      <div className="mt-4">
                        <Field label="Hot Air / Climate Index Category">
                          <select
                            className="w-full rounded-none border border-input bg-background p-2 text-xs text-foreground outline-none focus:border-ring"
                            value={form.hot_air_index}
                            onChange={(e) => updateField("hot_air_index", e.target.value)}
                          >
                            {HOT_AIR_INDEX_OPTIONS.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    )}
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
                        Inferring Optimal Envelope Specs...
                      </>
                    ) : (
                      <>
                        <Building2 className="mr-2 h-4 w-4" />
                        Generate Shelter Design Specifications
                      </>
                    )}
                  </Button>
                </form>
              </Card>
            </div>

            {/* Design Synthesis & Benchmark Cockpit (5 cols) */}
            <div className="space-y-6 lg:col-span-5">
              <Card className="rounded-none border-border bg-card shadow-sm">
                <div className="border-b border-border/80 bg-muted/30 px-5 py-3">
                  <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    SYNTHESIS COCKPIT · SPECIFICATION TARGETS
                  </p>
                </div>
                <div className="p-6 space-y-5">
                  <div className="flex items-start gap-3 rounded-none border border-border bg-muted/20 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none border border-accent/40 bg-accent/10 text-accent">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">
                        Ready for XGBoost Envelope Synthesis
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Click any golden preset above or input custom coordinates. The model will infer the optimal vernacular wall construction, thickness, glazing ratio, and insulation.
                      </p>
                    </div>
                  </div>

                  {/* High-Altitude Ladakh Guidelines (IS 3792 / NBC 2016) */}
                  <div className="divide-y divide-border/80 rounded-none border border-border">
                    <div className="flex items-center justify-between p-3 text-xs">
                      <span className="text-muted-foreground">Target Wall Insulation</span>
                      <span className="font-mono font-bold text-success">R ≥ 5.0 m²K/W</span>
                    </div>
                    <div className="flex items-center justify-between p-3 text-xs">
                      <span className="text-muted-foreground">Glazing Recommendation</span>
                      <span className="font-mono font-bold text-foreground">Double Low-E Argon (U ≤ 1.6)</span>
                    </div>
                    <div className="flex items-center justify-between p-3 text-xs">
                      <span className="text-muted-foreground">Solar Aperture Orientation</span>
                      <span className="font-mono font-bold text-foreground">Direct South (180° Azimuth)</span>
                    </div>
                    <div className="flex items-center justify-between p-3 text-xs">
                      <span className="text-muted-foreground">Canonical Prototype</span>
                      <span className="font-mono font-bold text-accent">100 m³ Standard Shelter</span>
                    </div>
                  </div>

                  {/* 4 Trained Vernacular Materials */}
                  <div className="rounded-none border border-border/80 bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
                        Trained Material Spectrum
                      </span>
                      <span className="font-mono text-[10px] text-accent">4 Canonical Types</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-none border border-border/70 bg-card p-2">
                        <p className="font-bold text-foreground">Rammed Earth</p>
                        <p className="font-mono text-[10px] text-muted-foreground">k = 0.9 W/m·K · ₹2,000/m³ (~₹700/m²)</p>
                      </div>
                      <div className="rounded-none border border-border/70 bg-card p-2">
                        <p className="font-bold text-foreground">Mud Brick (Adobe)</p>
                        <p className="font-mono text-[10px] text-muted-foreground">k = 0.6 W/m·K · ₹3,000/m³ (~₹1,050/m²)</p>
                      </div>
                      <div className="rounded-none border border-border/70 bg-card p-2">
                        <p className="font-bold text-foreground">Stone Masonry</p>
                        <p className="font-mono text-[10px] text-muted-foreground">k = 1.8 W/m·K · ₹5,250/m³ (~₹1,838/m²)</p>
                      </div>
                      <div className="rounded-none border border-border/70 bg-card p-2">
                        <p className="font-bold text-foreground">Concrete Wall</p>
                        <p className="font-mono text-[10px] text-muted-foreground">k = 1.4 W/m·K · ₹8,250/m³ (~₹2,888/m²)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : (
          /* Active Results View: Spec Sheet (Left) + Action Cards (Right) -> Full-Width 3D Preview Below */
          <div className="space-y-8">
            {/* Top Two-Column Area */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left Column: Spec Sheet */}
              <Card className="rounded-none border-border bg-card flex flex-col justify-between">
                <div>
                  <div className="border-b border-border bg-muted/30 px-5 py-3">
                    <p className="text-xs font-mono font-semibold uppercase tracking-widest text-muted-foreground">
                      DESIGN SPECIFICATION SHEET
                    </p>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Status Banner */}
                    <div className="flex items-start gap-3 rounded-none border border-border bg-muted/20 p-4">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">
                          Recommended Classification
                        </p>
                        <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                          {prediction.material_name ?? `Design profile class ${prediction.material_class}`}
                        </p>
                      </div>
                    </div>

                    {/* Spec Sheet Table */}
                    <div className="divide-y divide-border rounded-none border border-border">
                      <SpecRow
                        label="Window-to-Wall Ratio (WWR)"
                        value={
                          prediction.wwr != null
                            ? `${(prediction.wwr * 100).toFixed(1)}%`
                            : "15.0%"
                        }
                      />
                      <SpecRow
                        label="Wall Thickness"
                        value={
                          prediction.wall_thickness_cm != null
                            ? `${prediction.wall_thickness_cm} cm`
                            : "55 cm"
                        }
                      />
                      <SpecRow
                        label="Glazing Ratio"
                        value={
                          prediction.glazing_ratio != null
                            ? `${(prediction.glazing_ratio * 100).toFixed(1)}%`
                            : "78.0%"
                        }
                      />
                      <SpecRow
                        label="Insulation R-Value"
                        value={
                          prediction.insulation_r_value != null
                            ? `${prediction.insulation_r_value.toFixed(2)} m²K/W`
                            : "6.20 m²K/W"
                        }
                      />
                    </div>

                    {/* Material Rationale Card ("Why this material?") */}
                    <div className="pt-1">
                      <MaterialRationaleCard
                        material={prediction.material_name ?? "Rammed_Earth"}
                        profile={materialCatalog ? materialCatalog[prediction.material_name ?? "Rammed_Earth"] : undefined}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={() => {
                      setPrediction(null)
                    }}
                  >
                    Edit inputs / try another location
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground">
                    Recommended envelope specification saved to session storage.
                  </p>
                </div>
              </Card>

              {/* Right Column: Three Consolidated Action Cards */}
              <Card className="rounded-none border-border bg-card flex flex-col justify-between">
                <div>
                  <div className="border-b border-border bg-muted/30 px-5 py-3">
                    <p className="text-xs font-mono font-semibold uppercase tracking-widest text-muted-foreground">
                      DOWNSTREAM MODULE PIPELINES
                    </p>
                  </div>

                  <div className="p-6 space-y-3.5">
                    <p className="text-xs text-muted-foreground">
                      Carry this recommended envelope specification directly into downstream physical simulation and energy prediction models:
                    </p>

                    {/* Card 1: Heat Flow Visualizer */}
                    <Link
                      href="/heat-flow"
                      className="group block rounded-none border border-accent/40 bg-accent/10 p-3.5 transition-colors hover:border-accent hover:bg-accent/20"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground group-hover:text-accent">
                          Send this design to Heat Flow Visualizer →
                        </p>
                        <Badge variant="output" className="text-[10px] font-mono">
                          Full 3D Analysis
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Inspect full 24-hour conduction, solar gains, and diurnal heat loss with this envelope.
                      </p>
                    </Link>

                    {/* Card 2: Thermal Energy Prediction */}
                    <Link
                      href="/thermal-energy"
                      className="group block rounded-none border border-border bg-muted/20 p-3.5 transition-colors hover:border-accent hover:bg-muted/40"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground group-hover:text-accent">
                          Send this design to Thermal Energy Prediction →
                        </p>
                        <Badge variant="input" className="text-[10px] font-mono">
                          XGBoost Regressor
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Estimate annual heating demand (kWh) and winter fuel needs with verified XGBoost Regressor.
                      </p>
                    </Link>

                    {/* Card 3: NSGA-II Optimizer */}
                    <Link
                      href="/dashboard"
                      className="group block rounded-none border border-border bg-muted/10 p-3.5 transition-colors hover:border-accent hover:bg-muted/30"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-foreground group-hover:text-accent">
                          Send this design to NSGA-II Optimizer →
                        </p>
                        <Badge variant="output" className="text-[10px] font-mono">
                          NSGA-II Optimizer
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] font-mono text-muted-foreground">
                        Explore multi-objective Pareto trade-offs for comfort, heating energy, and cost.
                      </p>
                    </Link>
                  </div>
                </div>

                <div className="p-6 pt-0">
                  <div className="rounded-none border border-border bg-muted/10 px-3 py-2 text-[11px] font-mono text-muted-foreground">
                    Location: {form.latitude}°N, {form.longitude}°E · Ambient: {form.ambient_temp_c || "-6"}°C
                  </div>
                </div>
              </Card>
            </div>

            {/* Full-Width Section Below: Shared 3D Shelter Preview */}
                  {embeddedPreview && (
              <div className="mt-8 space-y-3">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent animate-pulse" />
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Recommended Shelter Preview
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="input" className="font-mono text-[11px]">
                      100 m³ · {prediction.material_name ?? "Rammed_Earth"}
                    </Badge>
                    <Badge variant="output" className="font-mono text-[11px]">
                      {embeddedPreview.geometry.length_m}m(L) × {embeddedPreview.geometry.width_m}m(W) × {embeddedPreview.geometry.wall_height_m}m(H)
                    </Badge>
                  </div>
                </div>
                <div className="relative w-full overflow-hidden rounded-none border border-border bg-card shadow-sm">
                  <Dynamic3DView
                    geometry={embeddedPreview.geometry}
                    uValues={embeddedPreview.u_values}
                    currentPoint={embeddedPreview.hourly_data[12]}
                    hourlyData={embeddedPreview.hourly_data}
                    wallMaterial={prediction.material_name ?? "Rammed_Earth"}
                    className="h-[520px] sm:h-[580px] w-full"
                  />
                </div>
                    </div>
                  )}
          </div>
        )}
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

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="data-value text-xs font-bold text-foreground">{value}</span>
    </div>
  )
}
