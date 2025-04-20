"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import * as d3 from "d3"
import { format } from "date-fns"
import { Info, X, ZoomIn, ZoomOut, Maximize2 } from "lucide-react"

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
    // Maidenhead grid square format: AA11aa (e.g., CN86RX)
    // First two letters: A=0-17, a=0-17 (longitude/latitude fields)
    // First two numbers: 0-9 (longitude/latitude sub-fields)
    // Last two letters: x=0-24, x=0-24 (longitude/latitude sub-sub-fields)
    
    // Extract components
    const A = grid.charCodeAt(0) - 65 // First letter (0-17)
    const a = grid.charCodeAt(1) - 65 // Second letter (0-17)
    const B = parseInt(grid.charAt(2)) // First number (0-9)
    const b = parseInt(grid.charAt(3)) // Second number (0-9)
    
    // For 6-character grid squares (e.g., CN86RX)
    let x = 0, y = 0
    if (grid.length >= 6) {
      x = grid.charCodeAt(4) - 65 // Fifth character (0-24)
      y = grid.charCodeAt(5) - 65 // Sixth character (0-24)
    }
    
    // Calculate longitude (A=0-17, B=0-9, x=0-24)
    // Each field is 20 degrees, each sub-field is 2 degrees, each sub-sub-field is 5 minutes
    const lon = -180 + (A * 20) + (B * 2) + (x * 5/60)
    
    // Calculate latitude (a=0-17, b=0-9, y=0-24)
    // Each field is 10 degrees, each sub-field is 1 degree, each sub-sub-field is 2.5 minutes
    const lat = -90 + (a * 10) + b + (y * 2.5/60)
    
    console.log(`Grid ${grid} converted to lat: ${lat}, lon: ${lon}`)
    return [lat, lon]
  } catch (e) {
    console.warn("Error converting grid square:", grid, e)
    return null
  }
}

export function QsoMapD3() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const [qsos, setQsos] = useState<QSO[]>([])
  const [dateRange, setDateRange] = useState<[Date, Date]>([new Date(0), new Date()])
  const [currentRange, setCurrentRange] = useState<[Date, Date]>([new Date(0), new Date()])
  const [sliderValue, setSliderValue] = useState<number[]>([0])
  const [selectedQso, setSelectedQso] = useState<QSO | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [translate, setTranslate] = useState<[number, number]>([0, 0])

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
              // Parse date in YYYYMMDD format
              // For example: 20220120 should be February 20, 2022 (not January 20, 2022)
              const year = parseInt(qso.QSO_DATE.substring(0, 4))
              const month = parseInt(qso.QSO_DATE.substring(4, 6)) - 1 // JS months are 0-indexed
              const day = parseInt(qso.QSO_DATE.substring(6, 8))
              
              console.log(`Parsing date: ${qso.QSO_DATE} -> Year: ${year}, Month: ${month+1}, Day: ${day}`)
              return new Date(year, month, day)
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
      // Parse date in YYYYMMDD format
      const year = parseInt(qso.QSO_DATE.substring(0, 4))
      const month = parseInt(qso.QSO_DATE.substring(4, 6)) - 1 // JS months are 0-indexed
      const day = parseInt(qso.QSO_DATE.substring(6, 8))
      const qsoDate = new Date(year, month, day)
      
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
    // Get your station's coordinates from MY_GRIDSQUARE
    const fromCoords = qso.MY_GRIDSQUARE ? gridToLatLon(qso.MY_GRIDSQUARE) : null

    // Get the contacted station's coordinates from GRIDSQUARE
    const toCoords = qso.GRIDSQUARE ? gridToLatLon(qso.GRIDSQUARE) : null

    // If we have both coordinates, return them
    if (fromCoords && toCoords) {
      console.log(`QSO from ${qso.MY_GRIDSQUARE} (${fromCoords[0]}, ${fromCoords[1]}) to ${qso.GRIDSQUARE} (${toCoords[0]}, ${toCoords[1]})`)
      return { from: fromCoords, to: toCoords }
    }

    // Log missing grid squares for debugging
    if (!fromCoords) {
      console.warn("Missing or invalid MY_GRIDSQUARE:", qso.MY_GRIDSQUARE, "for QSO:", qso)
    }
    if (!toCoords) {
      console.warn("Missing or invalid GRIDSQUARE:", qso.GRIDSQUARE, "for QSO:", qso)
    }

    return null
  }

  // Update dimensions on window resize
  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current) {
        const { width, height } = svgRef.current.getBoundingClientRect()
        setDimensions({ width, height })
      }
    }

    window.addEventListener('resize', handleResize)
    handleResize() // Initial size

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Handle zoom and pan
  const handleWheel = (event: WheelEvent) => {
    event.preventDefault()
    const delta = event.deltaY
    const zoomFactor = delta > 0 ? 0.9 : 1.1
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.5), 5)
    setZoom(newZoom)
  }

  const handleMouseDown = (event: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: event.clientX, y: event.clientY })
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging || !dragStart) return
    const dx = event.clientX - dragStart.x
    const dy = event.clientY - dragStart.y
    setTranslate([translate[0] + dx, translate[1] + dy])
    setDragStart({ x: event.clientX, y: event.clientY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDragStart(null)
  }

  // Add event listeners for zoom and pan
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    svg.addEventListener('wheel', handleWheel as any)
    return () => {
      svg.removeEventListener('wheel', handleWheel as any)
    }
  }, [zoom])

  // Handle zoom controls
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.5))
  }

  const handleZoomReset = () => {
    setZoom(1)
    setTranslate([0, 0])
  }

  const handleZoomSliderChange = (value: number[]) => {
    setZoom(value[0])
  }

  // Render the map using D3
  useEffect(() => {
    if (!svgRef.current || filteredQsos.length === 0) return

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove()

    // Create SVG group for the map
    const svg = d3.select(svgRef.current)
    const g = svg.append("g")
      .attr("transform", `translate(${translate[0]},${translate[1]}) scale(${zoom})`)

    // Create a projection that better fits the world map
    const projection = d3.geoMercator()
      .scale(200)
      .center([0, 30])
      .translate([dimensions.width / 2, dimensions.height / 2])

    // Create a path generator
    const path = d3.geoPath().projection(projection)

    // Load world map data
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
      .then((data: any) => {
        if (!data || !data.features || !Array.isArray(data.features)) {
          throw new Error("Invalid map data format")
        }

        try {
          // Draw the map
          g.selectAll("path")
            .data(data.features)
            .enter()
            .append("path")
            .attr("d", (d: any) => {
              try {
                return path(d) || ""
              } catch (e) {
                console.warn("Error generating path for feature:", e)
                return ""
              }
            })
            .attr("fill", "#2C3440")
            .attr("stroke", "#1A1F28")
            .attr("stroke-width", 0.5)

          // Draw QSO lines and markers
          filteredQsos.forEach((qso, index) => {
            const coords = getCoordinates(qso)
            if (!coords) return

            // Convert lat/lon to screen coordinates
            const fromPoint = projection([coords.from[1], coords.from[0]])
            const toPoint = projection([coords.to[1], coords.to[0]])

            if (!fromPoint || !toPoint) {
              console.warn("Could not project coordinates for QSO:", qso)
              return
            }

            // Draw the line
            g.append("line")
              .attr("x1", fromPoint[0])
              .attr("y1", fromPoint[1])
              .attr("x2", toPoint[0])
              .attr("y2", toPoint[1])
              .attr("stroke", "#FF6B6B")
              .attr("stroke-width", 1.5)
              .attr("stroke-linecap", "round")
              .style("cursor", "pointer")
              .on("mouseenter", (event) => {
                setSelectedQso(qso)
                setTooltipPosition({ x: event.clientX, y: event.clientY })
              })
              .on("mouseleave", () => {
                setSelectedQso(null)
                setTooltipPosition(null)
              })

            // Draw the markers
            g.append("circle")
              .attr("cx", fromPoint[0])
              .attr("cy", fromPoint[1])
              .attr("r", 4)
              .attr("fill", "#4CC9F0")
              .attr("stroke", "#FFFFFF")
              .attr("stroke-width", 1)

            g.append("circle")
              .attr("cx", toPoint[0])
              .attr("cy", toPoint[1])
              .attr("r", 4)
              .attr("fill", "#F72585")
              .attr("stroke", "#FFFFFF")
              .attr("stroke-width", 1)
          })
        } catch (error) {
          console.error("Error rendering map:", error)
          g.append("text")
            .attr("x", dimensions.width / 2)
            .attr("y", dimensions.height / 2)
            .attr("text-anchor", "middle")
            .attr("fill", "#FF6B6B")
            .text("Error rendering map. Please try again.")
        }
      })
      .catch(error => {
        console.error("Error loading map data:", error)
        g.append("text")
          .attr("x", dimensions.width / 2)
          .attr("y", dimensions.height / 2)
          .attr("text-anchor", "middle")
          .attr("fill", "#FF6B6B")
          .text("Error loading map data. Please try again.")
      })
  }, [filteredQsos, dimensions, zoom, translate])

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

      <div className="flex flex-col gap-4">
        <div 
          className="relative border rounded-lg overflow-hidden bg-background" 
          style={{ height: "70vh" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg 
            ref={svgRef} 
            width="100%" 
            height="100%" 
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          />

          {/* Zoom Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-background/80 p-2 rounded-lg border">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomIn}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomOut}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomReset}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom Slider */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-48 bg-background/80 p-2 rounded-lg border">
            <Slider
              value={[zoom]}
              onValueChange={handleZoomSliderChange}
              min={0.5}
              max={5}
              step={0.1}
              className="w-full"
            />
          </div>

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
                  <div className="flex justify-between items-start">
                    <div className="font-bold text-sm">{selectedQso.CALL}</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0"
                      onClick={() => {
                        setSelectedQso(null)
                        setTooltipPosition(null)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div>Date: {
                    (() => {
                      try {
                        const year = parseInt(selectedQso.QSO_DATE.substring(0, 4))
                        const month = parseInt(selectedQso.QSO_DATE.substring(4, 6)) - 1
                        const day = parseInt(selectedQso.QSO_DATE.substring(6, 8))
                        const date = new Date(year, month, day)
                        return format(date, "MMM d, yyyy")
                      } catch (e) {
                        return "Invalid date"
                      }
                    })()
                  }</div>
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
        <div className="flex items-center gap-2">
          <span className="text-sm">Zoom: {Math.round(zoom * 100)}%</span>
        </div>
      </div>
    </div>
  )
} 