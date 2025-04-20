"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export function FileUploader() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.name.endsWith(".adi") || selectedFile.name.endsWith(".adif")) {
        setFile(selectedFile)
        setError(null)
      } else {
        setFile(null)
        setError("Please select a valid ADIF file (.adi or .adif)")
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError(null)
    setProgress(0)

    try {
      // Simulate progress for file reading
      setProgress(20)
      const formData = new FormData()
      formData.append("adifFile", file)

      setProgress(40)
      const response = await fetch("/api/parse-adif", {
        method: "POST",
        body: formData,
      })

      setProgress(60)
      if (!response.ok) {
        throw new Error("Failed to parse ADIF file")
      }

      const data = await response.json()
      setProgress(80)

      // Store the parsed data in sessionStorage
      sessionStorage.setItem("qsoData", JSON.stringify(data))
      setProgress(100)

      // Navigate to the map page
      router.push("/map")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setProgress(0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload ADIF Log File</CardTitle>
        <CardDescription>Upload your ADIF log file to visualize your QSOs on a world map</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <div
                className={`border-2 border-dashed rounded-md p-8 flex flex-col items-center justify-center ${
                  loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-primary/50"
                } transition-colors`}
                onClick={() => !loading && document.getElementById("file-upload")?.click()}
              >
                {loading ? (
                  <Loader2 className="h-10 w-10 text-muted-foreground mb-2 animate-spin" />
                ) : (
                  <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                )}
                <p className="text-sm text-muted-foreground mb-1">
                  {file ? file.name : "Click to upload or drag and drop"}
                </p>
                <p className="text-xs text-muted-foreground">ADIF files only (.adi, .adif)</p>
                <input
                  id="file-upload"
                  type="file"
                  accept=".adi,.adif"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={loading}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {loading && (
                <div className="space-y-2">
                  <Progress value={progress} className="w-full" />
                  <p className="text-sm text-muted-foreground text-center">
                    {progress < 40
                      ? "Reading file..."
                      : progress < 60
                      ? "Parsing ADIF data..."
                      : progress < 80
                      ? "Processing QSOs..."
                      : "Preparing visualization..."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => setFile(null)} disabled={!file || loading}>
          Clear
        </Button>
        <Button onClick={handleSubmit} disabled={!file || loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Visualize QSOs"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
