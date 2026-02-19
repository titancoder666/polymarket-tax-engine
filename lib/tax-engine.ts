// Polymarket CSV Tax Calculation Engine — Client-side FIFO cost basis

export interface RawTransaction {
  timestamp: Date
  market: string
  outcome: string
  type: 'Buy' | 'Sell' | 'Settle'
  price: number
  quantity: number
  total: number
  fees: number
}

export interface TaxLot {
  description: string
  dateAcquired: string
  dateSold: string
  proceeds: number
  costBasis: number
  gainLoss: number
  term: 'Short-term' | 'Long-term'
  quantity: number
  market: string
}

export interface TaxSummary {
  totalTrades: number
  totalLots: number
  shortTermGain: number
  shortTermLoss: number
  longTermGain: number
  longTermLoss: number
  netShortTerm: number
  netLongTerm: number
  netTotal: number
}

// ---------- Column name normalization ----------

const COL_MAP: Record<string, string> = {
  timestamp: 'timestamp', time: 'timestamp', date: 'timestamp', datetime: 'timestamp', date_time: 'timestamp', created: 'timestamp', created_at: 'timestamp',
  market: 'market', market_id: 'market', marketid: 'market', 'market id': 'market', question: 'market', event: 'market', title: 'market', description: 'market',
  outcome: 'outcome', side: 'outcome', position: 'outcome',
  type: 'type', order_type: 'type', ordertype: 'type', 'order type': 'type', action: 'type', trade_type: 'type',
  price: 'price', unit_price: 'price', unitprice: 'price', 'unit price': 'price', avg_price: 'price',
  quantity: 'quantity', qty: 'quantity', amount: 'quantity', size: 'quantity', shares: 'quantity',
  total: 'total', total_amount: 'total', totalamount: 'total', 'total amount': 'total', value: 'total', cost: 'total',
  fees: 'fees', fee: 'fees', commission: 'fees', trading_fee: 'fees',
}

function normalizeCol(name: string): string {
  const key = name.trim().toLowerCase().replace(/[^a-z0-9_ ]/g, '')
  return COL_MAP[key] || key
}

// ---------- CSV Parsing ----------

export function parseCSV(text: string): RawTransaction[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row')

  // Detect delimiter
  const delim = lines[0].includes('\t') ? '\t' : ','

  const rawHeaders = splitCSVLine(lines[0], delim)
  const headers = rawHeaders.map(normalizeCol)

  const idx = (name: string) => headers.indexOf(name)
  const ti = idx('timestamp'), mi = idx('market'), oi = idx('outcome'), tyi = idx('type'),
        pi = idx('price'), qi = idx('quantity'), toi = idx('total'), fi = idx('fees')

  if (mi === -1) throw new Error('Could not find a "Market" column in the CSV')
  if (tyi === -1) throw new Error('Could not find a "Type" (Buy/Sell/Settle) column')

  const txns: RawTransaction[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], delim)
    if (cols.length < 3) continue

    const typeRaw = (cols[tyi] || '').trim()
    const typeParsed = parseType(typeRaw)
    if (!typeParsed) continue

    const price = num(cols[pi])
    const quantity = num(cols[qi])
    const total = toi !== -1 ? num(cols[toi]) : price * quantity
    const fees = fi !== -1 ? num(cols[fi]) : 0

    txns.push({
      timestamp: ti !== -1 ? parseDate(cols[ti]) : new Date(0),
      market: (cols[mi] || 'Unknown').trim(),
      outcome: oi !== -1 ? (cols[oi] || 'Yes').trim() : 'Yes',
      type: typeParsed,
      price, quantity, total, fees,
    })
  }

  txns.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  return txns
}

function splitCSVLine(line: string, delim: string): string[] {
  const result: string[] = []
  let cur = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === delim && !inQuotes) { result.push(cur); cur = ''; continue }
    cur += ch
  }
  result.push(cur)
  return result
}

function parseType(s: string): 'Buy' | 'Sell' | 'Settle' | null {
  const l = s.toLowerCase()
  if (l === 'buy' || l === 'purchase' || l === 'open') return 'Buy'
  if (l === 'sell' || l === 'close') return 'Sell'
  if (l === 'settle' || l === 'settlement' || l === 'redeem' || l === 'claim') return 'Settle'
  return null
}

function parseDate(s: string): Date {
  if (!s) return new Date(0)
  const d = new Date(s.trim())
  return isNaN(d.getTime()) ? new Date(0) : d
}

function num(s: string | undefined): number {
  if (!s) return 0
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? 0 : n
}

// ---------- FIFO Engine ----------

interface BuyLot {
  timestamp: Date
  price: number
  feePerUnit: number
  remaining: number
}

export function calculateFIFO(transactions: RawTransaction[]): TaxLot[] {
  // Group by market + outcome
  const groups = new Map<string, RawTransaction[]>()
  for (const tx of transactions) {
    const key = `${tx.market}|||${tx.outcome}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(tx)
  }

  const lots: TaxLot[] = []

  for (const [, txns] of groups) {
    const buyQueue: BuyLot[] = []

    for (const tx of txns) {
      if (tx.type === 'Buy') {
        buyQueue.push({
          timestamp: tx.timestamp,
          price: tx.price,
          feePerUnit: tx.quantity > 0 ? tx.fees / tx.quantity : 0,
          remaining: tx.quantity,
        })
      } else {
        // Sell or Settle
        let qtyToMatch = tx.quantity
        const sellFeePerUnit = tx.quantity > 0 ? tx.fees / tx.quantity : 0

        while (qtyToMatch > 0 && buyQueue.length > 0) {
          const buy = buyQueue[0]
          const matched = Math.min(qtyToMatch, buy.remaining)

          const costBasis = matched * buy.price + matched * buy.feePerUnit
          const proceeds = matched * tx.price - matched * sellFeePerUnit
          const gainLoss = proceeds - costBasis

          const daysHeld = (tx.timestamp.getTime() - buy.timestamp.getTime()) / (1000 * 60 * 60 * 24)
          const term: 'Short-term' | 'Long-term' = daysHeld >= 365 ? 'Long-term' : 'Short-term'

          lots.push({
            description: `${matched} ${tx.outcome} shares — ${tx.market}`,
            dateAcquired: fmtDate(buy.timestamp),
            dateSold: fmtDate(tx.timestamp),
            proceeds: round2(proceeds),
            costBasis: round2(costBasis),
            gainLoss: round2(gainLoss),
            term,
            quantity: matched,
            market: tx.market,
          })

          buy.remaining -= matched
          qtyToMatch -= matched
          if (buy.remaining <= 0.0001) buyQueue.shift()
        }

        // Unmatched sells (no corresponding buy) — treat cost basis as 0
        if (qtyToMatch > 0.0001) {
          const proceeds = round2(qtyToMatch * tx.price - qtyToMatch * sellFeePerUnit)
          lots.push({
            description: `${qtyToMatch} ${tx.outcome} shares — ${tx.market}`,
            dateAcquired: 'Unknown',
            dateSold: fmtDate(tx.timestamp),
            proceeds,
            costBasis: 0,
            gainLoss: proceeds,
            term: 'Short-term',
            quantity: qtyToMatch,
            market: tx.market,
          })
        }
      }
    }
  }

  lots.sort((a, b) => {
    const da = new Date(a.dateSold).getTime() || 0
    const db = new Date(b.dateSold).getTime() || 0
    return da - db
  })

  return lots
}

export function computeSummary(lots: TaxLot[]): TaxSummary {
  let stGain = 0, stLoss = 0, ltGain = 0, ltLoss = 0
  for (const l of lots) {
    if (l.term === 'Short-term') {
      if (l.gainLoss >= 0) stGain += l.gainLoss; else stLoss += l.gainLoss
    } else {
      if (l.gainLoss >= 0) ltGain += l.gainLoss; else ltLoss += l.gainLoss
    }
  }
  return {
    totalTrades: lots.length,
    totalLots: lots.length,
    shortTermGain: round2(stGain),
    shortTermLoss: round2(stLoss),
    longTermGain: round2(ltGain),
    longTermLoss: round2(ltLoss),
    netShortTerm: round2(stGain + stLoss),
    netLongTerm: round2(ltGain + ltLoss),
    netTotal: round2(stGain + stLoss + ltGain + ltLoss),
  }
}

// ---------- Report Generation ----------

export function generateForm8949(lots: TaxLot[]): string {
  const header = 'Description of Property,Date Acquired,Date Sold or Disposed,Proceeds,Cost or Other Basis,Gain or (Loss),Short-term or Long-term'
  const rows = lots.map(l =>
    `"${l.description}",${l.dateAcquired},${l.dateSold},${l.proceeds.toFixed(2)},${l.costBasis.toFixed(2)},${l.gainLoss.toFixed(2)},${l.term}`
  )
  return [header, ...rows].join('\n')
}

export function generateScheduleD(summary: TaxSummary): string {
  return [
    'IRS Schedule D Summary',
    '',
    'Part I: Short-Term Capital Gains and Losses',
    `Total Short-Term Gains,$${summary.shortTermGain.toFixed(2)}`,
    `Total Short-Term Losses,$${summary.shortTermLoss.toFixed(2)}`,
    `Net Short-Term,$${summary.netShortTerm.toFixed(2)}`,
    '',
    'Part II: Long-Term Capital Gains and Losses',
    `Total Long-Term Gains,$${summary.longTermGain.toFixed(2)}`,
    `Total Long-Term Losses,$${summary.longTermLoss.toFixed(2)}`,
    `Net Long-Term,$${summary.netLongTerm.toFixed(2)}`,
    '',
    'Summary',
    `Net Capital Gain/Loss,$${summary.netTotal.toFixed(2)}`,
    `Total Disposed Lots,${summary.totalLots}`,
  ].join('\n')
}

export function generateTurboTaxCSV(lots: TaxLot[]): string {
  const header = 'Currency Name,Purchase Date,Cost Basis,Date Sold,Proceeds'
  const rows = lots.map(l =>
    `"Polymarket: ${l.market.substring(0, 50)}",${l.dateAcquired},${l.costBasis.toFixed(2)},${l.dateSold},${l.proceeds.toFixed(2)}`
  )
  return [header, ...rows].join('\n')
}

export function generateTaxSummaryCSV(lots: TaxLot[], summary: TaxSummary): string {
  return [
    'Polymarket Tax Summary Report',
    `Generated,${new Date().toISOString()}`,
    '',
    'Overview',
    `Total Disposed Lots,${summary.totalLots}`,
    `Net Short-Term Gain/Loss,$${summary.netShortTerm.toFixed(2)}`,
    `Net Long-Term Gain/Loss,$${summary.netLongTerm.toFixed(2)}`,
    `Net Total Gain/Loss,$${summary.netTotal.toFixed(2)}`,
    '',
    'Short-Term Breakdown',
    `Gains,$${summary.shortTermGain.toFixed(2)}`,
    `Losses,$${summary.shortTermLoss.toFixed(2)}`,
    '',
    'Long-Term Breakdown',
    `Gains,$${summary.longTermGain.toFixed(2)}`,
    `Losses,$${summary.longTermLoss.toFixed(2)}`,
    '',
    'All Lots',
    'Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Gain/Loss,Term',
    ...lots.map(l => `"${l.description}",${l.dateAcquired},${l.dateSold},${l.proceeds.toFixed(2)},${l.costBasis.toFixed(2)},${l.gainLoss.toFixed(2)},${l.term}`),
  ].join('\n')
}

// ---------- Helpers ----------

function fmtDate(d: Date): string {
  if (d.getTime() === 0) return 'Unknown'
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
