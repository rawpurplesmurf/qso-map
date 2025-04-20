import { FileUploader } from "@/components/file-uploader"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
      <div className="w-full max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold text-center">Ham Radio QSO Map Visualizer</h1>
        <p className="text-center text-muted-foreground">
          Upload your ADIF log file to visualize your QSOs on a world map
        </p>
        <FileUploader />
      </div>
    </main>
  )
}
