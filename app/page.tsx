'use client'

import { useState } from 'react'
import { getUserTrades, calculatePnL, exportToCSV, type PolymarketTrade, type TaxRecord } from '@/lib/polymarket'

export default function Home() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [trades, setTrades] = useState<PolymarketTrade[]>([])
  const [taxRecords, setTaxRecords] = useState<Map<string, TaxRecord[]>>(new Map())
  const [error, setError] = useState('')

  const handleQuery = async () => {
    if (!username) {
      setError('Please enter a Polymarket username or wallet address')
      return
    }

    setLoading(true)
    setError('')
    setTrades([])
    setTaxRecords(new Map())

    try {
      console.log('Querying trades for:', username)
      const fetchedTrades = await getUserTrades(username)
      console.log('Fetched trades:', fetchedTrades.length)
      
      setTrades(fetchedTrades)
      
      if (fetchedTrades.length > 0) {
        const pnl = await calculatePnL(fetchedTrades)
        setTaxRecords(pnl)
      } else {
        setError('No trades found for this username/wallet')
      }
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch trades. Please try again.')
    } finally {
      setLoading(false)
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

  const totalGainLoss = Array.from(taxRecords.values())
    .flat()
    .reduce((sum, record) => sum + record.gainLoss, 0)

  const shortTermGainLoss = Array.from(taxRecords.values())
    .flat()
    .filter(r => r.termType === 'Short-term')
    .reduce((sum, record) => sum + record.gainLoss, 0)

  const longTermGainLoss = Array.from(taxRecords.values())
    .flat()
    .filter(r => r.termType === 'Long-term')
    .reduce((sum, record) => sum + record.gainLoss, 0)

  const totalRecords = Array.from(taxRecords.values()).flat().length

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Polymarket Tax & P/L Engine</h1>
          <p className="text-gray-400 mb-2">
            Enter your Polymarket username or wallet address to calculate realized P&L and export tax-ready data
          </p>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mt-3">
            <p className="text-sm text-blue-400">
              ✨ <strong>Username Support:</strong> Enter your Polymarket username (e.g., "teen11") or wallet address (0x...).
              We'll fetch all your trades from Polymarket's public API and calculate FIFO cost basis for IRS Form 8949.
            </p>
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-slate-800 rounded-lg p-6 mb-8">
          <label className="block text-sm font-medium mb-2">Polymarket Username or Wallet Address</label>
          <div className="flex gap-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
              placeholder="teen11 or 0x..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={handleQuery}
              disabled={loading}
              className="px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 rounded-lg font-semibold transition"
            >
              {loading ? 'Querying...' : 'Query Trades'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-400">{error}</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Examples: "teen11" (username) or "0x7319ce70fb19a3ebc9d16ad7a8e0d54544bd72d5" (wallet)
          </p>
        </div>

        {/* Summary Section */}
        {trades.length > 0 && (
          <>
            <div className="grid grid-cols-5 gap-4 mb-8">
              <div className="bg-slate-800 rounded-lg p-6">
                <div className="text-sm text-gray-400">Total Trades</div>
                <div className="text-3xl font-bold">{trades.length}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-6">
                <div className="text-sm text-gray-400">Tax Records</div>
                <div className="text-3xl font-bold">{totalRecords}</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-6">
                <div className="text-sm text-gray-400">Total P&L</div>
                <div className={`text-3xl font-bold ${totalGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${totalGainLoss.toFixed(2)}
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-6">
                <div className="text-sm text-gray-400">Short-Term</div>
                <div className={`text-2xl font-bold ${shortTermGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${shortTermGainLoss.toFixed(2)}
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-6">
                <div className="text-sm text-gray-400">Long-Term</div>
                <div className={`text-2xl font-bold ${longTermGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${longTermGainLoss.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Export Button */}
            <div className="bg-slate-800 rounded-lg p-6 mb-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Export Tax Report</h2>
                  <p className="text-sm text-gray-400">
                    Download CSV formatted for IRS Form 8949
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition"
                >
                  Download CSV
                </button>
              </div>
            </div>

            {/* Tax Records Table */}
            <div className="bg-slate-800 rounded-lg overflow-hidden mb-8">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Tax Records (Form 8949 Ready)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Date Acquired
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Date Sold
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Proceeds
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Cost Basis
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Gain/Loss
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Term
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {Array.from(taxRecords.values()).flat().map((record, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-4 text-sm">{record.description}</td>
                        <td className="px-6 py-4 text-sm">{record.dateAcquired}</td>
                        <td className="px-6 py-4 text-sm">{record.dateSold}</td>
                        <td className="px-6 py-4 text-sm">${record.proceeds.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm">${record.costBasis.toFixed(2)}</td>
                        <td className={`px-6 py-4 text-sm font-semibold ${record.gainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${record.gainLoss.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 text-xs rounded ${
                            record.termType === 'Short-term' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {record.termType}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Raw Trades Table */}
            <div className="bg-slate-800 rounded-lg overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Trade History</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Market
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Outcome
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Side
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {trades.map((trade, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-4 text-sm max-w-xs truncate">{trade.title}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 text-xs rounded ${
                            trade.outcome.toLowerCase().includes('yes') || trade.outcome.toLowerCase().includes('up') 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {trade.outcome}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">{trade.side}</td>
                        <td className="px-6 py-4 text-sm">{trade.size.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm">${trade.price.toFixed(4)}</td>
                        <td className="px-6 py-4 text-sm">${(trade.size * trade.price).toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm">{new Date(trade.timestamp * 1000).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {trades.length === 0 && !loading && !error && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">Enter a Polymarket username or wallet to get started</p>
            <p className="text-sm">We'll fetch all trades and calculate your tax liability using FIFO cost basis</p>
          </div>
        )}
      </div>
    </div>
  )
}
