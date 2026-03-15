import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pragati Finance - Loan Management System',
  description: 'Professional loan management system for microfinance operations',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased noise">{children}</body>
    </html>
  )
}
