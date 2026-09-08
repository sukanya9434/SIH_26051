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
  ShieldAlert,
  Flame,
  Zap,
  Layers,
  Sparkles,
  Compass,
} from "lucide-react"

import {
  predictIndoorTemp,
  type IndoorTempRequest,
} from "@/lib/api"
import { useClimateAutoFill } from "@/hooks/useClimateAutoFill"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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

const GOLDEN_PRESETS = [
  { name: "Leh", lat: "34.16", lon: "77.58", elev: "3,500m", note: "-6°C Standard" },
  { name: "Kargil", lat: "34.55", lon: "76.13", elev: "2,676m", note: "-10°C Deep Valley" },
  { name: "Nyoma", lat: "33.20", lon: "78.67", elev: "4,180m", note: "-18°C High Plateau" },
  { name: "Diskit Nubra", lat: "34.57", lon: "77.56", elev: "3,048m", note: "+5°C Solar Oasis" },
  { name: "Drass", lat: "34.43", lon: "75.75", elev: "3,280m", note: "-25°C Sub-Zero Cold" },
]

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

  function applyPreset(preset: (typeof GOLDEN_PRESETS)[number]) {
    setForm((prev) => ({
      ...prev,
      latitude: preset.lat,
      longitude: preset.lon,
    }))
    setResult(null)
  }

  async function useMyLocation() {
    setError("")
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.")
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
        setError("Unable to retrieve your location. Select a golden Ladakh preset above.")
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    )
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setResult(null)

    const values = {
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      outdoor: optionalNumber(form.outdoor_temperature_C),
      wind: optionalNumber(form.wind_speed_mps),
      thermalMass: Number(form.thermal_mass_MJ_m3K),
      insulation: Number(form.insulation_r_value_m2K_W),
      glazing: Number(form.glazing),
      ghi: optionalNumber(form.GHI_W_m2),
    }

    if (!Number.isFinite(values.latitude) || values.latitude < -90 || values.latitude > 90 || !Number.isFinite(values.longitude) || values.longitude < -180 || values.longitude > 180) {
      setError("Enter a valid latitude (-90 to 90) and longitude (-180 to 180).")
      return
    }

    if (!Number.isFinite(values.thermalMass) || values.thermalMass <= 0 || !Number.isFinite(values.insulation) || values.insulation <= 0 || !Number.isFinite(values.glazing) || values.glazing < 0 || values.glazing > 1) {
      setError("Thermal mass and insulation R-value must be positive numbers; glazing ratio must be between 0 and 1.")
      return
    }

    if (values.outdoor !== undefined && !Number.isFinite(values.outdoor)) {
      setError("Outdoor temperature must be a valid number.")
      return
    }

    if (values.wind !== undefined && (!Number.isFinite(values.wind) || values.wind < 0)) {
      setError("Wind speed cannot be negative.")
      return
    }

    if (values.ghi !== undefined && (!Number.isFinite(values.ghi) || values.ghi < 0)) {
      setError("Solar GHI cannot be negative.")
      return
    }

    const request: IndoorTempRequest = {
      latitude: values.latitude,
      longitude: values.longitude,
      month: 1,
      hour: 12,
      outdoor_temperature_C: values.outdoor,
      wind_speed_mps: values.wind,
      thermal_mass_MJ_m3K: values.thermalMass,
      insulation_r_value_m2K_W: values.insulation,
      glazing: values.glazing,
      GHI_W_m2: values.ghi,
      best_shelter_material: form.best_shelter_material,
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
  const outdoorTempNum = Number(form.outdoor_temperature_C) || -6
  const tempDelta = result !== null ? (result - outdoorTempNum) : null

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
                  ◆ WORKSPACE 02 · PREDICTIVE ML INFERENCING ◆
                </span>
              </div>
              <h1 className="mt-1 font-cinzel text-3xl font-bold tracking-wide text-foreground sm:text-4xl lg:text-5xl">
                Indoor Temperature Forecaster
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Sub-zero climate diurnal comfort prediction with calibrated XGBoost regression trained on high-altitude atmospheric parameters, solar irradiance, and envelope thermal inertia.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="input" className="font-mono text-xs">
                LADAKH REGION · 3,500m
              </Badge>
              <Badge variant="output" className="font-mono text-xs">
                XGBREGRESSOR R² = 0.993
              </Badge>
              <Badge variant="default" className="border border-border font-mono text-xs">
                COMFORT TARGET: 19.6°C
              </Badge>
            </div>
          </div>
        </div>

        {/* Golden Presets Strip: Fills Horizontal Space Beautifully */}
        <div className="mb-8 rounded-none border border-border bg-card/60 p-4 backdrop-blur-sm">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ⚡ High-Altitude Ladakh Reference Presets (Instant Auto-Fill)
            </span>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              Click any region to sync coordinates &amp; climate parameters
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

        {/* Main Grid: Expansive 2-Column Command Deck */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: Input Form Deck (7 cols) */}
          <div className="space-y-6 lg:col-span-7">
            <Card className="rounded-none border-border bg-card p-6 shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 1. Geolocation & NASA Climate */}
                <div>
                  <div className="mb-3 flex items-center justify-between border-b border-border/80 pb-2">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <MapPin size={14} className="text-accent" />
                      1. Geolocation &amp; Climate Auto-Fill
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
                        <Compass className="mr-1.5 h-3 w-3 text-accent" />
                      )}
                      Use GPS + NASA POWER
                    </Button>
                  </div>

                  {climateSynced && (
                    <div className="mb-4 flex items-center gap-2 border border-success/40 bg-success/10 px-3.5 py-2.5 text-xs text-success">
                      <CloudSun className="h-4 w-4 shrink-0" />
                      <span>NASA POWER satellite climate data successfully synced for these coordinates.</span>
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

                {/* 2. Ambient Environment */}
                <div>
                  <div className="mb-3 border-b border-border/80 pb-2">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <CloudSun size={14} className="text-accent" />
                      2. Ambient Environment Metrics (In-Situ)
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
                      Fetching real-time NASA POWER climate data...
                    </div>
                  )}
                  {climateError && (
                    <div className="mb-3 flex items-center gap-2 border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {climateError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Outdoor Temp (°C)">
                      <Input
                        type="number"
                        step="any"
                        className="font-mono text-sm"
                        value={form.outdoor_temperature_C}
                        disabled={!manualOverride && !climateError}
                        onChange={(e) => updateField("outdoor_temperature_C", e.target.value)}
                        placeholder="-6.0"
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
                        placeholder="3.2"
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
                        placeholder="450"
                      />
                    </Field>
                  </div>
                </div>

                {/* 3. Envelope Construction */}
                <div>
                  <div className="mb-3 border-b border-border/80 pb-2">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Layers size={14} className="text-accent" />
                      3. Envelope &amp; Material Construction
                    </h2>
                  </div>

                  <div className="space-y-4">
                    <Field label="Best Shelter Material & Architectural Strategy" required>
                      <select
                        className="w-full rounded-none border border-border bg-input px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                        value={form.best_shelter_material}
                        onChange={(e) => updateField("best_shelter_material", e.target.value)}
                      >
                        {MATERIAL_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Field label="Thermal Mass (MJ/m³·K)" required>
                        <Input
                          type="number"
                          step="0.1"
                          className="font-mono text-sm"
                          value={form.thermal_mass_MJ_m3K}
                          onChange={(e) => updateField("thermal_mass_MJ_m3K", e.target.value)}
                        />
                      </Field>
                      <Field label="Insulation R-Value (m²K/W)" required>
                        <Input
                          type="number"
                          step="0.1"
                          className="font-mono text-sm"
                          value={form.insulation_r_value_m2K_W}
                          onChange={(e) => updateField("insulation_r_value_m2K_W", e.target.value)}
                        />
                      </Field>
                      <Field label="Glazing Ratio (0.0 - 1.0)" required>
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
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full bg-accent text-white font-semibold shadow-md hover:bg-accent/90"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Inferencing XGBoost Comfort Regressor...
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
          </div>

          {/* Right Column: High-Density Telemetry & Output Cockpit (5 cols) */}
          <div className="space-y-6 lg:col-span-5">
            <Card className="rounded-none border-border bg-card shadow-sm">
              <div className="border-b border-border/80 bg-muted/30 px-5 py-3">
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  PREDICTION COCKPIT · THERMAL COMFORT
                </p>
              </div>

              {result === null ? (
                /* Awaiting Execution State: Rich Architectural Information Deck */
                <div className="p-6 space-y-5">
                  <div className="flex items-start gap-3 rounded-none border border-border bg-muted/20 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none border border-accent/40 bg-accent/10 text-accent">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">
                        Ready for High-Altitude Simulation
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Select a location preset above or enter customized coordinates, then click Predict to compute 24-hour interior thermal stability.
                      </p>
                    </div>
                  </div>

                  {/* Benchmark Targets */}
                  <div className="divide-y divide-border/80 rounded-none border border-border">
                    <div className="flex items-center justify-between p-3 text-xs">
                      <span className="text-muted-foreground">Standard Target Comfort</span>
                      <span className="font-mono font-bold text-success">19.6°C (ISHRAE / NBC)</span>
                    </div>
                    <div className="flex items-center justify-between p-3 text-xs">
                      <span className="text-muted-foreground">Extreme Design Ambient</span>
                      <span className="font-mono font-bold text-foreground">-25.0°C to -6.0°C</span>
                    </div>
                    <div className="flex items-center justify-between p-3 text-xs">
                      <span className="text-muted-foreground">Active Thermal Mass</span>
                      <span className="font-mono font-bold text-foreground">{form.thermal_mass_MJ_m3K} MJ/m³·K</span>
                    </div>
                    <div className="flex items-center justify-between p-3 text-xs">
                      <span className="text-muted-foreground">Envelope Insulation R-Value</span>
                      <span className="font-mono font-bold text-foreground">{form.insulation_r_value_m2K_W} m²K/W</span>
                    </div>
                    <div className="flex items-center justify-between p-3 text-xs">
                      <span className="text-muted-foreground">Window-to-Wall Ratio</span>
                      <span className="font-mono font-bold text-foreground">{(Number(form.glazing) * 100).toFixed(0)}% South Glazing</span>
                    </div>
                  </div>

                  {/* Physics Insight Box */}
                  <div className="rounded-none border border-border/70 bg-muted/30 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Flame size={14} className="text-accent" />
                      <span>Diurnal Thermal Inertia Physics</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      In high-altitude Ladakh, dense stone and rammed earth walls store solar heat during intense midday sun (+400 to +800 W/m²) and slowly release it inward across freezing sub-zero nights.
                    </p>
                  </div>
                </div>
              ) : (
                /* Result State: Grand Engineering Readout */
                <div className="p-6 space-y-6">
                  {/* Big Number Readout */}
                  <div className="rounded-none border border-border bg-gradient-to-b from-card to-muted/20 p-6 text-center">
                    <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      Predicted 24h Indoor Temperature
                    </p>
                    <div className="mt-2 flex items-baseline justify-center">
                      <span className="font-mono text-6xl font-bold tracking-tight text-foreground">
                        {result.toFixed(1)}
                      </span>
                      <span className="ml-1 font-mono text-2xl text-muted-foreground">°C</span>
                    </div>
                    {tempDelta !== null && (
                      <div className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-accent">
                        <Flame size={13} />
                        <span>+{tempDelta.toFixed(1)}°C warmer than outdoor ambient ({outdoorTempNum}°C)</span>
                      </div>
                    )}
                  </div>

                  {/* Comfort Band Gauge Visualization */}
                  <div className="space-y-2 rounded-none border border-border bg-card p-4">
                    <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
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

                    <div className="flex justify-between font-mono text-[10px] text-muted-foreground/80 pt-1">
                      <span>-10°C (Extreme Freeze)</span>
                      <span>{COMFORT_LOWER_BOUND_C.toFixed(1)}°C (Comfort Target)</span>
                      <span>+30°C</span>
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

                  {/* Action Buttons */}
                  <div className="space-y-2 border-t border-border/80 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setResult(null)}
                    >
                      Edit parameters / test another region
                    </Button>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Link
                        href={`/thermal-energy`}
                        className="flex items-center justify-center rounded-none border border-border bg-muted/30 p-2 text-center font-mono text-[11px] text-foreground hover:border-accent hover:text-accent"
                      >
                        Heating Demand →
                      </Link>
                      <Link
                        href={`/dashboard?outdoor_temp_c=${outdoorTempNum}`}
                        className="flex items-center justify-center rounded-none border border-border bg-muted/30 p-2 text-center font-mono text-[11px] text-foreground hover:border-accent hover:text-accent"
                      >
                        Dashboard Cockpit →
                      </Link>
                    </div>
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
