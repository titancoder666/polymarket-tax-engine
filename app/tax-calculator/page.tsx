'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  parseCSV, calculateFIFO, computeSummary,
  generateForm8949, generateScheduleD, generateTurboTaxCSV, generateTaxSummaryCSV,
  type TaxLot, type TaxSummary,
} from '@/lib/tax-engine'

export default function TaxCalculator() {
  const [lots, setLots] = useState<TaxLot[]>([])
  const [summary, setSummary] = useState<TaxSummary | null>(null)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [txCount, setTxCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File) => {
    setError('')
    setProcessing(true)
    setFileName(file.name)
    setLots([])
    setSummary(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const txns = parseCSV(text)
        if (txns.length === 0) throw new Error('No valid transactions found in the CSV')
        setTxCount(txns.length)
        const taxLots = calculateFIFO(txns)
        const sum = computeSummary(taxLots)
        setLots(taxLots)
        setSummary(sum)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process CSV')
      } finally {
        setProcessing(false)
      }
    }
    reader.onerror = () => { setError('Failed to read file'); setProcessing(false) }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const download = (content: string, name: string) => {
    const blob = new Blob([content], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  const fmt = (n: number) => {
    const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `${n < 0 ? '-' : ''}$${s}`
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">CSV Tax Calculator</h1>
            <p className="text-gray-400">Upload your Polymarket trade history CSV — all processing happens in your browser</p>
          </div>
          <Link href="/" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">
            ← Username Lookup
          </Link>
        </div>

        {/* Upload Area */}
        <div
          className={`bg-slate-800 rounded-lg p-12 mb-8 border-2 border-dashed transition-colors cursor-pointer text-center ${
            dragOver ? 'border-violet-500 bg-violet-500/10' : 'border-slate-600 hover:border-slate-500'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }}
          />
          <div className="text-5xl mb-4">📄</div>
          <p className="text-lg font-semibold mb-1">
            {processing ? 'Processing...' : 'Drag & drop your CSV here, or click to browse'}
          </p>
          <p className="text-sm text-gray-500">
            Supports Polymarket trade export CSVs • TSV and custom formats accepted
          </p>
          {processing && (
            <div className="mt-4 flex justify-center">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Sample + Error */}
        <div className="flex items-center justify-between mb-6">
          <a
            href="/sample-polymarket.csv"
            download
            className="text-sm text-violet-400 hover:text-violet-300 transition"
          >
            📥 Download sample CSV to see expected format
          </a>
          {fileName && !error && !processing && (
            <span className="text-sm text-gray-500">
              Processed <strong>{fileName}</strong> — {txCount} transactions → {lots.length} tax lots
            </span>
          )}
        </div>
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Summary Dashboard */}
        {summary && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card label="Total Lots" value={summary.totalLots.toString()} />
              <Card label="Net Short-Term" value={fmt(summary.netShortTerm)} color={summary.netShortTerm >= 0 ? 'green' : 'red'} />
              <Card label="Net Long-Term" value={fmt(summary.netLongTerm)} color={summary.netLongTerm >= 0 ? 'green' : 'red'} />
              <Card label="Net Gain/Loss" value={fmt(summary.netTotal)} color={summary.netTotal >= 0 ? 'green' : 'red'} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card label="ST Gains" value={fmt(summary.shortTermGain)} color="green" small />
              <Card label="ST Losses" value={fmt(summary.shortTermLoss)} color="red" small />
              <Card label="LT Gains" value={fmt(summary.longTermGain)} color="green" small />
              <Card label="LT Losses" value={fmt(summary.longTermLoss)} color="red" small />
            </div>

            {/* Download Buttons */}
            <div className="bg-slate-800 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold mb-4">Download Reports</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button onClick={() => download(generateForm8949(lots), 'form-8949.csv')} className="btn-dl bg-violet-600 hover:bg-violet-700">
                  📋 Form 8949
                </button>
                <button onClick={() => download(generateScheduleD(summary), 'schedule-d-summary.csv')} className="btn-dl bg-blue-600 hover:bg-blue-700">
                  📊 Schedule D
                </button>
                <button onClick={() => download(generateTurboTaxCSV(lots), 'turbotax-import.csv')} className="btn-dl bg-green-600 hover:bg-green-700">
                  💰 TurboTax CSV
                </button>
                <button onClick={() => download(generateTaxSummaryCSV(lots, summary), 'tax-summary.csv')} className="btn-dl bg-orange-600 hover:bg-orange-700">
                  📄 Full Summary
                </button>
              </div>
            </div>

            {/* Lots Table */}
            <div className="bg-slate-800 rounded-lg overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-semibold">Tax Lots ({lots.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Acquired</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Sold</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Proceeds</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Cost Basis</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Gain/Loss</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Term</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {lots.slice(0, 200).map((l, i) => (
                      <tr key={i} className="hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-sm max-w-xs truncate">{l.description}</td>
                        <td className="px-4 py-3 text-sm">{l.dateAcquired}</td>
                        <td className="px-4 py-3 text-sm">{l.dateSold}</td>
                        <td className="px-4 py-3 text-sm text-right">{fmt(l.proceeds)}</td>
                        <td className="px-4 py-3 text-sm text-right">{fmt(l.costBasis)}</td>
                        <td className={`px-4 py-3 text-sm text-right font-semibold ${l.gainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {fmt(l.gainLoss)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            l.term === 'Short-term' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>{l.term}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {lots.length > 200 && (
                  <div className="p-4 text-center text-sm text-gray-400">
                    Showing first 200 of {lots.length} lots. Download reports for complete data.
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!summary && !processing && !error && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">Upload a CSV to calculate your Polymarket taxes</p>
            <p className="text-sm">FIFO cost basis • IRS Form 8949 • Schedule D • TurboTax compatible</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .btn-dl {
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 0.875rem;
          transition: background-color 0.2s;
          text-align: center;
        }
      `}</style>
    </div>
  )
}

function Card({ label, value, color, small }: { label: string; value: string; color?: string; small?: boolean }) {
  const colorClass = color === 'green' ? 'text-green-400' : color === 'red' ? 'text-red-400' : 'text-white'
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="text-xs text-gray-400 uppercase mb-1">{label}</div>
      <div className={`${small ? 'text-lg' : 'text-2xl'} font-bold ${colorClass}`}>{value}</div>
    </div>
  )
}
