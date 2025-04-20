import { type NextRequest, NextResponse } from "next/server"

interface QSO {
  [key: string]: string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("adifFile") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const text = await file.text()
    const qsos = parseADIF(text)

    return NextResponse.json(qsos)
  } catch (error) {
    console.error("Error parsing ADIF file:", error)
    return NextResponse.json({ error: "Failed to parse ADIF file" }, { status: 500 })
  }
}

function parseADIF(adifText: string): QSO[] {
  const qsos: QSO[] = []

  // Find the end of header
  const headerEndIndex = adifText.indexOf("<EOH>")
  if (headerEndIndex === -1) {
    throw new Error("Invalid ADIF format: Missing EOH tag")
  }

  // Get the content after the header
  const content = adifText.substring(headerEndIndex + 5)

  // Split by EOR to get individual QSO records
  const qsoBlocks = content.split("<EOR>")

  // Process each QSO block
  for (const block of qsoBlocks) {
    if (!block.trim()) continue

    const qso: QSO = {}
    const position = 0

    // Find all field tags
    const tagRegex = /<([^:]+):(\d+)(:[^>]*)?>([^<]*)/g
    let match

    while ((match = tagRegex.exec(block)) !== null) {
      const [, fieldName, lengthStr, , fieldValue] = match
      qso[fieldName] = fieldValue.trim()
    }

    if (Object.keys(qso).length > 0) {
      qsos.push(qso)
    }
  }

  return qsos
}
