'use client'

import { useState } from 'react'
import { getUserProfile, getUserTrades, calculateTaxRecords, exportToCSV, type ProfileSummary, type TaxRecord } from '@/lib/polymarket'

export default function Home() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState('')
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [taxRecords, setTaxRecords] = useState<TaxRecord[]>([])
  const [error, setError] = useState('')
  const [showTaxDetails, setShowTaxDetails] = useState(false)

  const handleQuery = async () => {
    if (!username.trim()) {
      setError('Please enter a Polymarket username or wallet address')
      return
    }

    setLoading(true)
    setError('')
    setProfile(null)
    setTaxRecords([])

    try {
      // Step 1: Fetch profile with positions P&L (fast, source of truth)
      setLoadingStage('Resolving username & fetching positions...')
      const profileData = await getUserProfile(username.trim())
      setProfile(profileData)
      
      // Step 2: Fetch trades for tax records (slower, needs pagination)
      setLoadingStage('Fetching trade history for tax calculation...')
      const trades = await getUserTrades(username.trim())
      
      if (trades.length > 0) {
        setLoadingStage('Calculating FIFO cost basis...')
        const records = calculateTaxRecords(trades)
        setTaxRecords(records)
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

  const handleExport = () => {
    const csv = exportToCSV(taxRecords)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `polymarket-tax-${username.replace(/[^a-zA-Z0-9]/g, '_')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const fmt = (n: number) => {
    const abs = Math.abs(n)
    if (abs >= 1000) return `${n < 0 ? '-' : ''}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    return `${n < 0 ? '-' : ''}$${abs.toFixed(2)}`
  }

  const totalTaxGainLoss = taxRecords.reduce((sum, r) => sum + r.gainLoss, 0)

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Polymarket Tax & P/L Engine</h1>
          <p className="text-gray-400">
            Enter your Polymarket username or wallet address to view P&L and export tax-ready data
          </p>
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
                <h2 className="text-2xl font-bold">{profile.username}</h2>
                <span className="text-xs text-gray-500 font-mono">{profile.wallet}</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="text-xs text-gray-400 uppercase mb-1">Markets Traded</div>
                  <div className="text-2xl font-bold">{profile.marketsTraded}</div>
                </div>
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="text-xs text-gray-400 uppercase mb-1">Portfolio Value</div>
                  <div className="text-2xl font-bold">{fmt(profile.portfolioValue)}</div>
                </div>
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="text-xs text-gray-400 uppercase mb-1">Total Volume</div>
                  <div className="text-2xl font-bold">{fmt(profile.totalInitialValue)}</div>
                </div>
                <div className="bg-slate-900 rounded-lg p-4">
                  <div className="text-xs text-gray-400 uppercase mb-1">All-Time P&L</div>
                  <div className={`text-2xl font-bold ${profile.totalCashPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmt(profile.totalCashPnl)}
                  </div>
                </div>
              </div>
            </div>

            {/* P&L Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800 rounded-lg p-6">
                <div className="text-sm text-gray-400 mb-1">Realized P&L</div>
                <div className={`text-3xl font-bold ${profile.totalRealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmt(profile.totalRealizedPnl)}
                </div>
                <p className="text-xs text-gray-500 mt-1">From closed positions</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-6">
                <div className="text-sm text-gray-400 mb-1">Unrealized P&L</div>
                <div className={`text-3xl font-bold ${profile.totalUnrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmt(profile.totalUnrealizedPnl)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Open positions</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-6">
                <div className="text-sm text-gray-400 mb-1">Current Holdings</div>
                <div className="text-3xl font-bold">{fmt(profile.totalCurrentValue)}</div>
                <p className="text-xs text-gray-500 mt-1">Total position value</p>
              </div>
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
                          {(pos.percentPnl * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tax Section */}
            {taxRecords.length > 0 && (
              <div className="bg-slate-800 rounded-lg overflow-hidden mb-8">
                <div className="p-6 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold">Tax Records — IRS Form 8949</h2>
                    <p className="text-sm text-gray-400 mt-1">
                      {taxRecords.length} records | FIFO Realized P&L: <span className={totalTaxGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(totalTaxGainLoss)}</span>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowTaxDetails(!showTaxDetails)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition"
                    >
                      {showTaxDetails ? 'Hide Details' : 'Show Details'}
                    </button>
                    <button
                      onClick={handleExport}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold transition"
                    >
                      📥 Download CSV
                    </button>
                  </div>
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
                          <tr key={idx}>
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
                        Showing first 100 of {taxRecords.length} records. Download CSV for complete data.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!profile && !loading && !error && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">Enter a Polymarket username or wallet to analyze</p>
            <p className="text-sm">We'll show your positions, P&L (matching Polymarket), and generate IRS Form 8949 tax records</p>
          </div>
        )}
      </div>
    </div>
  )
}
