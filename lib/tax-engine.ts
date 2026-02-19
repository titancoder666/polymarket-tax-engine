import type { TaxRecord } from './polymarket'

export interface TaxSummary {
  totalLots: number
  shortTermGain: number
  shortTermLoss: number
  longTermGain: number
  longTermLoss: number
  netShortTerm: number
  netLongTerm: number
  netTotal: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function computeSummary(records: TaxRecord[]): TaxSummary {
  let stG = 0, stL = 0, ltG = 0, ltL = 0
  for (const r of records) {
    if (r.termType === 'Short-term') {
      if (r.gainLoss >= 0) stG += r.gainLoss; else stL += r.gainLoss
    } else {
      if (r.gainLoss >= 0) ltG += r.gainLoss; else ltL += r.gainLoss
    }
  }
  return {
    totalLots: records.length,
    shortTermGain: r2(stG), shortTermLoss: r2(stL),
    longTermGain: r2(ltG), longTermLoss: r2(ltL),
    netShortTerm: r2(stG + stL), netLongTerm: r2(ltG + ltL),
    netTotal: r2(stG + stL + ltG + ltL),
  }
}

export function generateForm8949(records: TaxRecord[]): string {
  const header = 'Description of Property,Date Acquired,Date Sold or Disposed,Proceeds,Cost or Other Basis,Gain or (Loss),Short-term or Long-term'
  const rows = records.map(r =>
    `"${r.description}",${r.dateAcquired},${r.dateSold},${r.proceeds.toFixed(2)},${r.costBasis.toFixed(2)},${r.gainLoss.toFixed(2)},${r.termType}`
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

export function generateTurboTaxCSV(records: TaxRecord[]): string {
  const header = 'Currency Name,Purchase Date,Cost Basis,Date Sold,Proceeds'
  const rows = records.map(r =>
    `"Polymarket: ${r.description.substring(0, 50)}",${r.dateAcquired},${r.costBasis.toFixed(2)},${r.dateSold},${r.proceeds.toFixed(2)}`
  )
  return [header, ...rows].join('\n')
}
