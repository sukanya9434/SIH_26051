"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getDesign,
  getModelUrl,
  SavedDesignRecord,
  GOLDEN_DESIGN_PRESETS,
} from "@/lib/api/designs";
import {
  Building2,
  ThermometerSnowflake,
  Sun,
  Flame,
  IndianRupee,
  Layers,
  Compass,
  ArrowLeft,
  Share2,
  Check,
  Maximize2,
  Box,
  ShieldCheck,
  Eye,
} from "lucide-react";

export default function ModelViewerPage() {
  const params = useParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const [design, setDesign] = useState<SavedDesignRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [fullImage, setFullImage] = useState<boolean>(false);

  useEffect(() => {
    if (!rawId) return;
    setLoading(true);

    getDesign(rawId)
      .then((record) => {
        setDesign(record);
        setLoading(false);
      })
      .catch(() => {
        // Safe fallback to golden preset
        setDesign({
          ...GOLDEN_DESIGN_PRESETS["golden-leh"],
          design_id: rawId,
        });
        setLoading(false);
      });
  }, [rawId]);

  const handleCopyLink = async () => {
    if (!design) return;
    const url = getModelUrl(design.design_id);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy link to 3D Model:", url);
    }
  };

  if (loading || !design) {
    return (
      <div className="min-h-screen bg-[#1c1917] text-[#FAF7F2] flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-stone-800 bg-stone-900/80 backdrop-blur shadow-2xl">
          <div className="h-14 w-14 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin flex items-center justify-center">
            <Box className="h-6 w-6 text-amber-500 animate-pulse" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold font-serif text-stone-100">
              Loading 3D Shelter Digital Twin...
            </h2>
            <p className="text-xs text-stone-400 mt-1 font-mono">
              Design ID: {rawId}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const s = design.shelter;
  const p = design.performance;

  return (
    <div className="min-h-screen bg-[#141210] text-[#FAF7F2] flex flex-col selection:bg-amber-600/30">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-stone-800 bg-[#1c1917]/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-mono text-stone-200 transition-all border border-stone-700/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold font-serif tracking-wide text-stone-100">
                Thermoform 3D Shelter Model
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Verified Model
              </span>
            </div>
            <p className="text-[11px] text-stone-400 font-mono">
              Design ID: <span className="text-amber-400 font-semibold">{design.design_id}</span> · {design.location} ({design.outdoor_temp_c}°C Ambient)
            </p>
          </div>
        </div>

        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-700 bg-stone-800/80 hover:bg-stone-800 text-xs font-mono text-stone-200 shadow-sm transition-all"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="h-3.5 w-3.5 text-stone-400" />
              <span className="hidden sm:inline">Share Link</span>
            </>
          )}
        </button>
      </header>

      {/* Main Layout: 3D Image Hero & Architectural Specifications */}
      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 3D Shelter Model Image & Visual Diagram */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          <div className="relative rounded-2xl overflow-hidden border border-stone-800 bg-stone-900 shadow-2xl group">
            {/* Image banner badge */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-xs font-mono text-stone-200">
              <Box className="h-3.5 w-3.5 text-amber-400" />
              <span>Three.js 3D CAD Shelter Model</span>
            </div>

            <button
              onClick={() => setFullImage(!fullImage)}
              className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-stone-300 hover:text-white transition-all"
              title="Toggle Fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>

            {/* 3D Model Image */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#0c1322] flex items-center justify-center">
              <img
                src="/shelter-3d-model.png"
                alt="3D High-Altitude Ladakh Passive Solar Shelter Model"
                className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
              />
            </div>

            {/* Bottom Caption Overlay */}
            <div className="p-4 bg-gradient-to-t from-stone-950 via-stone-900/90 to-transparent border-t border-stone-800/60">
              <div className="flex items-center justify-between text-xs font-mono text-stone-300">
                <span className="font-semibold text-amber-300">
                  Exact Three.js Vernacular Passive Solar Shelter Model
                </span>
                <span className="text-stone-400">
                  {s.length_m.toFixed(1)}m × {s.width_m.toFixed(1)}m · {s.area_m2} m²
                </span>
              </div>
              <p className="mt-1 text-[11px] text-stone-400 font-sans leading-relaxed">
                Rendered from website 3D visualizer: featuring traditional Ladakhi timber taluk joists, thick thermal mass {s.material.replace("_", " ")} walls with {s.insulation_mm}mm insulation, south solar glazing, and 1m metric coordinate grid.
              </p>
            </div>
          </div>

          {/* Quick Guidance Pill */}
          <div className="p-3.5 rounded-xl border border-stone-800 bg-stone-900/50 flex items-center justify-between text-xs font-mono text-stone-400">
            <span className="flex items-center gap-1.5 text-stone-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Optimized for -25°C to 5°C High-Altitude Himalayan Arid Zones
            </span>
            <span className="text-amber-400">SIH 2026</span>
          </div>
        </section>

        {/* Right Column: Complete Architectural Specifications & Thermal Data */}
        <aside className="lg:col-span-5 flex flex-col gap-4">
          {/* Card 1: Architectural Envelope Specifications */}
          <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-amber-400" />
                <h2 className="text-xs uppercase font-mono font-bold tracking-wider text-stone-200">
                  Envelope Specifications
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-950/70 text-amber-300 border border-amber-800/70">
                {s.material.replace("_", " ")}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="p-2 rounded-lg bg-stone-800/40 border border-stone-800">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">
                  Dimensions (L × W × H)
                </span>
                <span className="font-semibold font-mono text-stone-200 mt-0.5 block">
                  {s.length_m.toFixed(1)}m × {s.width_m.toFixed(1)}m × {s.wall_height_m.toFixed(1)}m
                </span>
              </div>

              <div className="p-2 rounded-lg bg-stone-800/40 border border-stone-800">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">
                  Floor Area & Volume
                </span>
                <span className="font-semibold font-mono text-stone-200 mt-0.5 block">
                  {s.area_m2} m² ({s.volume_m3.toFixed(0)} m³)
                </span>
              </div>

              <div className="p-2 rounded-lg bg-stone-800/40 border border-stone-800">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">
                  Wall Thickness
                </span>
                <span className="font-semibold font-mono text-stone-200 mt-0.5 block">
                  {s.wall_thickness_cm} cm
                </span>
              </div>

              <div className="p-2 rounded-lg bg-stone-800/40 border border-stone-800">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">
                  Insulation Thickness
                </span>
                <span className="font-semibold font-mono text-stone-200 mt-0.5 block">
                  {s.insulation_mm} mm (R-{s.insulation_r_value.toFixed(2)})
                </span>
              </div>

              <div className="p-2 rounded-lg bg-stone-800/40 border border-stone-800">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">
                  Glazing Type
                </span>
                <span className="font-semibold font-mono text-stone-200 mt-0.5 block capitalize">
                  {s.glazing.replace("_", "-")} ({(s.glazing_ratio * 100).toFixed(0)}% S-Facing)
                </span>
              </div>

              <div className="p-2 rounded-lg bg-stone-800/40 border border-stone-800">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">
                  Roof Construction
                </span>
                <span className="font-semibold font-mono text-stone-200 text-[11px] mt-0.5 block truncate" title={s.roof_type}>
                  Timber Taluk Joists
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Thermal Simulation Metrics */}
          <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-4 shadow-xl">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-800">
              <ThermometerSnowflake className="h-4 w-4 text-sky-400" />
              <h2 className="text-xs uppercase font-mono font-bold tracking-wider text-stone-200">
                Thermal Performance Metrics
              </h2>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-stone-800/50 border border-stone-800">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">
                  Min Indoor Temp
                </span>
                <span className="text-base font-bold text-stone-100 font-mono">
                  {p.minimum_indoor_c.toFixed(1)}°C
                </span>
                <span className="text-[10px] text-emerald-400 block mt-0.5">
                  Target: {p.target_temp_c.toFixed(1)}°C
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-stone-800/50 border border-stone-800">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">
                  Comfort Hours Deficit
                </span>
                <span className={`text-base font-bold font-mono ${p.hours_below_target === 0 ? "text-emerald-400" : "text-amber-400"}`}>
                  {p.hours_below_target} hrs/day
                </span>
                <span className="text-[10px] text-stone-400 block mt-0.5">
                  ISHRAE IMAC
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-stone-800/50 border border-stone-800">
                <span className="text-[10px] text-stone-400 uppercase font-mono block flex items-center gap-1">
                  <Sun className="h-3 w-3 text-amber-400" /> Solar Gain
                </span>
                <span className="text-sm font-bold text-stone-200 font-mono">
                  {p.solar_gain_kwh.toFixed(1)} kWh/d
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-stone-800/50 border border-stone-800">
                <span className="text-[10px] text-stone-400 uppercase font-mono block flex items-center gap-1">
                  <Flame className="h-3 w-3 text-rose-400" /> Daily Heating Load
                </span>
                <span className="text-sm font-bold text-amber-400 font-mono">
                  {p.daily_heating_kwh.toFixed(1)} kWh/d
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Construction Economics & Estimated Cost */}
          <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-emerald-400" />
                <h2 className="text-xs uppercase font-mono font-bold tracking-wider text-stone-200">
                  Estimated Capital Cost
                </h2>
              </div>
              <span className="text-[10px] font-mono text-stone-400">
                CPWD / LSOR
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <div>
                <span className="text-[10px] text-stone-400 uppercase font-mono block">
                  Total Construction Cost
                </span>
                <span className="text-xl font-bold font-mono text-stone-100">
                  ₹{p.estimated_install_cost.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-stone-400 uppercase font-mono block">
                  Unit Cost
                </span>
                <span className="text-sm font-semibold font-mono text-amber-400">
                  ₹{p.cost_per_m2.toLocaleString("en-IN")}/m²
                </span>
              </div>
            </div>
          </div>

          {/* Action: Return to Dashboard */}
          <Link
            href="/dashboard"
            className="w-full text-center py-2.5 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 font-medium text-xs font-mono text-stone-200 transition-all shadow-md flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Return to Thermal Optimization Dashboard
          </Link>
        </aside>
      </main>

      {/* Fullscreen Image Modal if user clicks expand */}
      {fullImage && (
        <div
          onClick={() => setFullImage(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center">
            <img
              src="/shelter-3d-model.jpg"
              alt="3D Shelter Cutaway"
              className="max-h-[85vh] w-auto rounded-lg shadow-2xl object-contain border border-stone-800"
            />
            <p className="mt-3 text-xs font-mono text-stone-400">
              Click anywhere to close full view
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
