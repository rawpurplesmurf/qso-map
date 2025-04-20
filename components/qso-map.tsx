"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ComposableMap, Geographies, Geography, Line, Marker } from "react-simple-maps"
import { format, parse, isWithinInterval } from "date-fns"
import { Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Define the QSO type based on the ADIF format
interface QSO {
  CALL: string
  QSO_DATE: string
  TIME_ON: string
  FREQ: string
  MODE: string
  BAND: string
  RST_SENT: string
  RST_RCVD: string
  GRIDSQUARE?: string
  COMMENT?: string
  NAME?: string
  QTH?: string
  COUNTRY?: string
  LAT?: string
  LON?: string
  STATION_CALLSIGN: string
  MY_GRIDSQUARE: string
  MY_LAT?: string
  MY_LON?: string
}

// Function to convert grid square to lat/lon
function gridToLatLon(grid: string): [number, number] | null {
  if (!grid || grid.length < 4) return null

  try {
    // Basic grid square conversion (this is simplified)
    const lon = -180 + ((grid.charCodeAt(0) - 65) * 20 + Number.parseInt(grid.charAt(2)) * 2)
    const lat = -90 + ((grid.charCodeAt(1) - 65) * 10 + Number.parseInt(grid.charAt(3)))

    return [lat, lon]
  } catch (e) {
    return null
  }
}

// Function to parse lat/lon strings from ADIF
function parseLatLon(lat?: string, lon?: string): [number, number] | null {
  if (!lat || !lon) return null

  try {
    // Parse formats like "N045 26.250" to decimal degrees
    const latDir = lat.charAt(0)
    const latDeg = Number.parseFloat(lat.substring(1, 4))
    const latMin = Number.parseFloat(lat.substring(5))
    let latDecimal = latDeg + latMin / 60
    if (latDir === "S") latDecimal = -latDecimal

    const lonDir = lon.charAt(0)
    const lonDeg = Number.parseFloat(lon.substring(1, 4))
    const lonMin = Number.parseFloat(lon.substring(5))
    let lonDecimal = lonDeg + lonMin / 60
    if (lonDir === "W") lonDecimal = -lonDecimal

    return [latDecimal, lonDecimal]
  } catch (e) {
    return null
  }
}

export function QsoMap() {
  const router = useRouter()
  const [qsos, setQsos] = useState<QSO[]>([])
  const [dateRange, setDateRange] = useState<[Date, Date]>([new Date(0), new Date()])
  const [currentRange, setCurrentRange] = useState<[Date, Date]>([new Date(0), new Date()])
  const [sliderValue, setSliderValue] = useState<number[]>([100])
  const [selectedQso, setSelectedQso] = useState<QSO | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)

  // Use a more reliable TopoJSON source
  const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

  useEffect(() => {
    // Get QSO data from sessionStorage
    const storedData = sessionStorage.getItem("qsoData")

    if (!storedData) {
      router.push("/")
      return
    }

    try {
      const parsedData = JSON.parse(storedData) as QSO[]
      setQsos(parsedData)

      // Find min and max dates
      if (parsedData.length > 0) {
        const dates = parsedData
          .map((qso) => {
            if (!qso.QSO_DATE) {
              console.warn("QSO record missing QSO_DATE:", qso)
              return null
            }
            try {
              return parse(qso.QSO_DATE, "yyyyMMdd", new Date())
            } catch (error) {
              console.warn("Invalid QSO_DATE format:", qso.QSO_DATE, "in QSO:", qso)
              return null
            }
          })
          .filter((date): date is Date => date !== null)
          .sort((a, b) => a.getTime() - b.getTime())

        if (dates.length > 0) {
          setDateRange([dates[0], dates[dates.length - 1]])
          setCurrentRange([dates[0], dates[0]]) // Start with first day
          setSliderValue([0]) // Start at beginning
        } else {
          console.warn("No valid dates found in QSO data")
          // Set default date range to current month
          const now = new Date()
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
          setDateRange([startOfMonth, now])
          setCurrentRange([startOfMonth, startOfMonth])
          setSliderValue([0])
        }
      }
    } catch (error) {
      console.error("Error parsing QSO data:", error)
      router.push("/")
    }
  }, [router])

  // Filter QSOs based on current date range
  const filteredQsos = qsos.filter((qso) => {
    if (!qso.QSO_DATE) return false
    try {
      const qsoDate = parse(qso.QSO_DATE, "yyyyMMdd", new Date())
      // Check if the QSO date matches the current selected date
      return qsoDate.toDateString() === currentRange[0].toDateString()
    } catch (e) {
      console.warn("Error parsing date for QSO:", qso)
      return false
    }
  })

  // Handle slider change
  const handleSliderChange = (value: number[]) => {
    setSliderValue(value)

    if (dateRange[0] && dateRange[1]) {
      const percentage = value[0]
      const totalDays = Math.floor((dateRange[1].getTime() - dateRange[0].getTime()) / (1000 * 60 * 60 * 24))
      const selectedDay = Math.round(totalDays * (percentage / 100))

      const selectedDate = new Date(dateRange[0])
      selectedDate.setDate(selectedDate.getDate() + selectedDay)
      setCurrentRange([selectedDate, selectedDate])
    }
  }

  // Get coordinates for a QSO
  const getCoordinates = (qso: QSO): { from: [number, number]; to: [number, number] } | null => {
    let fromCoords: [number, number] | null = null
    let toCoords: [number, number] | null = null

    // Try to get coordinates from LAT/LON fields
    if (qso.MY_LAT && qso.MY_LON) {
      fromCoords = parseLatLon(qso.MY_LAT, qso.MY_LON)
    }

    // If not available, try grid square
    if (!fromCoords && qso.MY_GRIDSQUARE) {
      fromCoords = gridToLatLon(qso.MY_GRIDSQUARE)
    }

    // Default to a location if we can't determine it
    if (!fromCoords) {
      // Default to a location in the US (since the example shows US station)
      fromCoords = [47.0, -122.0] // Approximate location for WA, USA
    }

    // Try to get coordinates for the contacted station
    if (qso.LAT && qso.LON) {
      toCoords = parseLatLon(qso.LAT, qso.LON)
    }

    // If not available, try grid square
    if (!toCoords && qso.GRIDSQUARE) {
      toCoords = gridToLatLon(qso.GRIDSQUARE)
    }

    if (fromCoords && toCoords) {
      return { from: fromCoords, to: toCoords }
    }

    return null
  }

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <Button onClick={() => router.push("/")} variant="outline">
          Upload Another Log
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {format(currentRange[0], "MMM d, yyyy")}
          </span>
          <div className="w-48 md:w-80">
            <Slider value={sliderValue} onValueChange={handleSliderChange} max={100} step={1} />
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {format(currentRange[1], "MMM d, yyyy")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{filteredQsos.length} QSOs</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Hover over lines to see QSO details</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="relative border rounded-lg overflow-hidden bg-background" style={{ height: "70vh" }}>
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{
            scale: 180,
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography key={geo.rsmKey} geography={geo} fill="#2C3440" stroke="#1A1F28" strokeWidth={0.5} />
              ))
            }
          </Geographies>

          {filteredQsos.map((qso, index) => {
            const coords = getCoordinates(qso)
            if (!coords) return null

            return (
              <g key={index}>
                <Line
                  from={coords.from}
                  to={coords.to}
                  stroke="#FF6B6B"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  onMouseEnter={(e) => {
                    setSelectedQso(qso)
                    setTooltipPosition({ x: e.clientX, y: e.clientY })
                  }}
                  onMouseLeave={() => {
                    setSelectedQso(null)
                    setTooltipPosition(null)
                  }}
                  style={{ cursor: "pointer" }}
                />
                <Marker coordinates={coords.from}>
                  <circle r={3} fill="#4CC9F0" />
                </Marker>
                <Marker coordinates={coords.to}>
                  <circle r={3} fill="#F72585" />
                </Marker>
              </g>
            )
          })}
        </ComposableMap>

        {selectedQso && tooltipPosition && (
          <div
            className="absolute z-50 w-64"
            style={{
              left: tooltipPosition.x,
              top: tooltipPosition.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            <Card>
              <CardContent className="p-3 text-xs space-y-1">
                <div className="font-bold text-sm">{selectedQso.CALL}</div>
                <div>Date: {format(parse(selectedQso.QSO_DATE, "yyyyMMdd", new Date()), "MMM d, yyyy")}</div>
                <div>Time: {selectedQso.TIME_ON.replace(/(\d{2})(\d{2})(\d{2})/, "$1:$2:$3")}</div>
                <div>
                  Band: {selectedQso.BAND} - Mode: {selectedQso.MODE}
                </div>
                {selectedQso.NAME && <div>Name: {selectedQso.NAME}</div>}
                {selectedQso.QTH && <div>QTH: {selectedQso.QTH}</div>}
                {selectedQso.COUNTRY && <div>Country: {selectedQso.COUNTRY}</div>}
                {selectedQso.COMMENT && <div>Comment: {selectedQso.COMMENT}</div>}
                <div>
                  RST: {selectedQso.RST_SENT}/{selectedQso.RST_RCVD}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="flex justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#4CC9F0]"></div>
          <span>Your station ({qsos[0]?.STATION_CALLSIGN || "N/A"})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#F72585]"></div>
          <span>Contacted stations</span>
        </div>
      </div>
    </div>
  )
}
