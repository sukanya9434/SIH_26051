"use client";

import dynamic from "next/dynamic";
import React from "react";
import { Loader2 } from "lucide-react";
import { ShelterGeometry, EnvelopeUValues, HourlyHeatFlowPoint } from "@/lib/api/heat-flow";

interface Dynamic3DViewProps {
  geometry: ShelterGeometry;
  uValues: EnvelopeUValues;
  currentPoint: HourlyHeatFlowPoint;
  hourlyData: HourlyHeatFlowPoint[];
  wallMaterial: string;
  className?: string;
}

const DynamicCanvas = dynamic(
  () => import("./Shelter3DCanvas").then((mod) => mod.Shelter3DCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[550px] w-full flex-col items-center justify-center rounded-none border border-border bg-card shadow-sm sm:h-[620px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="mt-3 text-xs font-medium text-muted-foreground">
          Initializing WebGL 3D Solar Canvas...
        </p>
      </div>
    ),
  }
);

export function Dynamic3DView(props: Dynamic3DViewProps) {
  return <DynamicCanvas {...props} />;
}
