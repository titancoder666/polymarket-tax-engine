'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getUserProfile, calculateTaxRecords, type ProfileSummary, type PolymarketTrade, type TaxRecord } from '@/lib/polymarket'
import { computeSummary, generateForm8949, generateScheduleD, generateTurboTaxCSV, type TaxSummary } from '@/lib/tax-engine'

export default function Home() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState('')
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [taxRecords, setTaxRecords] = useState<TaxRecord[]>([])
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null)
  const [error, setError] = useState('')
  const [showTaxDetails, setShowTaxDetails] = useState(false)
  const [tradeCount, setTradeCount] = useState(0)

  const handleQuery = async () => {
    if (!username.trim()) {
      setError('Please enter a Polymarket username or wallet address')
      return
    }

    setLoading(true)
    setError('')
    setProfile(null)
    setTaxRecords([])
    setTaxSummary(null)

    try {
      setLoadingStage('Resolving username & fetching positions...')
      const profileData = await getUserProfile(username.trim())
      setProfile(profileData)

      setLoadingStage('Fetching trade history for tax calculation...')
      setTradeCount(0)

      // Use streaming API for trade fetching (supports 70K+ trades)
      const trades: PolymarketTrade[] = []
      const resp = await fetch(`/api/trades?wallet=${encodeURIComponent(profileData.wallet)}`)
      const reader = resp.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const msg = JSON.parse(line.slice(6))
              if (msg.type === 'progress') {
                setLoadingStage(`Fetching trades... Window ${msg.window}: ${msg.totalTrades.toLocaleString()} trades found`)
                setTradeCount(msg.totalTrades)
              } else if (msg.type === 'trades') {
                trades.push(...msg.trades)
              } else if (msg.type === 'error') {
                throw new Error(msg.message)
              }
            } catch (e) {
              if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e
            }
          }
        }
      }

      if (trades.length > 0) {
        setLoadingStage(`Calculating FIFO cost basis for ${trades.length.toLocaleString()} trades...`)
        setTradeCount(trades.length)
        const records = calculateTaxRecords(trades)
        setTaxRecords(records)
        setTaxSummary(computeSummary(records))
      }

      setLoadingStage('')
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch data. Please try again.')
    } finally {
      setLoading(false)
      setLoadingStage('')
    }
  }

  const download = (content: string, name: string) => {
    const blob = new Blob([content], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const fmt = (n: number) => {
    const abs = Math.abs(n)
    if (abs >= 1000) return `${n < 0 ? '-' : ''}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    return `${n < 0 ? '-' : ''}$${abs.toFixed(2)}`
  }

  const slug = username.replace(/[^a-zA-Z0-9]/g, '_')

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Polymarket Tax & P/L Engine</h1>
            <p className="text-gray-400">
              Enter your Polymarket username or wallet address to view P&L and generate tax reports
            </p>
          </div>
          <Link href="/tax-calculator" className="text-sm text-gray-500 hover:text-violet-400 transition">
            Or upload CSV manually →
          </Link>
        </div>

        {/* Input Section */}
        <div className="bg-slate-800 rounded-lg p-6 mb-8">
          <label className="block text-sm font-medium mb-2">Polymarket Username or Wallet Address</label>
          <div className="flex gap-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleQuery()}
              placeholder="e.g. Alexparker or 0x..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleQuery}
              disabled={loading}
              className="px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 rounded-lg font-semibold transition"
            >
              {loading ? 'Loading...' : 'Analyze'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          {loading && loadingStage && <p className="mt-2 text-sm text-violet-400 animate-pulse">{loadingStage}</p>}
        </div>

        {/* Profile Summary */}
        {profile && (
          <>
            <div className="bg-slate-800 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold">{profile.username}</h2>
                  {profile.joinDate && (
                    <span className="text-xs text-gray-500">Joined {new Date(profile.joinDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}{profile.views > 0 ? ` · ${(profile.views / 1000).toFixed(1)}K views` : ''}</span>
                  )}
                </div>
                <span className="text-xs text-gray-500 font-mono">{profile.wallet}</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="text-xs text-gray-400 uppercase mb-1">Positions Value</div>
                  <div className="text-2xl font-bold">{fmt(profile.positionsValue)}</div>
                </div>
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="text-xs text-gray-400 uppercase mb-1">Biggest Win</div>
                  <div className="text-2xl font-bold text-green-400">{fmt(profile.largestWin)}</div>
                </div>
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="text-xs text-gray-400 uppercase mb-1">Predictions</div>
                  <div className="text-2xl font-bold">{profile.predictions}</div>
                </div>
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="text-xs text-gray-400 uppercase mb-1">Volume</div>
                  <div className="text-2xl font-bold">{fmt(profile.totalVolume)}</div>
                </div>
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="text-xs text-gray-400 uppercase mb-1">All-Time P&L</div>
                  <div className={`text-2xl font-bold ${profile.allTimePnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmt(profile.allTimePnl)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-3 mb-6 text-center">
              <p className="text-xs text-gray-500">
                📊 Profile stats pulled directly from Polymarket — same numbers shown on their site
              </p>
            </div>

            {/* Positions Table */}
            <div className="bg-slate-800 rounded-lg overflow-hidden mb-6">
              <div className="p-6">
                <h2 className="text-xl font-semibold">Positions ({profile.positions.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Market</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Outcome</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Shares</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Avg Price</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Cur Price</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Invested</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Current</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">P&L</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {profile.positions.map((pos, idx) => (
                      <tr key={idx} className="hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-sm max-w-xs truncate">{pos.title}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            pos.outcome.toLowerCase() === 'yes' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>{pos.outcome}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{pos.size.toFixed(1)}</td>
                        <td className="px-4 py-3 text-sm text-right">{pos.avgPrice.toFixed(3)}</td>
                        <td className="px-4 py-3 text-sm text-right">{pos.curPrice.toFixed(3)}</td>
                        <td className="px-4 py-3 text-sm text-right">{fmt(pos.initialValue)}</td>
                        <td className="px-4 py-3 text-sm text-right">{fmt(pos.currentValue)}</td>
                        <td className={`px-4 py-3 text-sm text-right font-semibold ${pos.cashPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {fmt(pos.cashPnl)}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right ${pos.percentPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pos.percentPnl.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tax Reports Section */}
            {taxSummary && taxRecords.length > 0 && (
              <>
                <div className="bg-slate-800 rounded-lg p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-2">📋 Tax Reports — IRS Form 8949 / Schedule D</h2>
                  {tradeCount > 0 && (
                    <p className="text-sm text-gray-400 mb-4">
                      Based on {tradeCount.toLocaleString()} trades fetched via Activity API with time-windowed pagination
                    </p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-900 rounded-lg p-4">
                      <div className="text-xs text-gray-400 uppercase mb-1">Total Lots</div>
                      <div className="text-2xl font-bold">{taxSummary.totalLots}</div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-4">
                      <div className="text-xs text-gray-400 uppercase mb-1">Net Short-Term</div>
                      <div className={`text-2xl font-bold ${taxSummary.netShortTerm >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(taxSummary.netShortTerm)}
                      </div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-4">
                      <div className="text-xs text-gray-400 uppercase mb-1">Net Long-Term</div>
                      <div className={`text-2xl font-bold ${taxSummary.netLongTerm >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(taxSummary.netLongTerm)}
                      </div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-4">
                      <div className="text-xs text-gray-400 uppercase mb-1">Net Gain/Loss</div>
                      <div className={`text-2xl font-bold ${taxSummary.netTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(taxSummary.netTotal)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">ST Gains</div>
                      <div className="text-lg font-semibold text-green-400">{fmt(taxSummary.shortTermGain)}</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">ST Losses</div>
                      <div className="text-lg font-semibold text-red-400">{fmt(taxSummary.shortTermLoss)}</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">LT Gains</div>
                      <div className="text-lg font-semibold text-green-400">{fmt(taxSummary.longTermGain)}</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">LT Losses</div>
                      <div className="text-lg font-semibold text-red-400">{fmt(taxSummary.longTermLoss)}</div>
                    </div>
                  </div>

                  {/* Download Buttons */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => download(generateForm8949(taxRecords), `${slug}-form-8949.csv`)}
                      className="px-4 py-3 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold transition text-center"
                    >
                      📋 Form 8949 CSV
                    </button>
                    <button
                      onClick={() => download(generateScheduleD(taxSummary), `${slug}-schedule-d.csv`)}
                      className="px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition text-center"
                    >
                      📊 Schedule D Summary
                    </button>
                    <button
                      onClick={() => download(generateTurboTaxCSV(taxRecords), `${slug}-turbotax.csv`)}
                      className="px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold transition text-center"
                    >
                      💰 TurboTax Import CSV
                    </button>
                  </div>
                </div>

                {/* Tax Lots Table */}
                <div className="bg-slate-800 rounded-lg overflow-hidden mb-8">
                  <div className="p-6 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Tax Lots ({taxRecords.length})</h2>
                    <button
                      onClick={() => setShowTaxDetails(!showTaxDetails)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition"
                    >
                      {showTaxDetails ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>

                  {showTaxDetails && (
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
                          {taxRecords.slice(0, 100).map((r, idx) => (
                            <tr key={idx} className="hover:bg-slate-700/30">
                              <td className="px-4 py-3 text-sm max-w-xs truncate">{r.description}</td>
                              <td className="px-4 py-3 text-sm">{r.dateAcquired}</td>
                              <td className="px-4 py-3 text-sm">{r.dateSold}</td>
                              <td className="px-4 py-3 text-sm text-right">{fmt(r.proceeds)}</td>
                              <td className="px-4 py-3 text-sm text-right">{fmt(r.costBasis)}</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${r.gainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {fmt(r.gainLoss)}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  r.termType === 'Short-term' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                                }`}>{r.termType}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {taxRecords.length > 100 && (
                        <div className="p-4 text-center text-sm text-gray-400">
                          Showing first 100 of {taxRecords.length} records. Download reports for complete data.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Empty State */}
        {!profile && !loading && !error && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">Enter a Polymarket username or wallet to analyze</p>
            <p className="text-sm">We&apos;ll show your positions, P&L, and generate IRS Form 8949 + Schedule D tax reports</p>
          </div>
        )}
      </div>
    </div>
  )
}
