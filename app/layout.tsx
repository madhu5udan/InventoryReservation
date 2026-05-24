import type { Metadata } from "next"
import "./globals.css"
export const metadata: Metadata = {
  title: "Inventory Reservation System",
  description: "Race-condition safe inventory reservation system",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  )
}
