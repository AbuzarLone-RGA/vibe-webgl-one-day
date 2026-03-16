import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Particle Field',
  description: 'Cinematic WebGL particle field',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
