"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { HourlyHeatFlowPoint } from "@/lib/api/heat-flow";

interface SunTrackerProps {
  currentPoint: HourlyHeatFlowPoint;
  hourlyData: HourlyHeatFlowPoint[];
  radius?: number;
}

/**
 * Maps real solar elevation (alpha) and azimuth (psi) to Three.js coordinates.
 * Convention:
 *   North is -Z
 *   South is +Z
 *   East is +X
 *   West is -X
 *   Up is +Y
 */
export function getSunCoordinates(elevationDeg: number, azimuthDeg: number, radius: number): [number, number, number] {
  const elevRad = (elevationDeg * Math.PI) / 180;
  const azRad = (azimuthDeg * Math.PI) / 180;

  const y = radius * Math.sin(elevRad);
  const rGround = radius * Math.cos(elevRad);
  const x = rGround * Math.sin(azRad);
  const z = -rGround * Math.cos(azRad);

  return [x, y, z];
}

export function SunTracker({ currentPoint, hourlyData, radius = 13.0 }: SunTrackerProps) {
  const [sunX, sunY, sunZ] = useMemo(() => {
    return getSunCoordinates(currentPoint.sun_elevation_deg, currentPoint.sun_azimuth_deg, radius);
  }, [currentPoint.sun_elevation_deg, currentPoint.sun_azimuth_deg, radius]);

  const isSunUp = currentPoint.is_sun_up;

  // Compute 24-hour arc trajectory for this specific date & location
  const arcPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    hourlyData.forEach((pt) => {
      const [x, y, z] = getSunCoordinates(pt.sun_elevation_deg, pt.sun_azimuth_deg, radius);
      pts.push(new THREE.Vector3(x, y, z));
    });
    // Loop back to start to close trajectory curve
    if (hourlyData.length > 0) {
      const [x0, y0, z0] = getSunCoordinates(hourlyData[0].sun_elevation_deg, hourlyData[0].sun_azimuth_deg, radius);
      pts.push(new THREE.Vector3(x0, y0, z0));
    }
    return pts;
  }, [hourlyData, radius]);

  const arcGeometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(arcPoints);
  }, [arcPoints]);

  // Light color shifts from morning amber to midday brilliant white to evening warm gold
  const lightColor = useMemo(() => {
    const elev = currentPoint.sun_elevation_deg;
    if (elev < 5) return "#f97316"; // deep dawn/sunset orange
    if (elev < 20) return "#fbbf24"; // golden morning/late afternoon
    return "#fffbeb"; // crisp high-altitude sunlight
  }, [currentPoint.sun_elevation_deg]);

  // Directional light intensity scaled to GHI and solar elevation
  const lightIntensity = useMemo(() => {
    if (!isSunUp) return 0.05;
    const sinElev = Math.max(0.1, Math.sin((currentPoint.sun_elevation_deg * Math.PI) / 180));
    return Math.min(2.5, 0.4 + sinElev * 2.0);
  }, [isSunUp, currentPoint.sun_elevation_deg]);

  return (
    <group>
      {/* 24-hour sun arc spline */}
      {/* @ts-expect-error Three.js line component in R3F */}
      <line geometry={arcGeometry}>
        <lineDashedMaterial
          color="#f59e0b"
          opacity={0.35}
          transparent
          dashSize={0.4}
          gapSize={0.2}
          linewidth={1}
        />
      </line>

      {/* Sun Mesh & Core Light */}
      {isSunUp ? (
        <group position={[sunX, sunY, sunZ]}>
          {/* Warm atmospheric halo and a crisp high-altitude sun disc */}
          <pointLight
            color="#ffd27a"
            intensity={Math.min(4, lightIntensity * 1.2)}
            distance={10}
            decay={2}
          />
          <mesh rotation={[0.18, -0.32, 0.12]}>
            <torusGeometry args={[0.84, 0.035, 12, 64]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.7} />
          </mesh>
          <mesh rotation={[0.18, -0.32, 0.12]}>
            <torusGeometry args={[1.08, 0.025, 12, 64]} />
            <meshBasicMaterial color="#fde68a" transparent opacity={0.35} />
          </mesh>
          {/* Glowing core sphere */}
          <mesh>
            <sphereGeometry args={[0.62, 40, 40]} />
            <meshBasicMaterial color={lightColor} />
          </mesh>

          {/* Corona lens glow */}
          <mesh>
            <sphereGeometry args={[1.3, 24, 24]} />
            <meshBasicMaterial color="#fef08a" transparent opacity={0.13} depthWrite={false} />
          </mesh>

          {/* Directional sunlight casting shadows towards shelter */}
          <directionalLight
            position={[0, 0, 0]}
            target-position={[0, 1.3, 0]}
            intensity={lightIntensity}
            color={lightColor}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={0.5}
            shadow-camera-far={35}
            shadow-camera-left={-8}
            shadow-camera-right={8}
            shadow-camera-top={8}
            shadow-camera-bottom={-8}
          />
        </group>
      ) : (
        /* Night-time Moon / Starlight proxy */
        <group position={[sunX, Math.max(1.0, Math.abs(sunY)), sunZ]}>
          <mesh>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshBasicMaterial color="#94a3b8" transparent opacity={0.6} />
          </mesh>
          <directionalLight
            position={[0, 0, 0]}
            target-position={[0, 1.3, 0]}
            intensity={0.15}
            color="#38bdf8"
          />
        </group>
      )}
    </group>
  );
}
