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
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2 text-xs font-mono text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            BACK TO OVERVIEW
          </Link>

          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-none border border-border bg-card">
                <Building2 className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Passive Shelter Design Classifier
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  XGBoost multi-class classifier predicting optimal building envelope geometry and materials.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Conditional Layout: Form & Placeholder OR Results & Full-Width 3D Model */}
        {prediction === null ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            {/* Form */}
            <Card className="rounded-none border-border bg-card p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Location & NASA Climate */}
                <div>
                  <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      1. Coordinates &amp; NASA POWER Sync
                    </h2>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={useMyLocation}
                      disabled={locationLoading}
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
                    <div className="mb-4 flex items-center gap-2 border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
                      <CloudSun className="h-4 w-4" />
                      <span>NASA POWER climate data synced for coordinates.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="mb-3 border-b border-border pb-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      2. Regional Environmental Conditions
                    </h2>
                  </div>

                  <label className="mb-4 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={manualOverride} onChange={(e) => setManualOverride(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />Add environmental details manually</label>
                  {climateLoading && <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Fetching climate data...</div>}
                  {climateError && <div className="mb-3 flex items-center gap-2 border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"><AlertCircle className="h-3.5 w-3.5" />{climateError}</div>}
                  {climateSynced && !climateLoading && !climateError && <div className="mb-3 flex items-center gap-2 text-xs text-success"><CloudSun className="h-3.5 w-3.5" />NASA POWER values synced for these coordinates.</div>}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Ambient Temp (°C)">
                      <Input
                        type="number"
                        step="any"
                        className="font-mono text-sm"
                      value={form.ambient_temp_c}
                      disabled={!manualOverride && !climateError}
                        onChange={(e) => updateField("ambient_temp_c", e.target.value)}
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
                      />
                    </Field>
                    <Field label="Wind Direction (°)">
                      <Input
                        type="number"
                        step="any"
                        className="font-mono text-sm"
                        value={form.wind_direction_deg}
                        onChange={(e) => updateField("wind_direction_deg", e.target.value)}
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
                      />
                    </Field>
                  </div>

                  {manualOverride && <div className="mt-4">
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
                  </div>}
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

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
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

            {/* Placeholder Specification Sheet */}
            <div className="lg:sticky lg:top-6 lg:self-start">
              <Card className="rounded-none border-border bg-card">
                <div className="border-b border-border bg-muted/30 px-5 py-3">
                  <p className="text-xs font-mono font-semibold uppercase tracking-widest text-muted-foreground">
                    DESIGN SPECIFICATION SHEET
                  </p>
                </div>
                <div className="flex min-h-[380px] flex-col items-center justify-center p-8 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-none border border-border bg-muted">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">No Specification Generated</h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Submit the form or click a preset to predict material class, wall thickness, glazing ratio, and thermal R-value.
                  </p>
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

                  {materialCatalog && (
                    <MaterialRationaleCard
                      material={prediction.material_name ?? "Rammed_Earth"}
                      profile={materialCatalog[prediction.material_name ?? "Rammed_Earth"]}
                    />
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
