import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Web to Context Profile',
  description: 'Create context profiles from websites',
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
