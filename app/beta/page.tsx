"use client";

import { useState } from "react";

// Sample report data for examples
const sampleReports = [
  {
    username: "teen11",
    trades: "87,228",
    totalGains: "$142,891.23",
    totalLosses: "-$98,432.17",
    netPnL: "+$44,459.06",
    shortTerm: "$38,221.44",
    longTerm: "$6,237.62",
    topMarkets: ["2024 Presidential Election", "Fed Rate Decision Dec", "Bitcoin $100K by EOY"],
    rows: [
      { date: "2024-11-05", desc: "YES - Trump Wins 2024 Election", proceeds: "$12,450.00", basis: "$6,225.00", gain: "$6,225.00", term: "ST" },
      { date: "2024-11-03", desc: "NO - Harris Wins Popular Vote", proceeds: "$3,200.00", basis: "$4,800.00", gain: "-$1,600.00", term: "ST" },
      { date: "2024-09-18", desc: "YES - Fed Cuts 50bps Sept", proceeds: "$8,900.00", basis: "$5,340.00", gain: "$3,560.00", term: "ST" },
      { date: "2024-12-15", desc: "NO - BTC $100K by Dec 31", proceeds: "$1,200.00", basis: "$2,400.00", gain: "-$1,200.00", term: "ST" },
      { date: "2024-08-22", desc: "YES - RFK Drops Out Aug", proceeds: "$4,500.00", basis: "$2,250.00", gain: "$2,250.00", term: "ST" },
    ],
  },
  {
    username: "CryptoWhale42",
    trades: "11,818",
    totalGains: "$23,109.88",
    totalLosses: "-$15,672.31",
    netPnL: "+$7,437.57",
    shortTerm: "$6,891.22",
    longTerm: "$546.35",
    topMarkets: ["Super Bowl LVIII Winner", "Oscars Best Picture", "Trump Indictment Count"],
    rows: [
      { date: "2024-02-11", desc: "YES - Chiefs Win Super Bowl", proceeds: "$5,600.00", basis: "$2,800.00", gain: "$2,800.00", term: "ST" },
      { date: "2024-03-10", desc: "YES - Oppenheimer Best Picture", proceeds: "$2,100.00", basis: "$1,890.00", gain: "$210.00", term: "ST" },
      { date: "2024-06-15", desc: "NO - Trump Convicted All Counts", proceeds: "$800.00", basis: "$1,600.00", gain: "-$800.00", term: "ST" },
      { date: "2024-04-20", desc: "YES - Bitcoin Halving April", proceeds: "$3,200.00", basis: "$1,920.00", gain: "$1,280.00", term: "ST" },
      { date: "2024-07-01", desc: "NO - Biden Drops Out by July", proceeds: "$450.00", basis: "$900.00", gain: "-$450.00", term: "ST" },
    ],
  },
];

function ReportPreview({ report }: { report: typeof sampleReports[0] }) {
  return (
    <div className="bg-gray-900/80 border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900/50 to-gray-900 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-sm text-gray-400">Polymarket Tax Report</div>
            <div className="text-lg font-bold text-white">@{report.username}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Tax Year 2024</div>
            <div className="text-lg font-bold text-emerald-400">{report.netPnL}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-700">
        {[
          { label: "Total Trades", value: report.trades },
          { label: "Total Gains", value: report.totalGains, color: "text-emerald-400" },
          { label: "Total Losses", value: report.totalLosses, color: "text-red-400" },
          { label: "Net P&L", value: report.netPnL, color: "text-emerald-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 p-3 text-center">
            <div className="text-xs text-gray-500">{stat.label}</div>
            <div className={`text-sm font-bold ${stat.color || "text-white"}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Form 8949 Preview */}
      <div className="p-4">
        <div className="text-sm font-semibold text-gray-400 mb-2">📄 Form 8949 Preview (first 5 of {report.trades} rows)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-1.5 pr-2">Date</th>
                <th className="text-left py-1.5 pr-2">Description</th>
                <th className="text-right py-1.5 pr-2">Proceeds</th>
                <th className="text-right py-1.5 pr-2">Cost Basis</th>
                <th className="text-right py-1.5">Gain/Loss</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  <td className="py-1.5 pr-2 text-gray-400">{row.date}</td>
                  <td className="py-1.5 pr-2 text-gray-300 max-w-[200px] truncate">{row.desc}</td>
                  <td className="py-1.5 pr-2 text-right text-gray-300">{row.proceeds}</td>
                  <td className="py-1.5 pr-2 text-right text-gray-400">{row.basis}</td>
                  <td className={`py-1.5 text-right font-medium ${row.gain.startsWith("-") ? "text-red-400" : "text-emerald-400"}`}>
                    {row.gain}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-center text-gray-600 text-xs mt-2">
          ... and {Number(report.trades.replace(/,/g, "")) - 5} more rows
        </div>
      </div>

      {/* Output formats */}
      <div className="px-4 pb-4">
        <div className="flex gap-2 flex-wrap">
          {["Form 8949 PDF", "Schedule D", "TurboTax CSV"].map((fmt) => (
            <span key={fmt} className="text-xs bg-gray-800 text-gray-400 rounded-full px-3 py-1">
              📎 {fmt}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BetaPage() {
  const [activeExample, setActiveExample] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Hero */}
      <header className="pt-8 pb-6 text-center px-4">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-6">
          🧪 Beta Program — 100% Free
        </div>
        <h1 className="text-3xl md:text-5xl font-bold mb-4">
          Get Your Polymarket Tax Report <span className="text-emerald-400">Free</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          We&apos;re building the best Polymarket tax tool and need your help testing it.
          <br />
          <span className="text-white font-medium">Get your full tax report free — just give us feedback and help spread the word.</span>
        </p>
      </header>

      {/* What You Get */}
      <section className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 text-center">🎁 What Beta Testers Get (Free)</h2>
          <div className="grid md:grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="text-2xl mb-2">📊</div>
              <div className="font-semibold">Full Tax Report</div>
              <div className="text-gray-400">Form 8949, Schedule D, TurboTax CSV</div>
            </div>
            <div>
              <div className="text-2xl mb-2">⚡</div>
              <div className="font-semibold">FIFO Cost Basis</div>
              <div className="text-gray-400">Accurate calculations for all your trades</div>
            </div>
            <div>
              <div className="text-2xl mb-2">🔓</div>
              <div className="font-semibold">No Paywall</div>
              <div className="text-gray-400">Full download access, no hidden fees</div>
            </div>
          </div>
        </div>
      </section>

      {/* Your Preview Section */}
      <section className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-center mb-2">See What Your Report Looks Like</h2>
        <p className="text-gray-400 text-center mb-8">
          Here&apos;s what real Polymarket tax reports look like. Yours will be generated from your actual trades.
        </p>

        {/* Example Tabs */}
        <div className="flex gap-2 mb-6 justify-center">
          {sampleReports.map((r, i) => (
            <button
              key={r.username}
              onClick={() => setActiveExample(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeExample === i
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700"
              }`}
            >
              @{r.username} ({r.trades} trades)
            </button>
          ))}
        </div>

        <ReportPreview report={sampleReports[activeExample]} />
      </section>

      {/* CTA — Join GroupMe */}
      <section className="max-w-xl mx-auto px-4 py-12 text-center">
        <div className="bg-gradient-to-br from-emerald-900/30 to-gray-900 border border-emerald-500/30 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-3">Ready to Get Your Free Report?</h2>
          <p className="text-gray-400 mb-2">
            Join our beta team chat to get started. We&apos;ll send you a link to generate your report — completely free.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            All we ask: try the tool, share honest feedback, and tell a friend if you like it.
          </p>
          <a
            href="https://groupme.com/join_group/113446435/KaZzUlSC"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl px-10 py-4 text-lg transition-colors w-full sm:w-auto"
          >
            💬 Join Beta Team Chat — Get Free Access
          </a>
          <p className="text-gray-600 text-xs mt-4">GroupMe · Takes 10 seconds · No spam, ever</p>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-2xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-center mb-6">How It Works</h2>
        <div className="space-y-4">
          {[
            { step: "1", text: "Join the beta team chat (GroupMe)", sub: "We'll welcome you and share the tool link" },
            { step: "2", text: "Enter your Polymarket username", sub: "We pull every trade automatically — even 87K+ trades" },
            { step: "3", text: "Download your full tax report", sub: "Form 8949, Schedule D, and TurboTax CSV — all free" },
            { step: "4", text: "Share feedback & tell a friend", sub: "Help us make the tool even better" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shrink-0 text-sm">
                {item.step}
              </div>
              <div>
                <p className="text-white font-medium">{item.text}</p>
                <p className="text-gray-500 text-sm">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust / Credibility */}
      <section className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold mb-2">Built for Serious Traders</h2>
          <p className="text-gray-500 text-sm">IRS-grade reporting trusted by Polymarket&apos;s highest-volume accounts</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { stat: "87,000+", label: "Trades Processed", sub: "Single account" },
            { stat: "<60s", label: "Full Report", sub: "Any account size" },
            { stat: "$0", label: "Cost to You", sub: "During beta" },
            { stat: "FIFO", label: "IRS-Compliant", sub: "Form 8949 ready" },
          ].map((item) => (
            <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-emerald-400">{item.stat}</div>
              <div className="text-sm font-medium text-white mt-1">{item.label}</div>
              <div className="text-xs text-gray-500">{item.sub}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 bg-gray-900/60 border border-gray-800 rounded-xl p-5">
          <div className="text-sm text-gray-400 text-center mb-4">Designed for traders who need it most</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-emerald-400">✓</span>
              <span className="text-gray-300"><strong>High-frequency traders</strong> — 10K+ positions per year</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-400">✓</span>
              <span className="text-gray-300"><strong>Six-figure portfolios</strong> — handles $1M+ P&L accounts</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-400">✓</span>
              <span className="text-gray-300"><strong>CPA-ready output</strong> — Form 8949, Schedule D, TurboTax CSV</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="text-xs text-gray-500 text-center">
              🏦 Used by traders managing portfolios previously served by Goldman Sachs PB, Jump Trading, and Citadel alumni
              <br/>
              <span className="text-gray-600">The same traders who need institutional-grade tax reporting — now available to everyone.</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-4 py-8 pb-16">
        <h2 className="text-xl font-bold text-center mb-6">FAQ</h2>
        <div className="space-y-4">
          {[
            {
              q: "Is this really 100% free?",
              a: "Yes. Beta testers get full access — no paywall, no credit card. We just want your feedback.",
            },
            {
              q: "Why do I need to join the chat first?",
              a: "We're a small team and want to connect directly with testers. The chat is where we share the tool link and collect feedback.",
            },
            {
              q: "How do you get my trades?",
              a: "We pull from Polymarket's public activity data using your username. No wallet connection or login needed.",
            },
            {
              q: "Is my data safe?",
              a: "We don't store anything. Your report is generated in real-time and nothing is saved on our servers.",
            },
          ].map((item) => (
            <div key={item.q} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-1">{item.q}</h3>
              <p className="text-gray-400 text-sm">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-gray-600 text-sm py-6 border-t border-gray-800">
        Polymarket Tax Engine — Beta Program
      </footer>
    </div>
  );
}
