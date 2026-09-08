"use client";

import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ShelterGeometry, EnvelopeUValues, HourlyHeatFlowPoint } from "@/lib/api/heat-flow";
import { getWallMaterialDefinition } from "@/lib/materials";

interface ShelterMeshProps {
  geometry: ShelterGeometry;
  uValues: EnvelopeUValues;
  currentPoint: HourlyHeatFlowPoint;
  wallMaterial: string;
  wireframe?: boolean;
  showThermalHeatmap?: boolean;
}

/**
 * Traditional Ladakhi Vernacular Shelter Mesh:
 * - Thick earthen / stone masonry walls
 * - Flat roof with perimeter parapet edge
 * - Protruding horizontal timber beam-ends ("taluk" joist ends) beneath the roofline
 * - Deep-set south window embrasure with heavy timber lintel
 * - Simple muted wooden entrance door
 * - Dynamic material-to-color mapping reflecting active material selection
 * - 100% preserved thermal heat-loss glow, radiation pulse, and solar interactivity
 */
export function ShelterMesh({
  geometry,
  currentPoint,
  wallMaterial,
  wireframe = false,
  showThermalHeatmap = true,
}: ShelterMeshProps) {
  const pulseRef = useRef<THREE.Group>(null);

  const {
    length_m: L,
    width_m: W,
    wall_height_m: H_wall,
  } = geometry;

  // Thermal heat loss intensity (0.0 to 1.0 normalized)
  const lossIntensity = useMemo(() => {
    return Math.min(1.0, Math.max(0.1, currentPoint.q_total_w / 1000.0));
  }, [currentPoint.q_total_w]);

  // Wall base color mapped directly from canonical material definition
  const materialDef = useMemo(() => getWallMaterialDefinition(wallMaterial), [wallMaterial]);
  const baseWallColor = materialDef.baseColor;

  // Wall thermal emissive glow based on heat loss rate (Watts)
  const emissiveColor = useMemo(() => {
    if (!showThermalHeatmap) return "#000000";
    if (lossIntensity > 0.75) return "#dc2626"; // High loss (sub-zero Ladakh night)
    if (lossIntensity > 0.45) return "#ea580c"; // Medium loss
    if (lossIntensity > 0.25) return "#f59e0b"; // Mild loss
    return "#0ea5e9"; // Low loss / solar balanced
  }, [lossIntensity, showThermalHeatmap]);

  const emissiveIntensity = useMemo(() => {
    if (!showThermalHeatmap) return 0;
    return 0.15 + lossIntensity * 0.45;
  }, [lossIntensity, showThermalHeatmap]);

  // Vernacular wall thickness: ~35cm representing thick Himalayan masonry
  const T_wall = 0.35;

  // Deep-set South window geometry (+Z)
  const windowHeight = 1.25;
  const windowWidth = Math.min(L * 0.75, Math.max(0.9, geometry.glazing_area_m2 / windowHeight));
  const sillHeight = 0.7;
  const headerHeight = Math.max(0.2, H_wall - sillHeight - windowHeight);

  // Door geometry on East wall (+X)
  const doorW = 0.9;
  const doorH = 2.0;

  // Protruding timber joist beam-ends ("taluk") calculation
  const joistCount = Math.max(5, Math.round(L * 1.6));
  const joistSpacing = (L - 0.6) / (joistCount - 1);
  const joistPositions = useMemo(() => {
    const list: number[] = [];
    for (let i = 0; i < joistCount; i++) {
      list.push(-L / 2 + 0.3 + i * joistSpacing);
    }
    return list;
  }, [L, joistCount, joistSpacing]);

  // Animate pulse waves representing heat escaping through envelope
  useFrame((state) => {
    if (pulseRef.current && showThermalHeatmap) {
      const t = state.clock.getElapsedTime();
      const scale = 1.0 + 0.025 * Math.sin(t * 3.0 * (0.8 + lossIntensity));
      pulseRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* ── Concrete / Stone Plinth Foundation ── */}
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[L + 0.5, 0.2, W + 0.5]} />
        <meshStandardMaterial color="#334155" roughness={0.9} wireframe={wireframe} />
      </mesh>

      {/* ── Main Living Envelope ── */}
      <group position={[0, 0.2, 0]}>
        {/* North Wall (-Z) */}
        <mesh position={[0, H_wall / 2, -W / 2]} castShadow receiveShadow>
          <boxGeometry args={[L, H_wall, T_wall]} />
          <meshStandardMaterial
            color={baseWallColor}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
            roughness={0.85}
            wireframe={wireframe}
          />
        </mesh>

        {/* ── South Wall (+Z) with Deep-Set Window ── */}
        <group position={[0, 0, W / 2]}>
          {/* Left wall segment flanking window */}
          <mesh
            position={[-(L / 2 - (L - windowWidth) / 4), H_wall / 2, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[(L - windowWidth) / 2, H_wall, T_wall]} />
            <meshStandardMaterial
              color={baseWallColor}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
              roughness={0.85}
              wireframe={wireframe}
            />
          </mesh>

          {/* Right wall segment flanking window */}
          <mesh
            position={[L / 2 - (L - windowWidth) / 4, H_wall / 2, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[(L - windowWidth) / 2, H_wall, T_wall]} />
            <meshStandardMaterial
              color={baseWallColor}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
              roughness={0.85}
              wireframe={wireframe}
            />
          </mesh>

          {/* Wall header above window */}
          <mesh
            position={[0, sillHeight + windowHeight + headerHeight / 2, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[windowWidth, headerHeight, T_wall]} />
            <meshStandardMaterial
              color={baseWallColor}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
              roughness={0.85}
              wireframe={wireframe}
            />
          </mesh>

          {/* Wall sill below window */}
          <mesh position={[0, sillHeight / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[windowWidth, sillHeight, T_wall]} />
            <meshStandardMaterial
              color={baseWallColor}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
              roughness={0.85}
              wireframe={wireframe}
            />
          </mesh>

          {/* ── Vernacular Deep-Set Window Detailing ── */}
          {/* Heavy timber lintel beam above window */}
          <mesh position={[0, sillHeight + windowHeight + 0.08, T_wall / 2 + 0.02]} castShadow>
            <boxGeometry args={[windowWidth + 0.3, 0.12, 0.12]} />
            <meshStandardMaterial color="#452b14" roughness={0.85} />
          </mesh>

          {/* Timber sill beam below window */}
          <mesh position={[0, sillHeight - 0.04, T_wall / 2 + 0.02]} castShadow>
            <boxGeometry args={[windowWidth + 0.2, 0.08, 0.10]} />
            <meshStandardMaterial color="#452b14" roughness={0.85} />
          </mesh>

          {/* Recessed Glass Pane (Deep set inside the 35cm wall reveal) */}
          <mesh position={[0, sillHeight + windowHeight / 2, -0.05]} castShadow>
            <boxGeometry args={[windowWidth - 0.08, windowHeight - 0.08, 0.04]} />
            <meshPhysicalMaterial
              color="#38bdf8"
              transmission={0.85}
              opacity={0.75}
              transparent
              roughness={0.08}
              ior={1.52}
              reflectivity={0.9}
            />
          </mesh>

          {/* Recessed Wooden Frame */}
          <mesh position={[0, sillHeight + windowHeight / 2, -0.05]}>
            <boxGeometry args={[windowWidth, windowHeight, 0.06]} />
            <meshStandardMaterial color="#301d0f" roughness={0.8} wireframe={wireframe} />
          </mesh>
        </group>

        {/* ── East Wall (+X) with Muted Timber Door ── */}
        <group position={[L / 2, 0, 0]}>
          {/* Wall section flanking door (North side) */}
          <mesh
            position={[0, H_wall / 2, -(W / 2 - (W - doorW) / 4)]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[T_wall, H_wall, (W - doorW) / 2]} />
            <meshStandardMaterial
              color={baseWallColor}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
              roughness={0.85}
              wireframe={wireframe}
            />
          </mesh>

          {/* Wall section flanking door (South side) */}
          <mesh
            position={[0, H_wall / 2, W / 2 - (W - doorW) / 4]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[T_wall, H_wall, (W - doorW) / 2]} />
            <meshStandardMaterial
              color={baseWallColor}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
              roughness={0.85}
              wireframe={wireframe}
            />
          </mesh>

          {/* Wall header above door */}
          <mesh
            position={[0, doorH + (H_wall - doorH) / 2, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[T_wall, H_wall - doorH, doorW]} />
            <meshStandardMaterial
              color={baseWallColor}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
              roughness={0.85}
              wireframe={wireframe}
            />
          </mesh>

          {/* Heavy timber door lintel */}
          <mesh position={[T_wall / 2 + 0.02, doorH + 0.06, 0]} castShadow>
            <boxGeometry args={[0.12, 0.12, doorW + 0.25]} />
            <meshStandardMaterial color="#452b14" roughness={0.85} />
          </mesh>

          {/* Simple Wooden Door (Muted Brown) */}
          <mesh position={[0.02, doorH / 2, 0]} castShadow>
            <boxGeometry args={[0.06, doorH, doorW - 0.05]} />
            <meshStandardMaterial color="#54371e" roughness={0.75} />
          </mesh>

          {/* Door Frame & Rustic Handle */}
          <mesh position={[0.06, 0.95, 0.25]}>
            <boxGeometry args={[0.04, 0.14, 0.03]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.4} />
          </mesh>
        </group>

        {/* ── West Wall (-X) ── */}
        <mesh position={[-L / 2, H_wall / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[T_wall, H_wall, W]} />
          <meshStandardMaterial
            color={baseWallColor}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
            roughness={0.85}
            wireframe={wireframe}
          />
        </mesh>

        {/* ── Protruding Horizontal Timber Beam-Ends ("Taluk" Joist Ends) ── */}
        {joistPositions.map((posX, idx) => (
          <group key={`joists-${idx}`}>
            {/* North protrusion */}
            <mesh
              position={[posX, H_wall - 0.12, -W / 2 - T_wall / 2 - 0.05]}
              castShadow
            >
              <boxGeometry args={[0.09, 0.09, 0.14]} />
              <meshStandardMaterial color="#452b14" roughness={0.9} />
            </mesh>
            {/* South protrusion */}
            <mesh
              position={[posX, H_wall - 0.12, W / 2 + T_wall / 2 + 0.05]}
              castShadow
            >
              <boxGeometry args={[0.09, 0.09, 0.14]} />
              <meshStandardMaterial color="#452b14" roughness={0.9} />
            </mesh>
          </group>
        ))}

        {/* ── Ladakhi Flat Roof with Parapet ── */}
        {/* Main Flat Roof Slab */}
        <mesh position={[0, H_wall + 0.06, 0]} castShadow receiveShadow>
          <boxGeometry args={[L + 0.35, 0.12, W + 0.35]} />
          <meshStandardMaterial
            color="#94A3B8"
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity * 0.7}
            roughness={0.5}
            wireframe={wireframe}
          />
        </mesh>

        {/* Parapet Walls (Enclosing the flat roof) */}
        {/* North Parapet */}
        <mesh
          position={[0, H_wall + 0.27, -W / 2 - 0.1]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[L + 0.35, 0.30, 0.14]} />
          <meshStandardMaterial
            color={baseWallColor}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
            roughness={0.85}
            wireframe={wireframe}
          />
        </mesh>

        {/* South Parapet */}
        <mesh
          position={[0, H_wall + 0.27, W / 2 + 0.1]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[L + 0.35, 0.30, 0.14]} />
          <meshStandardMaterial
            color={baseWallColor}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
            roughness={0.85}
            wireframe={wireframe}
          />
        </mesh>

        {/* East Parapet */}
        <mesh
          position={[L / 2 + 0.1, H_wall + 0.27, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.14, 0.30, W + 0.06]} />
          <meshStandardMaterial
            color={baseWallColor}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
            roughness={0.85}
            wireframe={wireframe}
          />
        </mesh>

        {/* West Parapet */}
        <mesh
          position={[-L / 2 - 0.1, H_wall + 0.27, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.14, 0.30, W + 0.06]} />
          <meshStandardMaterial
            color={baseWallColor}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
            roughness={0.85}
            wireframe={wireframe}
          />
        </mesh>

        {/* Parapet Top Coping Cap (Himalayan slate/timber rim) */}
        <mesh position={[0, H_wall + 0.43, 0]}>
          <boxGeometry args={[L + 0.4, 0.03, W + 0.4]} />
          <meshStandardMaterial color="#475569" roughness={0.6} />
        </mesh>

        {/* ── Interior Warm Hearth / Occupancy Glow ── */}
        {/* Visible through south window at night/evening */}
        <pointLight
          position={[0, 1.2, 0]}
          intensity={1.5 + currentPoint.indoor_temp_c * 0.05}
          distance={8}
          color="#fef08a"
        />

        {/* ── Thermal Loss Radiation Halo ── */}
        {showThermalHeatmap && (
          <group ref={pulseRef}>
            <mesh position={[0, (H_wall + 0.4) / 2, 0]}>
              <boxGeometry args={[L + 0.5, H_wall + 0.6, W + 0.5]} />
              <meshBasicMaterial
                color={emissiveColor}
                transparent
                opacity={0.08 * lossIntensity}
                side={THREE.BackSide}
              />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}
