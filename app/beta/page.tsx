"use client";

export default function BetaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Header */}
      <header className="pt-8 pb-4 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-6">
          🧪 Beta Program — Free Access
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Polymarket Tax Engine
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mx-auto px-4">
          Automatically generate IRS-ready tax forms from your Polymarket trades. 
          No manual work. No spreadsheets.
        </p>
      </header>

      {/* What You Get */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center mb-8">What You Get</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: "📊",
              title: "Full Trade History",
              desc: "Enter your username — we pull every trade automatically. Tested with 87K+ trades.",
            },
            {
              icon: "📄",
              title: "IRS Tax Forms",
              desc: "Form 8949, Schedule D, and TurboTax-compatible CSV. Ready to file.",
            },
            {
              icon: "⚡",
              title: "FIFO Cost Basis",
              desc: "Accurate cost basis calculation using FIFO method across all your positions.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white/5 border border-white/10 rounded-xl p-6 text-center"
            >
              <div className="text-3xl mb-3">{item.icon}</div>
              <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-2xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
        <div className="space-y-6">
          {[
            { step: "1", text: "Enter your Polymarket username" },
            { step: "2", text: "We fetch and analyze all your trades" },
            { step: "3", text: "Download your Form 8949, Schedule D, or TurboTax CSV" },
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                {item.step}
              </div>
              <p className="text-gray-300">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold mb-4">Try It Now — Free for Beta Testers</h2>
        <p className="text-gray-400 mb-8">
          As a beta tester, you get full access to all features. We just ask for your honest feedback.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://polymarket-tax-engine.vercel.app"
            className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl px-8 py-4 text-lg transition-colors"
          >
            🚀 Generate My Tax Report
          </a>
          <a
            href="https://groupme.com/join_group/113446435/KaZzUlSC"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl px-8 py-4 text-lg transition-colors"
          >
            💬 Join the Beta Team Chat
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center mb-8">FAQ</h2>
        <div className="space-y-6">
          {[
            {
              q: "Is this really free?",
              a: "Yes — beta testers get full access. We're collecting feedback before our official launch.",
            },
            {
              q: "How do you get my trades?",
              a: "We pull directly from Polymarket's public activity data using your username. No wallet connection needed.",
            },
            {
              q: "Is my data safe?",
              a: "We don't store your data. Everything is processed in your browser session and discarded after.",
            },
            {
              q: "What tax years are supported?",
              a: "2024 and 2025. You can filter by tax year or view all trades.",
            },
          ].map((item) => (
            <div key={item.q} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="font-semibold mb-2">{item.q}</h3>
              <p className="text-gray-400 text-sm">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-gray-600 text-sm py-8">
        Polymarket Tax Engine — Beta Program
      </footer>
    </div>
  );
}
