"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Flame,
  Layers,
  Loader2,
  RefreshCw,
  Sliders,
  Sun,
  Zap,
} from "lucide-react";
import {
  predictHeatFlow,
  HeatFlowRequest,
  HeatFlowResponse,
  HourlyHeatFlowPoint,
  generateClientFallback,
} from "@/lib/api/heat-flow";
import { Dynamic3DView } from "@/components/heat-flow/Dynamic3DView";
import { TimeScrubber } from "@/components/heat-flow/TimeScrubber";
import { HeatFlowChart } from "@/components/heat-flow/HeatFlowChart";
import { Badge } from "@/components/ui/badge";
import { CANONICAL_WALL_MATERIALS, WALL_MATERIALS } from "@/lib/materials";

const PRESET_OPTIONS = [
  {
    id: "Leh",
    name: "Leh (Capital)",
    subtitle: "Stone · R=3.0 · Vol 100m³",
    lat: 34.16,
    lon: 77.58,
    material: "Stone",
    thickness: 30,
    rValue: 3.0,
    glazing: 0.25,
    volume: 100,
    ambient: -6.0,
  },
  {
    id: "Dras",
    name: "Dras (Extreme Sub-Zero)",
    subtitle: "Concrete · R=6.0 · Vol 100m³",
    lat: 34.43,
    lon: 75.76,
    material: "Concrete",
    thickness: 45,
    rValue: 6.0,
    glazing: 0.20,
    volume: 100,
    ambient: -14.0,
  },
  {
    id: "Kargil",
    name: "Kargil (Solar Gain)",
    subtitle: "Rammed Earth · R=4.5 · Vol 120m³",
    lat: 34.55,
    lon: 76.13,
    material: "Rammed_Earth",
    thickness: 40,
    rValue: 4.5,
    glazing: 0.30,
    volume: 120,
    ambient: -8.0,
  },
];

const DEFAULT_HEAT_FLOW_PARAMS: HeatFlowRequest = {
  latitude: 34.16,
  longitude: 77.58,
  month: 1,
  day: 15,
  volume_m3: 100.0,
  wall_material: "Stone",
  wall_thickness_cm: 30.0,
  insulation_r_value: 3.0,
  glazing_ratio: 0.25,
  occupancy: 4,
  heater_power_kw: 0.0,
  ambient_temp_c: -6.0,
};

export default function HeatFlowPage() {
  const [selectedHour, setSelectedHour] = useState(12); // Default to Solar Noon

  // Parameters form state
  const [params, setParams] = useState<HeatFlowRequest>(DEFAULT_HEAT_FLOW_PARAMS);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HeatFlowResponse | null>(null);

  const fetchHeatFlow = useCallback(async (req: HeatFlowRequest) => {
    setLoading(true);
    try {
      const res = await predictHeatFlow(req);
      setData(res);
      sessionStorage.setItem("heat-flow-response", JSON.stringify(res));
    } catch (err: unknown) {
      console.warn("Backend unavailable, using client fallback:", err);
      const fallback = generateClientFallback(req);
      setData(fallback);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load & prefill check
  useEffect(() => {
    let ignore = false;
    let initialReq = DEFAULT_HEAT_FLOW_PARAMS;
    try {
      const stored = sessionStorage.getItem("thermal-design-result");
      if (stored) {
        const design = JSON.parse(stored);
        if (design.wall_thickness_cm) {
          initialReq = {
            ...DEFAULT_HEAT_FLOW_PARAMS,
            wall_material: design.material_name ?? DEFAULT_HEAT_FLOW_PARAMS.wall_material,
            wall_thickness_cm: Number(design.wall_thickness_cm) || DEFAULT_HEAT_FLOW_PARAMS.wall_thickness_cm,
            glazing_ratio: Number(design.glazing_ratio) || DEFAULT_HEAT_FLOW_PARAMS.glazing_ratio,
            insulation_r_value: Number(design.insulation_r_value) || DEFAULT_HEAT_FLOW_PARAMS.insulation_r_value,
          };
        }
      }
    } catch {
      // ignore invalid json or storage access
    }

    const timer = setTimeout(() => {
      if (!ignore) {
        setParams(initialReq);
        fetchHeatFlow(initialReq);
      }
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [fetchHeatFlow]);

  const handleParamChange = (field: keyof HeatFlowRequest, value: string | number) => {
    setParams((prev) => ({
      ...prev,
      [field]: typeof value === "string" ? value : Number(value),
    }));
  };

  const handleSubmitParams = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHeatFlow(params);
  };

  const currentHourPoint: HourlyHeatFlowPoint = data?.hourly_data[selectedHour] ?? {
    hour: selectedHour,
    sun_elevation_deg: 32.5,
    sun_azimuth_deg: 172.0,
    is_sun_up: true,
    ghi_w_m2: 550,
    ambient_temp_c: -6.0,
    indoor_temp_c: 18.5,
    delta_t_k: 24.5,
    q_walls_w: 430.0,
    q_glazing_w: 245.0,
    q_roof_w: 480.0,
    q_floor_w: 180.0,
    q_total_w: 1335.0,
    heat_flow_direction: "loss" as const,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-12 z-30 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-none border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft size={13} />
              <span>Back to Home</span>
            </Link>
            <div className="hidden h-4 w-[1px] bg-border sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
                  Heat Flow &amp; 3D Shelter Visualizer
                </h1>
                <Badge variant="default" className="border border-accent/40 text-accent text-[10px]">
                  Climate performance
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Building envelope conduction ($Q = U \cdot A \cdot \Delta T$) &amp; real-sun tracking
              </p>
            </div>
          </div>

        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* ── Summary KPI Banner ── */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-none border border-[#A63D2F]/30 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Peak Heat Loss</span>
              <Flame size={15} className="text-[#A63D2F]" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-[#A63D2F]">
              {data ? `${data.summary.peak_heat_loss_w.toLocaleString()} W` : "---"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Occurs at {data ? `${data.summary.peak_heat_loss_hour < 10 ? `0${data.summary.peak_heat_loss_hour}` : data.summary.peak_heat_loss_hour}:00 IST` : "---"}
            </p>
          </div>

          <div className="rounded-none border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">24h Total Loss</span>
              <Zap size={15} className="text-[#B87326]" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-foreground">
              {data ? `${data.summary.total_heat_loss_kwh} kWh` : "---"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Cumulative envelope loss
            </p>
          </div>

          <div className="rounded-none border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Solar Passive Gain</span>
              <Sun size={15} className="text-[#B87326]" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-[#B87326]">
              {data ? `${data.summary.total_solar_gain_kwh} kWh` : "---"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              South window aperture gain
            </p>
          </div>

          <div className="rounded-none border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Envelope U-Values</span>
              <Layers size={15} className="text-[#4A6D88]" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-[#4A6D88]">
              {data ? `${data.u_values.u_wall} W/m²K` : "---"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Wall · Roof: {data ? `${data.u_values.u_roof}` : "—"} · Glaze: {data ? `${data.u_values.u_glazing}` : "2.8"} · Floor: {data ? `${data.u_values.u_floor}` : "—"}
            </p>
          </div>
        </div>

        {/* ── Main Two-Column Layout ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ── Left Column: 3D Scene + Time Scrubber (7 cols) ── */}
          <div className="space-y-4 lg:col-span-7">
            {/* 3D Visualizer Canvas */}
            {data ? (
              <Dynamic3DView
                geometry={data.geometry}
                uValues={data.u_values}
                currentPoint={currentHourPoint}
                hourlyData={data.hourly_data}
                wallMaterial={params.wall_material}
              />
            ) : (
              <div className="flex h-[480px] w-full items-center justify-center rounded-none border border-border bg-card">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
              </div>
            )}

            {/* Time Scrubber (0 - 23 hours slider + live badges) */}
            <TimeScrubber
              selectedHour={selectedHour}
              onSelectHour={setSelectedHour}
              currentPoint={currentHourPoint}
            />

            {/* Geometry Specification Card */}
            {data && (
              <div className="rounded-none border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Parametric Shelter Geometry (Derived from Volume)
                  </h3>
                  <Badge variant="default" className="border border-border text-xs">
                    V = {data.geometry.volume_m3} m³
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
                  <div className="rounded-none bg-muted/40 p-2">
                    <span className="text-muted-foreground block text-[10px]">Width (W)</span>
                    <span className="font-bold text-foreground">{data.geometry.width_m} m</span>
                  </div>
                  <div className="rounded-none bg-muted/40 p-2">
                    <span className="text-muted-foreground block text-[10px]">Length (L = 1.5W)</span>
                    <span className="font-bold text-foreground">{data.geometry.length_m} m</span>
                  </div>
                  <div className="rounded-none bg-muted/40 p-2">
                    <span className="text-muted-foreground block text-[10px]">Wall Height</span>
                    <span className="font-bold text-foreground">{data.geometry.wall_height_m} m</span>
                  </div>
                  <div className="rounded-none bg-muted/40 p-2">
                    <span className="text-muted-foreground block text-[10px]">Gable Roof Height</span>
                    <span className="font-bold text-foreground">{data.geometry.roof_height_m} m</span>
                  </div>
                  <div className="rounded-none bg-muted/40 p-2">
                    <span className="text-muted-foreground block text-[10px]">Net Wall Area</span>
                    <span className="font-bold text-foreground">{data.geometry.wall_area_net_m2} m²</span>
                  </div>
                  <div className="rounded-none bg-muted/40 p-2">
                    <span className="text-muted-foreground block text-[10px]">South Glazing Area</span>
                    <span className="font-bold text-foreground">{data.geometry.glazing_area_m2} m²</span>
                  </div>
                  <div className="rounded-none bg-muted/40 p-2">
                    <span className="text-muted-foreground block text-[10px]">Roof Surface Area</span>
                    <span className="font-bold text-foreground">{data.geometry.roof_area_m2} m²</span>
                  </div>
                  <div className="rounded-none bg-muted/40 p-2">
                    <span className="text-muted-foreground block text-[10px]">Floor Footprint</span>
                    <span className="font-bold text-foreground">{data.geometry.floor_area_m2} m²</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Right Column: Diurnal Chart + Parameters Form (5 cols) ── */}
          <div className="space-y-4 lg:col-span-5">
            {/* 24-Hour Diurnal Heat Loss & Temperature Chart */}
            {data && (
              <HeatFlowChart
                hourlyData={data.hourly_data}
                selectedHour={selectedHour}
                onSelectHour={setSelectedHour}
              />
            )}

            {/* Building Envelope Input Parameters Form */}
            <div className="rounded-none border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders size={15} className="text-accent" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Envelope &amp; Climate Parameters
                  </h3>
                </div>
                {loading && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
              </div>

              <form onSubmit={handleSubmitParams} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  {/* Volume */}
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Shelter Volume (m³)
                    </label>
                    <input
                      type="number"
                      min={20}
                      max={500}
                      step={5}
                      value={params.volume_m3}
                      onChange={(e) => handleParamChange("volume_m3", e.target.value)}
                      className="mt-1 w-full rounded-none border border-border bg-muted/60 px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
                    />
                  </div>

                  {/* Wall Material */}
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Wall Material
                    </label>
                    <select
                      id="select-wall-material"
                      value={params.wall_material}
                      onChange={(e) => handleParamChange("wall_material", e.target.value)}
                      className="mt-1 w-full rounded-none border border-border bg-muted/60 px-3 py-1.5 text-xs focus:border-accent focus:outline-none"
                    >
                      {CANONICAL_WALL_MATERIALS.map((mat) => {
                        const def = WALL_MATERIALS[mat];
                        return (
                          <option key={mat} value={mat}>
                            {def.displayName} (k={def.k})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Wall Thickness */}
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Wall Thickness (cm)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      step={5}
                      value={params.wall_thickness_cm}
                      onChange={(e) => handleParamChange("wall_thickness_cm", e.target.value)}
                      className="mt-1 w-full rounded-none border border-border bg-muted/60 px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
                    />
                  </div>

                  {/* Insulation R-value */}
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Insulation R-value (m²K/W)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={params.insulation_r_value}
                      onChange={(e) => handleParamChange("insulation_r_value", e.target.value)}
                      className="mt-1 w-full rounded-none border border-border bg-muted/60 px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
                    />
                  </div>

                  {/* Glazing Ratio */}
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Glazing Ratio (South)
                    </label>
                    <input
                      type="number"
                      min={0.05}
                      max={0.8}
                      step={0.05}
                      value={params.glazing_ratio}
                      onChange={(e) => handleParamChange("glazing_ratio", e.target.value)}
                      className="mt-1 w-full rounded-none border border-border bg-muted/60 px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
                    />
                  </div>

                  {/* Occupants */}
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Occupancy (People)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      step={1}
                      value={params.occupancy}
                      onChange={(e) => handleParamChange("occupancy", e.target.value)}
                      className="mt-1 w-full rounded-none border border-border bg-muted/60 px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
                    />
                  </div>

                  {/* Heater Power */}
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Active Heater (kW)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={params.heater_power_kw}
                      onChange={(e) => handleParamChange("heater_power_kw", e.target.value)}
                      className="mt-1 w-full rounded-none border border-border bg-muted/60 px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
                    />
                  </div>

                  {/* Ambient Temp */}
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Mean Ambient Temp (°C)
                    </label>
                    <input
                      type="number"
                      min={-40}
                      max={35}
                      step={1}
                      value={params.ambient_temp_c ?? -6}
                      onChange={(e) => handleParamChange("ambient_temp_c", e.target.value)}
                      className="mt-1 w-full rounded-none border border-border bg-muted/60 px-3 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  id="btn-recalculate-heat-flow"
                  type="submit"
                  disabled={loading}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-none bg-accent py-2 text-xs font-semibold text-accent-foreground shadow transition-colors hover:bg-accent/90 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Computing 24h Solar &amp; Heat Flux...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={13} />
                      <span>Recalculate Heat Flow &amp; Geometry</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Cross-Flow Navigation Cards */}
            <div className="rounded-none border border-border bg-card p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Next Steps · Connected Flows
              </h4>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Link
                  href="/thermal-energy"
                  className="flex items-center justify-between rounded-none border border-border bg-background p-2.5 text-xs text-foreground transition-colors hover:border-accent"
                >
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-[#B87326]" />
                    <span>Thermal Energy Flow</span>
                  </div>
                  <ArrowRight size={12} className="text-muted-foreground" />
                </Link>

                <Link
                  href="/dashboard"
                  className="flex items-center justify-between rounded-none border border-border bg-background p-2.5 text-xs text-foreground transition-colors hover:border-accent"
                >
                  <div className="flex items-center gap-2">
                    <ArrowRight size={14} className="text-[#4A6D88]" />
                    <span>Optimization Dashboard</span>
                  </div>
                  <ArrowRight size={12} className="text-muted-foreground" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
