"use client";

import React, { Suspense, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, Line, OrbitControls, Text } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ShelterGeometry, EnvelopeUValues, HourlyHeatFlowPoint } from "@/lib/api/heat-flow";
import { ShelterMesh } from "./ShelterMesh";
import { SunTracker } from "./SunTracker";
import { Eye, Layers, Compass, Sparkles, Ruler } from "lucide-react";

interface Shelter3DCanvasProps {
  geometry: ShelterGeometry;
  uValues: EnvelopeUValues;
  currentPoint: HourlyHeatFlowPoint;
  hourlyData: HourlyHeatFlowPoint[];
  wallMaterial: string;
  className?: string;
}

export function Shelter3DCanvas({
  geometry,
  uValues,
  currentPoint,
  hourlyData,
  wallMaterial,
  className,
}: Shelter3DCanvasProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [wireframe, setWireframe] = useState(false);
  // Keep the architectural material legible by default; heat-loss glow is an
  // analysis overlay that can be enabled when needed.
  const [showThermalHeatmap, setShowThermalHeatmap] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);

  // Dynamic sky background color based on solar elevation
  const skyColor = useMemo(() => {
    const elev = currentPoint.sun_elevation_deg;
    if (elev > 25) return "#0284c7"; // Midday high-altitude clear sky
    if (elev > 10) return "#0369a1"; // Morning / Afternoon crisp blue
    if (elev > 0) return "#431407"; // Alpenglow / Golden sunrise & sunset
    if (elev > -12) return "#1e1b4b"; // Twilight
    return "#0c1322"; // High-altitude midnight blue
  }, [currentPoint.sun_elevation_deg]);

  // Ambient light level - boosted so shelter remains clearly visible at night
  const ambientIntensity = useMemo(() => {
    if (currentPoint.is_sun_up) {
      return 0.5 + Math.max(0, currentPoint.sun_elevation_deg / 90) * 0.4;
    }
    return 0.55; // High-altitude moon bounce & snow albedo: keeps shelter bright and visible at night
  }, [currentPoint.is_sun_up, currentPoint.sun_elevation_deg]);

  // Quick camera jump presets
  const setCameraView = (view: "iso" | "south" | "top" | "east") => {
    if (!controlsRef.current) return;
    const ctrl = controlsRef.current;
    if (view === "iso") {
      ctrl.object.position.set(11, 7, 11);
    } else if (view === "south") {
      // Direct view at South glazing (+Z)
      ctrl.object.position.set(0, 3, 14);
    } else if (view === "top") {
      // Bird's-eye site plan view
      ctrl.object.position.set(0, 18, 0.1);
    } else if (view === "east") {
      // East entrance view (+X)
      ctrl.object.position.set(14, 3, 0);
    }
    ctrl.target.set(0, 1.3, 0);
    ctrl.update();
  };

  return (
    <div className={`relative w-full overflow-hidden rounded-none border border-border bg-card shadow-sm ${className ?? "h-[480px] sm:h-[540px]"}`}>
      {/* ── 3D Viewport Controls HUD ── */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-1.5 rounded-none border border-border bg-card/90 p-1.5 backdrop-blur-md">
        <button
          id="btn-view-iso"
          onClick={() => setCameraView("iso")}
          className="flex items-center gap-1 rounded-none px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
          title="Isometric Perspective"
        >
          <Eye size={12} />
          <span>Iso</span>
        </button>
        <button
          id="btn-view-south"
          onClick={() => setCameraView("south")}
          className="flex items-center gap-1 rounded-none px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
          title="South Glazing Direct View (Solar Gain)"
        >
          <Compass size={12} className="text-[#B65C38]" />
          <span>South Glazing</span>
        </button>
        <button
          id="btn-view-top"
          onClick={() => setCameraView("top")}
          className="rounded-none px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
          title="Top-down Site Plan"
        >
          Top
        </button>
        <button
          id="btn-view-east"
          onClick={() => setCameraView("east")}
          className="rounded-none px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
          title="East Vernacular Entry"
        >
          East
        </button>

        <div className="mx-1 h-3.5 w-[1px] bg-border" />

        <button
          id="btn-toggle-thermal"
          onClick={() => setShowThermalHeatmap(!showThermalHeatmap)}
          className={`flex items-center gap-1 rounded-none px-2 py-1 text-xs font-medium transition-colors ${
            showThermalHeatmap
              ? "bg-[#A63D2F]/15 text-[#A63D2F] hover:bg-[#A63D2F]/25"
              : "text-muted-foreground hover:bg-muted"
          }`}
          title="Toggle Thermal Heat-Loss Radiation Effect"
        >
          <Sparkles size={12} />
          <span>Heat Loss Glow</span>
        </button>
        <button
          id="btn-toggle-wireframe"
          onClick={() => setWireframe(!wireframe)}
          className={`flex items-center gap-1 rounded-none px-2 py-1 text-xs font-medium transition-colors ${
            wireframe
              ? "bg-accent/20 text-accent hover:bg-accent/30"
              : "text-muted-foreground hover:bg-muted"
          }`}
          title="Toggle Geometry Wireframe"
        >
          <Layers size={12} />
          <span>Wireframe</span>
        </button>
        <button
          id="btn-toggle-dimensions"
          onClick={() => setShowDimensions(!showDimensions)}
          className={`flex items-center gap-1 rounded-none px-2 py-1 text-xs font-medium transition-colors ${
            showDimensions
              ? "bg-[#B87326]/15 text-[#8B5A16] hover:bg-[#B87326]/25"
              : "text-muted-foreground hover:bg-muted"
          }`}
          title="Toggle real-world dimensions and architectural scale"
        >
          <Ruler size={12} />
          <span>Dimensions</span>
        </button>
      </div>

      {/* ── Solar & Heat Loss Status Badge ── */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1 rounded-none border border-border bg-card/90 px-3 py-2 text-right backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Heat Loss Rate
          </span>
          <span className="font-mono text-sm font-bold text-[#A63D2F]">
            {currentPoint.q_total_w.toLocaleString()} W
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Sun Elev: <strong className="text-foreground">{currentPoint.sun_elevation_deg}°</strong></span>
          <span>·</span>
          <span>Azimuth: <strong className="text-foreground">{currentPoint.sun_azimuth_deg}°</strong></span>
        </div>
      </div>

      <div className="absolute left-3 top-14 z-10 rounded-none border border-border bg-card/85 px-2.5 py-1 text-[10px] font-mono text-muted-foreground backdrop-blur-sm">
        Roof finish: separate slate/timber-style finish
      </div>

      {/* ── Orientation Guide (Compass) ── */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-none border border-border bg-card/90 px-2.5 py-1 text-[11px] font-mono text-muted-foreground backdrop-blur-sm">
        <span className="text-[#4A6D88] font-bold">▲ North (-Z)</span>
        <span>·</span>
        <span className="text-[#B65C38] font-bold">▼ South / Solar Gain (+Z)</span>
      </div>

      {/* ── Metric Real Scale Reference Badge (HUD) ── */}
      <div
        id="scale-reference-hud"
        className="absolute bottom-3 right-3 z-10 flex items-center gap-2 rounded-none border border-border bg-card/90 px-2.5 py-1 text-[11px] font-mono text-muted-foreground backdrop-blur-sm"
      >
        <Ruler size={12} className="text-accent" />
        <span className="font-semibold text-foreground">Grid: 1m × 1m</span>
        <span>·</span>
          <span className="font-semibold text-accent">Scale: 1:100</span>
          <span className="hidden text-foreground sm:inline">1 mm = 10 cm</span>
        <span className="hidden sm:inline">·</span>
        <span className="hidden text-foreground sm:inline">
          {geometry.length_m}m(L) × {geometry.width_m}m(W) × {geometry.wall_height_m}m(H)
        </span>
      </div>

      {/* ── 3D Canvas ── */}
      <Canvas
        shadows
        camera={{ position: [11, 7, 11], fov: 42 }}
        style={{ background: skyColor, transition: "background 0.5s ease" }}
      >
        <Suspense fallback={null}>
          {/* Ambient Lighting */}
          <ambientLight intensity={ambientIntensity} color="#e0f2fe" />
          <hemisphereLight
            args={["#bfdbfe", "#334155", currentPoint.is_sun_up ? 0.45 : 0.35]}
          />

          {/* Moonlight directional lighting at night so shelter surfaces have clear contrast */}
          {!currentPoint.is_sun_up && (
            <directionalLight
              position={[10, 14, 10]}
              intensity={0.6}
              color="#e0f2fe"
              castShadow
            />
          )}

          {/* Real Solar Coordinate Tracker & Directional Light */}
          <SunTracker
            currentPoint={currentPoint}
            hourlyData={hourlyData}
            radius={14.0}
          />

          {/* Parametric Building Envelope (Ladakhi Vernacular) */}
          <ShelterMesh
            geometry={geometry}
            uValues={uValues}
            currentPoint={currentPoint}
            wallMaterial={wallMaterial}
            wireframe={wireframe}
            showThermalHeatmap={showThermalHeatmap}
          />

          {/* Ground Plane with Subtle Snowy Terrain and 1m Metric Grid */}
          <GroundTerrain />

          {/* Real-world architectural dimensions, derived from the API geometry */}
          {showDimensions && <ProfessionalDimensionAnnotations geometry={geometry} />}

          {/* Smooth Camera Controls */}
          <OrbitControls
            ref={controlsRef}
            target={[0, 1.3, 0]}
            maxPolarAngle={Math.PI / 2 - 0.05}
            minDistance={4}
            maxDistance={30}
            enableDamping
            dampingFactor={0.08}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

/** Ground plane with subtle Ladakh snowy terrain and 1m grid. */
function GroundTerrain() {
  return (
    <group position={[0, -0.01, 0]}>
      {/* Snow-dusted terrain slab */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* True 1m metric site coordinate grid (40m x 40m, 40 divisions = 1m spacing) */}
      <gridHelper args={[40, 40, "#334155", "#1e293b"]} position={[0, 0.01, 0]} />
    </group>
  );
}

/**
 * Real, visible 3D Metric Scale Bar placed on the ground plane in front of the shelter.
 * Consists of five 1.0m alternating survey segments (total 5.0m) with numeric tick markers
 * (0m, 1m, 2m, 3m, 4m, 5m) that visually scale 1-to-1 against Three.js units and
 * computed parametric geometry dimensions.
 */
function MetricScaleBar({ widthM }: { widthM: number }) {
  // Dynamically position comfortably in front of the South glazing (+Z)
  // as the building expands with volume
  const zPos = Math.max(4.8, widthM / 2 + 1.8);
  const segments = [
    { start: 0, color: "#38bdf8" },
    { start: 1, color: "#1e293b" },
    { start: 2, color: "#38bdf8" },
    { start: 3, color: "#1e293b" },
    { start: 4, color: "#38bdf8" },
  ];
  const ticks = [0, 1, 2, 3, 4, 5];

  return (
    <group position={[-2.5, 0.015, zPos]}>
      {/* Alternating 1m survey bar blocks */}
      {segments.map((seg, idx) => (
        <mesh key={idx} position={[seg.start + 0.5, 0.015, 0]} receiveShadow>
          <boxGeometry args={[1.0, 0.03, 0.14]} />
          <meshStandardMaterial color={seg.color} roughness={0.4} />
        </mesh>
      ))}

      {/* 1m tick posts with 3D text labels */}
      {ticks.map((t) => (
        <group key={`tick-${t}`} position={[t, 0.02, 0]}>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[0.03, 0.06, 0.22]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.2} />
          </mesh>
          <Text
            position={[0, 0.04, 0.26]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.28}
            color="#f8fafc"
            anchorX="center"
            anchorY="middle"
          >
            {`${t}m`}
          </Text>
        </group>
      ))}

      {/* Scale Title Text in 3D Scene */}
      <Text
        position={[2.5, 0.04, -0.28]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.26}
        color="#38bdf8"
        anchorX="center"
        anchorY="middle"
      >
        5m METRIC SCALE BAR (1m increments)
      </Text>

      {/* Ground Grid Label in 3D Scene */}
      <Text
        position={[2.5, 0.04, 0.65]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.22}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        SITE GRID SPACING: 1.0m × 1.0m
      </Text>
    </group>
  );
}

/** Ground Compass Rose showing True North, South, East, West. */
function GroundCompass() {
  return (
    <group position={[0, 0.02, 0]}>
      {/* North marker (-Z) */}
      <Text
        position={[0, 0.05, -7.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.8}
        color="#38bdf8"
        anchorX="center"
        anchorY="middle"
      >
        N
      </Text>

      {/* South marker (+Z) - Solar orientation */}
      <Text
        position={[0, 0.05, 7.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.8}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
      >
        S (Solar Gain)
      </Text>

      {/* East marker (+X) */}
      <Text
        position={[7.5, 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.8}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        E
      </Text>

      {/* West marker (-X) */}
      <Text
        position={[-7.5, 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.8}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        W
      </Text>
    </group>
  );
}

/**
 * Dimension annotations stay in model space, so they remain accurate when
 * volume/geometry inputs change. The architectural scale is 1:100: 1 mm on
 * the drawing represents 10 cm in the shelter.
 */
/** Minimal professional annotation set for the default isometric view. */
function ProfessionalDimensionAnnotations({ geometry }: { geometry: ShelterGeometry }) {
  const L = geometry.length_m;
  const W = geometry.width_m;
  const H = geometry.wall_height_m;
  const color = "#fff4dc";
  const southZ = W / 2 + 0.65;
  const eastX = L / 2 + 0.65;

  return (
    <group>
      <DimensionLine
        start={[-L / 2, 0.08, southZ]}
        end={[L / 2, 0.08, southZ]}
        label={`${L.toFixed(2)} m`}
        labelPosition={[0, 0.12, southZ + 0.12]}
        rotation={[-Math.PI / 2, 0, 0]}
        tickDirection="z"
        color={color}
      />
      <DimensionLine
        start={[eastX, 0.08, -W / 2]}
        end={[eastX, 0.08, W / 2]}
        label={`${W.toFixed(2)} m`}
        labelPosition={[eastX + 0.12, 0.12, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        tickDirection="x"
        color={color}
      />
      <Line
        points={[
          [-L / 2 - 0.65, 0.08, W / 2 + 0.2],
          [-L / 2 - 0.65, H, W / 2 + 0.2],
        ]}
        color={color}
        lineWidth={1.5}
      />
      <Html position={[-L / 2 - 0.9, H / 2, W / 2 + 0.2]} center distanceFactor={7}>
        <div className="pointer-events-none whitespace-nowrap border border-[#fff4dc]/80 bg-[#241b14]/90 px-2 py-1 text-[10px] font-mono font-semibold text-[#fff4dc] shadow-lg">
          {H.toFixed(2)} m H
        </div>
      </Html>
      {false && <Html position={[0, H + 0.8, 0]} center distanceFactor={7}>
        <div className="pointer-events-none whitespace-nowrap border border-[#f0c98a]/70 bg-[#241b14]/90 px-2 py-1 text-[10px] font-mono font-semibold text-[#ffe8b5] shadow-lg">
          Drawing scale: 1:100&nbsp; · &nbsp;1 mm = 10 cm
        </div>
      </Html>}
    </group>
  );
}

function DimensionAnnotations({ geometry }: { geometry: ShelterGeometry }) {
  const L = geometry.length_m;
  const W = geometry.width_m;
  const H = geometry.wall_height_m;
  const lineColor = "#f8e7c1";
  const guideColor = "#d6a15b";
  const southZ = W / 2 + 0.95;
  const northZ = -W / 2 - 0.95;
  const eastX = L / 2 + 0.95;
  const westX = -L / 2 - 0.95;

  return (
    <group>
      {/* South/front length */}
      <DimensionLine
        start={[-L / 2, 0.08, southZ]}
        end={[L / 2, 0.08, southZ]}
        label={`${L.toFixed(2)} m`}
        labelPosition={[0, 0.12, southZ + 0.18]}
        rotation={[-Math.PI / 2, 0, 0]}
        tickDirection="z"
        color={lineColor}
      />
      {/* North/rear length */}
      <DimensionLine
        start={[-L / 2, 0.08, northZ]}
        end={[L / 2, 0.08, northZ]}
        label={`${L.toFixed(2)} m`}
        labelPosition={[0, 0.12, northZ - 0.18]}
        rotation={[-Math.PI / 2, 0, 0]}
        tickDirection="z"
        color={guideColor}
      />
      {/* East/right width */}
      <DimensionLine
        start={[eastX, 0.08, -W / 2]}
        end={[eastX, 0.08, W / 2]}
        label={`${W.toFixed(2)} m`}
        labelPosition={[eastX + 0.18, 0.12, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        tickDirection="x"
        color={lineColor}
      />
      {/* West/left width */}
      <DimensionLine
        start={[westX, 0.08, -W / 2]}
        end={[westX, 0.08, W / 2]}
        label={`${W.toFixed(2)} m`}
        labelPosition={[westX - 0.18, 0.12, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        tickDirection="x"
        color={guideColor}
      />
      {/* Front-left vertical height */}
      <Line
        points={[[-L / 2 - 0.85, 0.08, W / 2 + 0.35], [-L / 2 - 0.85, H, W / 2 + 0.35]]}
        color={lineColor}
        lineWidth={1.5}
      />
      <Line
        points={[
          [-L / 2 - 1.05, 0.08, W / 2 + 0.35],
          [-L / 2 - 0.65, 0.08, W / 2 + 0.35],
          [-L / 2 - 0.85, 0.08, W / 2 + 0.35],
        ]}
        color={lineColor}
        lineWidth={1.5}
      />
      <Line
        points={[
          [-L / 2 - 1.05, H, W / 2 + 0.35],
          [-L / 2 - 0.65, H, W / 2 + 0.35],
          [-L / 2 - 0.85, H, W / 2 + 0.35],
        ]}
        color={lineColor}
        lineWidth={1.5}
      />
      <Text
        position={[-L / 2 - 1.15, H / 2, W / 2 + 0.35]}
        fontSize={0.28}
        color={lineColor}
        anchorX="center"
        anchorY="middle"
        rotation={[0, Math.PI / 2, 0]}
      >
        {`${H.toFixed(2)} m H`}
      </Text>

      {/* Scale plate is deliberately repeated in-world, close to the model. */}
      <group position={[0, 0.12, southZ + 0.85]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.8, 0.5]} />
          <meshBasicMaterial color="#201812" transparent opacity={0.82} />
        </mesh>
        <Text
          position={[0, 0.02, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.25}
          color="#ffe6b0"
          anchorX="center"
          anchorY="middle"
        >
          SCALE 1:100  |  1 mm = 10 cm
        </Text>
      </group>
    </group>
  );
}

function DimensionLine({
  start,
  end,
  label,
  labelPosition,
  rotation,
  tickDirection,
  color,
}: {
  start: [number, number, number];
  end: [number, number, number];
  label: string;
  labelPosition: [number, number, number];
  rotation: [number, number, number];
  tickDirection: "x" | "z";
  color: string;
}) {
  const tick = tickDirection === "x" ? [0.18, 0, 0] : [0, 0, 0.18];
  return (
    <>
      <Line points={[start, end]} color={color} lineWidth={1.5} />
      <Line
        points={[
          [start[0] - tick[0], start[1], start[2] - tick[2]],
          [start[0] + tick[0], start[1], start[2] + tick[2]],
        ]}
        color={color}
        lineWidth={1.5}
      />
      <Line
        points={[
          [end[0] - tick[0], end[1], end[2] - tick[2]],
          [end[0] + tick[0], end[1], end[2] + tick[2]],
        ]}
        color={color}
        lineWidth={1.5}
      />
      <Text
        position={labelPosition}
        rotation={rotation}
        fontSize={0.3}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </>
  );
}
