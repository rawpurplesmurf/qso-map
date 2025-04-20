import { QsoMap } from "@/components/qso-map"

export default function MapPage() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <div className="w-full max-w-7xl space-y-4">
        <h1 className="text-2xl font-bold">Ham Radio QSO Map</h1>
        <QsoMap />
      </div>
    </main>
  )
}
