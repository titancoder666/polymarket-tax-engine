import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Polymarket Tax Calculator — Free IRS Form 8949 & Schedule D | 2024 & 2025',
  description: 'Generate your Polymarket tax report in 60 seconds. Free IRS Form 8949, Schedule D, and TurboTax CSV. No signup required — just enter your username. Save $99 vs PolyTax.',
  keywords: 'polymarket tax, polymarket taxes, polymarket tax calculator, polymarket form 8949, polymarket schedule d, polymarket tax report, crypto tax, prediction market tax',
  openGraph: {
    title: 'Polymarket Tax Calculator — Free Tax Reports in 60 Seconds',
    description: 'No signup. No wallet connection. Just your Polymarket username. Get IRS-compliant Form 8949, Schedule D, and TurboTax CSV instantly. Free forever.',
    url: 'https://polymarket-tax-engine.vercel.app',
    siteName: 'Polymarket Tax Engine',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Polymarket Tax Calculator — Free Tax Reports',
    description: 'Generate IRS Form 8949 & Schedule D from your Polymarket trades in 60 seconds. No signup required.',
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
              description: 'Free tax calculator for Polymarket prediction market trades',
              url: 'https://polymarket-tax-engine.vercel.app',
              applicationCategory: 'FinanceApplication',
              operatingSystem: 'Web',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            }),
          }}
        />
      </head>
      <body className="bg-slate-950 text-white antialiased">{children}</body>
    </html>
  )
}
