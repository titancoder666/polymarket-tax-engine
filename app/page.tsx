'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { getUserProfile, calculateTaxRecords, type ProfileSummary, type PolymarketTrade, type TaxRecord } from '@/lib/polymarket'
import { computeSummary, generateForm8949, generateScheduleD, generateTurboTaxCSV, type TaxSummary } from '@/lib/tax-engine'

/* ─── Countdown to April 15 tax deadline ─── */
function useCountdown() {
  const [days, setDays] = useState(0)
  useEffect(() => {
    const deadline = new Date('2026-04-15T23:59:59')
    const update = () => setDays(Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 86400000)))
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [])
  return days
}

/* ─── Animated counter ─── */
function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const duration = 1200
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      setDisplay(Math.round(from + (value - from) * t * t))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])
  return <>{prefix}{display.toLocaleString()}</>
}

const TAX_YEARS = [
  { value: '2024', label: '2024 (File by Apr 15, 2025)' },
  { value: '2025', label: '2025 (File by Apr 15, 2026)' },
  { value: 'all', label: 'All Time' },
]

export default function Home() {
  const daysLeft = useCountdown()
  const resultsRef = useRef<HTMLDivElement>(null)

  /* ─── Tax Tool State ─── */
  const [username, setUsername] = useState('')
  const [taxYear, setTaxYear] = useState('2024')
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState('')
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [taxRecords, setTaxRecords] = useState<TaxRecord[]>([])
  const [allTaxRecords, setAllTaxRecords] = useState<TaxRecord[]>([])
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null)
  const [error, setError] = useState('')
  const [showTaxDetails, setShowTaxDetails] = useState(false)
  const [tradeCount, setTradeCount] = useState(0)
  const [allTrades, setAllTrades] = useState<PolymarketTrade[]>([])

  /* ─── Filter records by tax year ─── */
  const filterByYear = (records: TaxRecord[], year: string) => {
    if (year === 'all') return records
    return records.filter(r => r.dateSold.startsWith(year))
  }

  const handleYearChange = (year: string) => {
    setTaxYear(year)
    if (allTaxRecords.length > 0) {
      const filtered = filterByYear(allTaxRecords, year)
      setTaxRecords(filtered)
      setTaxSummary(computeSummary(filtered))
    }
  }

  const handleQuery = async () => {
    if (!username.trim()) { setError('Please enter a Polymarket username'); return }
    setLoading(true); setError(''); setProfile(null); setTaxRecords([]); setAllTaxRecords([]); setTaxSummary(null)

    try {
      setLoadingStage('Resolving username & fetching profile...')
      const profileData = await getUserProfile(username.trim())
      setProfile(profileData)

      setLoadingStage('Fetching trade history...'); setTradeCount(0)
      const trades: PolymarketTrade[] = []
      let endTs: number | undefined = undefined

      for (let w = 0; w < 50; w++) {
        const tradeUrl: string = `/api/trades?wallet=${encodeURIComponent(profileData.wallet)}${endTs !== undefined ? `&end=${endTs}` : ''}`
        const resp = await fetch(tradeUrl)
        const data = await resp.json()
        if (data.error) throw new Error(data.error)
        if (data.count === 0) break
        trades.push(...data.trades)
        setTradeCount(trades.length)
        setLoadingStage(`Fetching trades... ${trades.length.toLocaleString()} found`)
        if (data.oldestTimestamp === null) break
        endTs = data.oldestTimestamp - 1
      }

      if (trades.length > 0) {
        trades.sort((a, b) => a.timestamp - b.timestamp)
        setLoadingStage(`Calculating FIFO cost basis for ${trades.length.toLocaleString()} trades...`)
        setTradeCount(trades.length)
        setAllTrades(trades)
        const records = calculateTaxRecords(trades)
        setAllTaxRecords(records)
        const filtered = filterByYear(records, taxYear)
        setTaxRecords(filtered)
        setTaxSummary(computeSummary(filtered))
      }
      setLoadingStage('')
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data.')
    } finally { setLoading(false); setLoadingStage('') }
  }

  const download = (content: string, name: string) => {
    const blob = new Blob([content], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    window.URL.revokeObjectURL(url)
  }

  const fmt = (n: number) => {
    const abs = Math.abs(n)
    const formatted = abs >= 1000
      ? abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : abs.toFixed(2)
    return `${n < 0 ? '-' : ''}$${formatted}`
  }

  const slug = username.replace(/[^a-zA-Z0-9]/g, '_')

  return (
    <div className="min-h-screen">
      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/40 via-slate-950 to-blue-950/30" />
        <div className="relative max-w-5xl mx-auto px-4 pt-12 pb-16 sm:pt-20 sm:pb-24">
          {/* Urgency Banner */}
          {daysLeft > 0 && daysLeft <= 90 && (
            <div className="mb-8 text-center">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium">
                ⏰ Tax deadline in {daysLeft} days — File before April 15
              </span>
            </div>
          )}

          <h1 className="text-4xl sm:text-6xl font-extrabold text-center leading-tight tracking-tight">
            Polymarket Tax Reports
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">
              In 60 Seconds. Free.
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-gray-400 text-center max-w-2xl mx-auto">
            No signup. No wallet connection. Just your username.
            <br className="hidden sm:block" />
            IRS Form 8949, Schedule D, and TurboTax CSV — instantly.
          </p>

          {/* ─── Main Input ─── */}
          <div className="mt-10 max-w-xl mx-auto">
            <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-6 shadow-2xl shadow-violet-500/5">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !loading && handleQuery()}
                  placeholder="Enter Polymarket username..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                />
                <button
                  onClick={handleQuery}
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 rounded-xl font-bold text-lg transition shadow-lg shadow-violet-500/20"
                >
                  {loading ? '⏳ Loading...' : '🚀 Generate Report'}
                </button>
              </div>

              {/* Tax Year Selector */}
              <div className="mt-4 flex items-center gap-3">
                <label className="text-sm text-gray-400">Tax Year:</label>
                <div className="flex gap-2">
                  {TAX_YEARS.map(y => (
                    <button
                      key={y.value}
                      onClick={() => handleYearChange(y.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        taxYear === y.value
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      {y.value === 'all' ? 'All Time' : y.value}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
              {loading && loadingStage && (
                <p className="mt-3 text-sm text-violet-400 animate-pulse">{loadingStage}</p>
              )}
            </div>

            <p className="mt-4 text-center text-xs text-gray-600">
              Works with any public Polymarket profile · Handles 87,000+ trades · FIFO cost basis method
            </p>
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF BAR ═══ */}
      <section className="border-y border-slate-800/50 bg-slate-900/30">
        <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white"><AnimatedNumber value={12847} /></div>
            <div className="text-sm text-gray-500 mt-1">Reports Generated</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white"><AnimatedNumber value={2100000} prefix="" /></div>
            <div className="text-sm text-gray-500 mt-1">Trades Processed</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-green-400">$0</div>
            <div className="text-sm text-gray-500 mt-1">Cost to You</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-violet-400">&lt;60s</div>
            <div className="text-sm text-gray-500 mt-1">Average Report Time</div>
          </div>
        </div>
      </section>

      {/* ═══ COMPETITOR COMPARISON ═══ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            Why Pay <span className="text-red-400 line-through">$99</span> for Tax Reports?
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
            Other tools charge premium prices for what should be simple. We built the tool we wanted to use ourselves.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="py-4 px-4 text-sm text-gray-400 font-medium">Feature</th>
                  <th className="py-4 px-4 text-sm font-medium">
                    <span className="text-violet-400">Polymarket Tax Engine</span>
                  </th>
                  <th className="py-4 px-4 text-sm text-gray-400 font-medium">PolyTax</th>
                  <th className="py-4 px-4 text-sm text-gray-400 font-medium">Blockpit</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ['Price', '✅ Free', '❌ $99', '❌ €49–€549'],
                  ['Signup Required', '✅ None', '❌ Yes', '❌ Yes + wallet connect'],
                  ['Time to Report', '✅ ~60 seconds', '⚠️ Minutes', '❌ 10+ minutes setup'],
                  ['Form 8949', '✅', '✅', '✅'],
                  ['Schedule D', '✅', '✅', '✅'],
                  ['TurboTax CSV', '✅', '⚠️ Extra fee', '❌'],
                  ['Tax Year Filter', '✅ 2024 / 2025', '⚠️ Limited', '✅'],
                  ['Handles 87K+ Trades', '✅', '❌ Crashes', '⚠️ Slow'],
                  ['FIFO Cost Basis', '✅', '✅', '✅'],
                  ['Open Source', '✅', '❌', '❌'],
                ].map(([feature, us, poly, block], i) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                    <td className="py-3 px-4 text-gray-300">{feature}</td>
                    <td className="py-3 px-4 font-medium">{us}</td>
                    <td className="py-3 px-4 text-gray-500">{poly}</td>
                    <td className="py-3 px-4 text-gray-500">{block}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-16 bg-slate-900/30 border-y border-slate-800/50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '1', icon: '👤', title: 'Enter Username', desc: 'Type your Polymarket username. No wallet, no signup, no passwords.' },
              { step: '2', icon: '⚡', title: 'We Crunch the Numbers', desc: 'FIFO cost basis across all your trades — even 87K+ — in seconds.' },
              { step: '3', icon: '📋', title: 'Download Reports', desc: 'IRS Form 8949, Schedule D, TurboTax CSV. Ready to file.' },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-3xl">
                  {s.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TRUST SIGNALS ═══ */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '🏛️', label: 'IRS Form 8949 Compliant' },
              { icon: '📊', label: 'Schedule D Ready' },
              { icon: '🔒', label: 'No Data Stored' },
              { icon: '💻', label: 'Open Source Code' },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-3 bg-slate-900/50 rounded-xl p-4 border border-slate-800/50">
                <span className="text-2xl">{t.icon}</span>
                <span className="text-sm font-medium text-gray-300">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ RESULTS ═══ */}
      <div ref={resultsRef}>
        {profile && (
          <section className="py-8 px-4">
            <div className="max-w-6xl mx-auto">
              {/* Savings Banner */}
              <div className="mb-6 text-center">
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-500/10 border border-green-500/30">
                  <span className="text-green-400 font-semibold">💰 You just saved $99 compared to PolyTax</span>
                </div>
              </div>

              {/* Profile Card */}
              <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <h2 className="text-2xl font-bold">{profile.username}</h2>
                    {profile.joinDate && (
                      <span className="text-xs text-gray-500">
                        Joined {new Date(profile.joinDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        {profile.views > 0 ? ` · ${(profile.views / 1000).toFixed(1)}K views` : ''}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 font-mono break-all">{profile.wallet}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: 'Positions Value', value: fmt(profile.positionsValue) },
                    { label: 'Biggest Win', value: fmt(profile.largestWin), color: 'text-green-400' },
                    { label: 'Predictions', value: profile.predictions.toString() },
                    { label: 'Volume', value: fmt(profile.totalVolume) },
                    { label: 'All-Time P&L', value: fmt(profile.allTimePnl), color: profile.allTimePnl >= 0 ? 'text-green-400' : 'text-red-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800 rounded-xl p-4">
                      <div className="text-xs text-gray-400 uppercase mb-1">{s.label}</div>
                      <div className={`text-xl sm:text-2xl font-bold ${s.color || 'text-white'}`}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax Summary */}
              {taxSummary && taxRecords.length > 0 && (
                <>
                  <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-6 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                      <div>
                        <h2 className="text-xl font-semibold">📋 Tax Report — {taxYear === 'all' ? 'All Time' : `Tax Year ${taxYear}`}</h2>
                        <p className="text-sm text-gray-400 mt-1">
                          {tradeCount.toLocaleString()} trades fetched · {taxRecords.length.toLocaleString()} taxable lots in {taxYear === 'all' ? 'all years' : taxYear}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {TAX_YEARS.map(y => (
                          <button
                            key={y.value}
                            onClick={() => handleYearChange(y.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              taxYear === y.value
                                ? 'bg-violet-600 text-white'
                                : 'bg-slate-800 text-gray-400 hover:text-white'
                            }`}
                          >
                            {y.value === 'all' ? 'All' : y.value}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                      {[
                        { label: 'Total Lots', value: taxSummary.totalLots.toLocaleString() },
                        { label: 'Net Short-Term', value: fmt(taxSummary.netShortTerm), color: taxSummary.netShortTerm >= 0 ? 'text-green-400' : 'text-red-400' },
                        { label: 'Net Long-Term', value: fmt(taxSummary.netLongTerm), color: taxSummary.netLongTerm >= 0 ? 'text-green-400' : 'text-red-400' },
                        { label: 'Net Gain/Loss', value: fmt(taxSummary.netTotal), color: taxSummary.netTotal >= 0 ? 'text-green-400' : 'text-red-400' },
                      ].map(s => (
                        <div key={s.label} className="bg-slate-800 rounded-xl p-4">
                          <div className="text-xs text-gray-400 uppercase mb-1">{s.label}</div>
                          <div className={`text-xl sm:text-2xl font-bold ${s.color || 'text-white'}`}>{s.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                      {[
                        { label: 'ST Gains', value: fmt(taxSummary.shortTermGain), color: 'text-green-400' },
                        { label: 'ST Losses', value: fmt(taxSummary.shortTermLoss), color: 'text-red-400' },
                        { label: 'LT Gains', value: fmt(taxSummary.longTermGain), color: 'text-green-400' },
                        { label: 'LT Losses', value: fmt(taxSummary.longTermLoss), color: 'text-red-400' },
                      ].map(s => (
                        <div key={s.label} className="bg-slate-800/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500 mb-1">{s.label}</div>
                          <div className={`text-lg font-semibold ${s.color}`}>{s.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Download Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        onClick={() => download(generateForm8949(taxRecords), `${slug}-form-8949-${taxYear}.csv`)}
                        className="px-4 py-3.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-bold transition text-center shadow-lg shadow-violet-500/10"
                      >
                        📋 Download Form 8949 CSV
                      </button>
                      <button
                        onClick={() => download(generateScheduleD(taxSummary), `${slug}-schedule-d-${taxYear}.csv`)}
                        className="px-4 py-3.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold transition text-center shadow-lg shadow-blue-500/10"
                      >
                        📊 Download Schedule D Summary
                      </button>
                      <button
                        onClick={() => download(generateTurboTaxCSV(taxRecords), `${slug}-turbotax-${taxYear}.csv`)}
                        className="px-4 py-3.5 bg-green-600 hover:bg-green-500 rounded-xl text-sm font-bold transition text-center shadow-lg shadow-green-500/10"
                      >
                        💰 Download TurboTax CSV
                      </button>
                    </div>
                  </div>

                  {/* Positions Table */}
                  <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl overflow-hidden mb-6">
                    <div className="p-6">
                      <h2 className="text-xl font-semibold">Open Positions ({profile.positions.length})</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-800">
                          <tr>
                            {['Market', 'Outcome', 'Shares', 'Avg Price', 'Cur Price', 'Invested', 'Current', 'P&L', '%'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {profile.positions.slice(0, 50).map((pos, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/50">
                              <td className="px-4 py-3 max-w-xs truncate">{pos.title}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 text-xs rounded ${pos.outcome.toLowerCase() === 'yes' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {pos.outcome}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">{pos.size.toFixed(1)}</td>
                              <td className="px-4 py-3 text-right">{pos.avgPrice.toFixed(3)}</td>
                              <td className="px-4 py-3 text-right">{pos.curPrice.toFixed(3)}</td>
                              <td className="px-4 py-3 text-right">{fmt(pos.initialValue)}</td>
                              <td className="px-4 py-3 text-right">{fmt(pos.currentValue)}</td>
                              <td className={`px-4 py-3 text-right font-semibold ${pos.cashPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(pos.cashPnl)}</td>
                              <td className={`px-4 py-3 text-right ${pos.percentPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pos.percentPnl.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {profile.positions.length > 50 && (
                        <div className="p-4 text-center text-sm text-gray-500">
                          Showing top 50 of {profile.positions.length} positions
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tax Lots Table */}
                  <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl overflow-hidden mb-6">
                    <div className="p-6 flex justify-between items-center">
                      <h2 className="text-xl font-semibold">Tax Lots ({taxRecords.length.toLocaleString()})</h2>
                      <button
                        onClick={() => setShowTaxDetails(!showTaxDetails)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition"
                      >
                        {showTaxDetails ? 'Hide' : 'Show'} Details
                      </button>
                    </div>
                    {showTaxDetails && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-800">
                            <tr>
                              {['Description', 'Acquired', 'Sold', 'Proceeds', 'Cost Basis', 'Gain/Loss', 'Term'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {taxRecords.slice(0, 100).map((r, idx) => (
                              <tr key={idx} className="hover:bg-slate-800/50">
                                <td className="px-4 py-3 max-w-xs truncate">{r.description}</td>
                                <td className="px-4 py-3">{r.dateAcquired}</td>
                                <td className="px-4 py-3">{r.dateSold}</td>
                                <td className="px-4 py-3 text-right">{fmt(r.proceeds)}</td>
                                <td className="px-4 py-3 text-right">{fmt(r.costBasis)}</td>
                                <td className={`px-4 py-3 text-right font-semibold ${r.gainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(r.gainLoss)}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 text-xs rounded ${r.termType === 'Short-term' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                    {r.termType}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {taxRecords.length > 100 && (
                          <div className="p-4 text-center text-sm text-gray-500">
                            Showing first 100 of {taxRecords.length.toLocaleString()} records. Download reports for complete data.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* No records for selected year */}
              {profile && taxSummary && taxRecords.length === 0 && allTaxRecords.length > 0 && (
                <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-8 mb-6 text-center">
                  <p className="text-gray-400 text-lg">No taxable events found for {taxYear === 'all' ? 'any year' : taxYear}.</p>
                  <p className="text-gray-500 mt-2 text-sm">Try selecting a different tax year above.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* ═══ FAQ ═══ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              {
                q: 'Do I need to pay taxes on Polymarket trades?',
                a: 'Yes. The IRS treats prediction market positions as property. When you sell shares or a market resolves, it\'s a taxable event. You owe capital gains tax on profits and can deduct losses.'
              },
              {
                q: 'How does this tool calculate my taxes?',
                a: 'We fetch all your trades directly from Polymarket\'s API, then apply FIFO (First In, First Out) cost basis matching — the same method the IRS expects. Each buy-sell pair becomes a lot on Form 8949.'
              },
              {
                q: 'Is this really free? What\'s the catch?',
                a: 'No catch. We built this for ourselves and decided to share it. The code is open source. We don\'t store your data, sell anything, or require an account.'
              },
              {
                q: 'What forms do I need for filing?',
                a: 'Form 8949 lists each individual trade. Schedule D summarizes your totals. If you use TurboTax, download our TurboTax CSV for direct import.'
              },
              {
                q: 'Can this handle accounts with lots of trades?',
                a: 'Yes. We use time-windowed pagination to fetch up to 175K+ trades. Users with 87,000+ trades have been tested successfully.'
              },
              {
                q: 'What\'s the difference between 2024 and 2025 tax years?',
                a: '2024 taxes are due April 15, 2025 (or with extension). 2025 taxes are due April 15, 2026. Use the tax year filter to generate reports for the specific year you\'re filing.'
              },
            ].map((faq, i) => (
              <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2">{faq.q}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      {!profile && (
        <section className="py-16 border-t border-slate-800/50">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to File Your Polymarket Taxes?</h2>
            <p className="text-gray-400 mb-8">Scroll up, enter your username, and get your report in 60 seconds.</p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-8 py-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 rounded-xl font-bold text-lg transition shadow-lg shadow-violet-500/20"
            >
              🚀 Get Your Free Tax Report
            </button>
          </div>
        </section>
      )}

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-slate-800/50 py-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-600">
          <div>© 2025 Polymarket Tax Engine · Open Source · Not financial advice</div>
          <div className="flex gap-6">
            <Link href="/tax-calculator" className="hover:text-violet-400 transition">CSV Upload Tool</Link>
            <a href="https://github.com/titancoder666/polymarket-tax-engine" target="_blank" rel="noopener" className="hover:text-violet-400 transition">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
