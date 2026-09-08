"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Thermometer,
  AlertCircle,
  CheckCircle2,
  CloudSun,
} from "lucide-react"

import {
  predictIndoorTemp,
  type IndoorTempRequest,
} from "@/lib/api"
import { useClimateAutoFill } from "@/hooks/useClimateAutoFill"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { COMFORT_BASIS, COMFORT_LOWER_BOUND_C } from "@/lib/constants"

type FormState = {
  latitude: string
  longitude: string
  outdoor_temperature_C: string
  wind_speed_mps: string
  thermal_mass_MJ_m3K: string
  insulation_r_value_m2K_W: string
  glazing: string
  GHI_W_m2: string
  best_shelter_material: string
}

const initialForm: FormState = {
  latitude: "34.16",
  longitude: "77.58",
  outdoor_temperature_C: "",
  wind_speed_mps: "",
  thermal_mass_MJ_m3K: "2.2",
  insulation_r_value_m2K_W: "5.2",
  glazing: "0.25",
  GHI_W_m2: "",
  best_shelter_material:
    "Stabilized Rammed Earth + Straw-Clay cavity insulation; south Trombe wall with double low-E glazing",
}

const MATERIAL_OPTIONS = [
  "Stabilized Rammed Earth + Straw-Clay cavity insulation; south Trombe wall with double low-E glazing",
  "High-thermal-mass adobe walls with deep window overhangs for shading; active night-purge cross ventilation",
  "Sun-dried adobe bricks with 10cm straw-clay exterior jacket insulation and direct solar-gain south windows",
  "Super-insulated Rammed Earth (straw/clay cavity) + unvented Trombe wall & insulated thermal shutter",
  "Rammed earth thermal mass with adjustable cross-ventilation flaps and external fabric solar shading",
]

function getComfortStatus(temperature: number) {
  if (temperature < COMFORT_LOWER_BOUND_C - 4) {
    return {
      label: "Cold (Heating Deficit)",
      color: "text-danger",
      badgeVariant: "danger" as const,
      description:
        `Predicted temperature is below the ${COMFORT_LOWER_BOUND_C.toFixed(1)}°C comfort threshold. Auxiliary solar gain or thermal shutters recommended.`,
      percentage: Math.max(0, Math.min(100, ((temperature - (-10)) / 40) * 100)),
    }
  }

  if (temperature < COMFORT_LOWER_BOUND_C) {
    return {
      label: "Cool (Borderline)",
      color: "text-warning",
      badgeVariant: "warning" as const,
      description:
        "Slightly cool for sedentary occupancy. Night-time thermal mass insulation will maintain livable conditions.",
      percentage: Math.max(0, Math.min(100, ((temperature - (-10)) / 40) * 100)),
    }
  }

  if (temperature >= COMFORT_LOWER_BOUND_C) {
    return {
      label: "Optimal Comfort Zone",
      color: "text-success",
      badgeVariant: "success" as const,
      description:
        `Meets the ${COMFORT_LOWER_BOUND_C.toFixed(1)}°C lower comfort bound defined by ${COMFORT_BASIS}.`,
      percentage: Math.max(0, Math.min(100, ((temperature - (-10)) / 40) * 100)),
    }
  }

  return null
}

function optionalNumber(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value)
}

export default function IndoorTemperaturePage() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<number | null>(null)

  function updateField(field: keyof FormState, value: string) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const { manualOverride, setManualOverride, climateLoading, climateError, climateSynced } = useClimateAutoFill({
    latitude: form.latitude,
    longitude: form.longitude,
    toFields: (climate) => ({
      outdoor_temperature_C: String(climate.ambient_temp_c),
      wind_speed_mps: String(climate.wind_speed_ms),
      GHI_W_m2: String(Math.round((climate.ghi_kwh_m2_day * 1000) / 24)),
    }),
    onFields: (fields) => setForm((previous) => ({ ...previous, ...fields })),
  })

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
    const month = 1
    const hour = 12
    const thermalMass = Number(form.thermal_mass_MJ_m3K)
    const insulation = Number(form.insulation_r_value_m2K_W)
    const glazing = Number(form.glazing)
    const outdoor = optionalNumber(form.outdoor_temperature_C)
    const wind = optionalNumber(form.wind_speed_mps)
    const ghi = optionalNumber(form.GHI_W_m2)

    if (!form.latitude || !form.longitude || !form.thermal_mass_MJ_m3K || !form.insulation_r_value_m2K_W || !form.glazing || !form.best_shelter_material) {
      setError("Please complete all required fields before running the model.")
      return
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError("Enter a valid latitude (-90 to 90) and longitude (-180 to 180).")
      return
    }
    if (!Number.isFinite(thermalMass) || thermalMass <= 0 || !Number.isFinite(insulation) || insulation < 0 || !Number.isFinite(glazing) || glazing < 0 || glazing > 1) {
      setError("Check the envelope values: thermal mass must be positive, insulation non-negative, and glazing must be between 0 and 1.")
      return
    }
    if ((outdoor !== undefined && !Number.isFinite(outdoor)) || (wind !== undefined && (!Number.isFinite(wind) || wind < 0)) || (ghi !== undefined && (!Number.isFinite(ghi) || ghi < 0))) {
      setError("Check the climate values: wind speed and GHI cannot be negative.")
      return
    }

    const request: IndoorTempRequest = {
      latitude,
      longitude,
      month,
      hour,
      thermal_mass_MJ_m3K: thermalMass,
      insulation_r_value_m2K_W: insulation,
      glazing,
      best_shelter_material: form.best_shelter_material,
      outdoor_temperature_C: outdoor,
      wind_speed_mps: wind,
      GHI_W_m2: ghi,
    }

    try {
      setLoading(true)
      const response = await predictIndoorTemp(request)
      setResult(response.indoor_temperature_C)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Prediction failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const comfort = result !== null ? getComfortStatus(result) : null

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Navigation & Header */}
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
                <Thermometer className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Indoor Temperature Prediction
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  XGBoost regression for 24h indoor thermal comfort in cold-climate Ladakh shelters.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Form Card */}
          <Card className="rounded-none border-border bg-card p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Location & NASA Climate */}
              <div>
                <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    1. Geolocation &amp; Climate Auto-Fill
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
                    <span>NASA POWER climate data successfully synced for coordinates.</span>
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

              {/* Environmental In-Situ */}
              <div>
                <div className="mb-3 border-b border-border pb-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    3. Ambient Environment (Auto-Filled)
                  </h2>
                </div>
                <label className="mb-4 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={manualOverride} onChange={(e) => setManualOverride(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />Add environmental details manually</label>
                {climateLoading && <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Fetching climate data...</div>}
                {climateError && <div className="mb-3 flex items-center gap-2 border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"><AlertCircle className="h-3.5 w-3.5" />{climateError}</div>}
                {climateSynced && !climateLoading && !climateError && <div className="mb-3 flex items-center gap-2 text-xs text-success"><CloudSun className="h-3.5 w-3.5" />NASA POWER values synced for these coordinates.</div>}
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Outdoor Temp (°C)">
                    <Input
                      type="number"
                      step="any"
                      className="font-mono text-sm"
                      value={form.outdoor_temperature_C}
                      disabled={!manualOverride && !climateError}
                      onChange={(e) => updateField("outdoor_temperature_C", e.target.value)}
                    />
                  </Field>
                  <Field label="Wind Speed (m/s)">
                    <Input
                      type="number"
                      step="any"
                      className="font-mono text-sm"
                      value={form.wind_speed_mps}
                      disabled={!manualOverride && !climateError}
                      onChange={(e) => updateField("wind_speed_mps", e.target.value)}
                    />
                  </Field>
                  <Field label="Solar GHI (W/m²)">
                    <Input
                      type="number"
                      step="any"
                      className="font-mono text-sm"
                      value={form.GHI_W_m2}
                      disabled={!manualOverride && !climateError}
                      onChange={(e) => updateField("GHI_W_m2", e.target.value)}
                    />
                  </Field>
                </div>
              </div>

              {/* Envelope Specifications */}
              <div>
                <div className="mb-3 border-b border-border pb-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    4. Envelope &amp; Material Construction
                  </h2>
                </div>

                <div className="space-y-4">
                  <Field label="Best Shelter Material Class" required>
                    <select
                      className="w-full rounded-none border border-input bg-background p-2 text-xs text-foreground outline-none focus:border-ring"
                      value={form.best_shelter_material}
                      onChange={(e) => updateField("best_shelter_material", e.target.value)}
                    >
                      {MATERIAL_OPTIONS.map((mat) => (
                        <option key={mat} value={mat}>
                          {mat}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Thermal Mass (MJ/m³K)" required>
                      <Input
                        type="number"
                        step="any"
                        className="font-mono text-sm"
                        value={form.thermal_mass_MJ_m3K}
                        onChange={(e) => updateField("thermal_mass_MJ_m3K", e.target.value)}
                      />
                    </Field>
                    <Field label="Insulation R-Value" required>
                      <Input
                        type="number"
                        step="any"
                        className="font-mono text-sm"
                        value={form.insulation_r_value_m2K_W}
                        onChange={(e) => updateField("insulation_r_value_m2K_W", e.target.value)}
                      />
                    </Field>
                    <Field label="Glazing Ratio (0-1)" required>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        className="font-mono text-sm"
                        value={form.glazing}
                        onChange={(e) => updateField("glazing", e.target.value)}
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

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Model Inference...
                  </>
                ) : (
                  <>
                    <Thermometer className="mr-2 h-4 w-4" />
                    Predict Indoor Temperature
                  </>
                )}
              </Button>
            </form>
          </Card>

          {/* Prediction Result Display */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Card className="rounded-none border-border bg-card">
              <div className="border-b border-border bg-muted/30 px-5 py-3">
                <p className="text-xs font-mono font-semibold uppercase tracking-widest text-muted-foreground">
                  PREDICTION OUTPUT
                </p>
              </div>

              {result === null ? (
                <div className="flex min-h-[380px] flex-col items-center justify-center p-8 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-none border border-border bg-muted">
                    <Thermometer className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Awaiting Execution</h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Submit the shelter parameters to view predicted indoor temperature and comfort band analysis.
                  </p>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Big Number */}
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Predicted Indoor Temperature
                    </p>
                    <div className="mt-2 flex items-baseline justify-center">
                      <span className="data-value text-6xl font-bold tracking-tight text-foreground">
                        {result.toFixed(1)}
                      </span>
                      <span className="ml-1 text-2xl font-mono text-muted-foreground">°C</span>
                    </div>
                  </div>

                  {/* Comfort Band Gauge Visualization */}
                  <div className="space-y-2 rounded-none border border-border bg-background p-4">
                    <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                      <span>COMFORT BAND GAUGE</span>
                      <span className={comfort?.color}>{comfort?.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Comfort basis: {COMFORT_BASIS}; lower bound {COMFORT_LOWER_BOUND_C.toFixed(1)}°C
                    </p>

                    {/* Gradient Bar */}
                    <div className="relative h-3 w-full rounded-none bg-gradient-to-r from-danger via-warning via-success to-accent">
                      {/* Position Pin */}
                      <div
                        className="absolute -top-1 h-5 w-1.5 -translate-x-1/2 bg-foreground ring-2 ring-background transition-all duration-300"
                        style={{ left: `${comfort?.percentage}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground/80 pt-1">
                      <span>-10°C (Freeze)</span>
                      <span>{COMFORT_LOWER_BOUND_C.toFixed(1)}°C+ (Comfort)</span>
                      <span>30°C</span>
                    </div>
                  </div>

                  {/* Comfort Details */}
                  <div className="rounded-none border border-border bg-muted/20 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                      <span className="text-xs font-semibold text-foreground">Comfort Assessment</span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {comfort?.description}
                    </p>
                  </div>

                  <div className="border-t border-border pt-4 text-center">
                    <Button type="button" variant="outline" size="sm" onClick={() => setResult(null)}>
                      Edit inputs / try another location
                    </Button>
                    <Link
                      href={`/dashboard?outdoor_temp_c=${form.outdoor_temperature_C}`}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-accent hover:underline"
                    >
                      Compare in Results Dashboard →
                    </Link>
                  </div>
                </div>
              )}
            </Card>
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
