"use client"

import { useEffect, useRef, useState } from "react"
import { getClimate, type ClimateData } from "@/lib/api"

type ClimateFieldValues = Record<string, string>

interface UseClimateAutoFillOptions {
  latitude: string
  longitude: string
  toFields: (climate: ClimateData) => ClimateFieldValues
  onFields: (fields: ClimateFieldValues) => void
}

export function useClimateAutoFill({
  latitude,
  longitude,
  toFields,
  onFields,
}: UseClimateAutoFillOptions) {
  const [manualOverride, setManualOverride] = useState(false)
  const [climateLoading, setClimateLoading] = useState(false)
  const [climateError, setClimateError] = useState("")
  const [climateSynced, setClimateSynced] = useState(false)
  const lastFetchedFields = useRef<ClimateFieldValues | null>(null)
  const requestId = useRef(0)
  const toFieldsRef = useRef(toFields)
  const onFieldsRef = useRef(onFields)
  useEffect(() => {
    toFieldsRef.current = toFields
    onFieldsRef.current = onFields
  }, [onFields, toFields])

  useEffect(() => {
    const lat = Number(latitude)
    const lon = Number(longitude)
    if (!latitude || !longitude || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return
    }

    const timer = window.setTimeout(async () => {
      const id = ++requestId.current
      setClimateLoading(true)
      setClimateError("")
      setClimateSynced(false)

      try {
        const climate = await getClimate(lat, lon)
        if (id !== requestId.current) return
        const fields = toFieldsRef.current(climate)
        lastFetchedFields.current = fields
        onFieldsRef.current(fields)
        setClimateSynced(true)
      } catch {
        if (id !== requestId.current) return
        setClimateError("Couldn’t fetch climate data — enter values manually.")
        setManualOverride(true)
      } finally {
        if (id === requestId.current) setClimateLoading(false)
      }
    }, 450)

    return () => window.clearTimeout(timer)
  }, [latitude, longitude])

  function toggleManualOverride(enabled: boolean) {
    setManualOverride(enabled)
    if (!enabled && lastFetchedFields.current) {
      onFieldsRef.current(lastFetchedFields.current)
    }
  }

  return {
    manualOverride,
    setManualOverride: toggleManualOverride,
    climateLoading,
    climateError,
    climateSynced,
    lastFetchedFields,
  }
}
