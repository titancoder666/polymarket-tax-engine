import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Polymarket Tax Calculator — IRS Form 8949 & Schedule D | 2024 & 2025',
  description: 'Generate your Polymarket tax report in 60 seconds. Preview for free, download Form 8949, Schedule D, and TurboTax CSV for $49/year. No signup required — just enter your username. Half the price of PolyTax.',
  keywords: 'polymarket tax, polymarket taxes, polymarket tax calculator, polymarket form 8949, polymarket schedule d, polymarket tax report, crypto tax, prediction market tax',
  openGraph: {
    title: 'Polymarket Tax Calculator — Tax Reports in 60 Seconds',
    description: 'No signup. No wallet connection. Just your Polymarket username. Preview your tax report for free. Download IRS Form 8949, Schedule D, and TurboTax CSV for $49/year.',
    url: 'https://polymarket-tax-engine.vercel.app',
    siteName: 'Polymarket Tax Engine',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Polymarket Tax Calculator — $49/year',
    description: 'Generate IRS Form 8949 & Schedule D from your Polymarket trades in 60 seconds. Free preview, no signup required.',
  },
  robots: 'index, follow',
  alternates: { canonical: 'https://polymarket-tax-engine.vercel.app' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Polymarket Tax Engine',
              description: 'Tax calculator for Polymarket prediction market trades. Free preview, $49/year for full reports.',
              url: 'https://polymarket-tax-engine.vercel.app',
              applicationCategory: 'FinanceApplication',
              operatingSystem: 'Web',
              offers: { '@type': 'Offer', price: '49', priceCurrency: 'USD' },
            }),
          }}
        />
      </head>
      <body className="bg-slate-950 text-white antialiased">{children}<Analytics /></body>
    </html>
  )
}
