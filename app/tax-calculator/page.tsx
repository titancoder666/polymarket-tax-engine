'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  computeSummary, generateForm8949, generateScheduleD, generateTurboTaxCSV,
  type TaxSummary,
} from '@/lib/tax-engine'
import type { TaxRecord } from '@/lib/polymarket'

// ---------- Inline CSV parser for manual uploads ----------

const COL_MAP: Record<string, string> = {
  timestamp:'ts', time:'ts', date:'ts', datetime:'ts', created:'ts', created_at:'ts',
  market:'market', market_id:'market', marketid:'market', question:'market', event:'market', title:'market', description:'market',
  outcome:'outcome', side:'outcome', position:'outcome',
  type:'type', order_type:'type', ordertype:'type', action:'type', trade_type:'type',
  price:'price', unit_price:'price', avg_price:'price',
  quantity:'qty', qty:'qty', amount:'qty', size:'qty', shares:'qty',
  total:'total', total_amount:'total', value:'total', cost:'total',
  fees:'fees', fee:'fees', commission:'fees',
}
function norm(s: string) { return COL_MAP[s.trim().toLowerCase().replace(/[^a-z0-9_]/g,'')] || '' }
function num(s?: string) { if(!s) return 0; const n=parseFloat(s.replace(/[^0-9.\-]/g,'')); return isNaN(n)?0:n }
function splitLine(line: string, d: string) {
  const r: string[]=[]; let c='',q=false
  for(const ch of line){if(ch==='"'){q=!q;continue}if(ch===d&&!q){r.push(c);c='';continue}c+=ch}
  r.push(c); return r
}

function parseCSVToTaxRecords(text: string): { records: TaxRecord[]; txCount: number } {
  const lines = text.split(/\r?\n/).filter(l=>l.trim())
  if(lines.length<2) throw new Error('CSV needs header + data rows')
  const d = lines[0].includes('\t')?'\t':','
  const headers = splitLine(lines[0],d).map(norm)
  const i=(n:string)=>headers.indexOf(n)
  const ti=i('ts'),mi=i('market'),oi=i('outcome'),tyi=i('type'),pi=i('price'),qi=i('qty'),toi=i('total'),fi=i('fees')
  if(mi===-1) throw new Error('Missing "Market" column')
  if(tyi===-1) throw new Error('Missing "Type" column (Buy/Sell/Settle)')

  interface Tx { ts:Date; market:string; outcome:string; type:'BUY'|'SELL'; price:number; qty:number; total:number }
  const txns: Tx[] = []

  for(let r=1;r<lines.length;r++){
    const c=splitLine(lines[r],d)
    if(c.length<3) continue
    const rawType=(c[tyi]||'').trim().toLowerCase()
    let side: 'BUY'|'SELL'|null = null
    if(['buy','purchase','open'].includes(rawType)) side='BUY'
    else if(['sell','close','settle','settlement','redeem','claim'].includes(rawType)) side='SELL'
    if(!side) continue
    const price=num(c[pi]), qty=num(c[qi])
    txns.push({
      ts: ti!==-1?new Date(c[ti].trim()):new Date(0),
      market:(c[mi]||'Unknown').trim(),
      outcome: oi!==-1?(c[oi]||'Yes').trim():'Yes',
      type: side, price, qty,
      total: toi!==-1?num(c[toi]):price*qty,
    })
  }
  txns.sort((a,b)=>a.ts.getTime()-b.ts.getTime())

  // FIFO
  const groups=new Map<string,Tx[]>()
  for(const t of txns){ const k=`${t.market}|||${t.outcome}`; if(!groups.has(k))groups.set(k,[]); groups.get(k)!.push(t) }
  const records: TaxRecord[]=[]
  for(const [,g] of groups){
    const buys:{ts:Date;costPer:number;rem:number}[]=[]
    for(const t of g){
      if(t.type==='BUY'){ buys.push({ts:t.ts, costPer:t.qty>0?t.total/t.qty:t.price, rem:t.qty}); continue }
      let rem=t.qty; const procPer=t.qty>0?t.total/t.qty:t.price
      while(rem>0.001&&buys.length>0){
        const b=buys[0]; const m=Math.min(rem,b.rem)
        const proceeds=Math.round(m*procPer*100)/100
        const costBasis=Math.round(m*b.costPer*100)/100
        const days=(t.ts.getTime()-b.ts.getTime())/(864e5)
        records.push({
          description:`${g[0].market} - ${g[0].outcome}`,
          dateAcquired:fmt(b.ts), dateSold:fmt(t.ts),
          proceeds, costBasis, gainLoss:Math.round((proceeds-costBasis)*100)/100,
          termType:days>=365?'Long-term':'Short-term',
        })
        b.rem-=m; rem-=m; if(b.rem<=0.001)buys.shift()
      }
    }
  }
  records.sort((a,b)=>new Date(a.dateSold).getTime()-new Date(b.dateSold).getTime())
  return { records, txCount: txns.length }
}

function fmt(d:Date){ if(d.getTime()===0)return'Unknown'; return d.toISOString().split('T')[0] }

// ---------- Component ----------

export default function TaxCalculator() {
  const [records, setRecords] = useState<TaxRecord[]>([])
  const [summary, setSummary] = useState<TaxSummary|null>(null)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [txCount, setTxCount] = useState(0)
  const [showDetails, setShowDetails] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File) => {
    setError(''); setProcessing(true); setFileName(file.name); setRecords([]); setSummary(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const { records: recs, txCount: tc } = parseCSVToTaxRecords(e.target?.result as string)
        if(!recs.length) throw new Error('No taxable events found (need Buy+Sell/Settle pairs)')
        setTxCount(tc); setRecords(recs); setSummary(computeSummary(recs))
      } catch(err) { setError(err instanceof Error?err.message:'Failed to process CSV') }
      finally { setProcessing(false) }
    }
    reader.onerror=()=>{setError('Failed to read file');setProcessing(false)}
    reader.readAsText(file)
  },[])

  const download = (content:string, name:string) => {
    const blob=new Blob([content],{type:'text/csv'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a'); a.href=url; a.download=name; a.click()
    URL.revokeObjectURL(url)
  }

  const fmtN = (n:number) => {
    const s=Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
    return `${n<0?'-':''}$${s}`
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">CSV Tax Calculator</h1>
            <p className="text-gray-400">Upload your Polymarket trade CSV — all processing happens in your browser</p>
          </div>
          <Link href="/" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">
            ← Username Lookup
          </Link>
        </div>

        {/* Upload */}
        <div
          className={`bg-slate-800 rounded-lg p-12 mb-6 border-2 border-dashed transition-colors cursor-pointer text-center ${
            dragOver?'border-violet-500 bg-violet-500/10':'border-slate-600 hover:border-slate-500'
          }`}
          onDragOver={e=>{e.preventDefault();setDragOver(true)}}
          onDragLeave={()=>setDragOver(false)}
          onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)processFile(f)}}
          onClick={()=>fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden"
            onChange={e=>{const f=e.target.files?.[0];if(f)processFile(f)}} />
          <div className="text-5xl mb-4">📄</div>
          <p className="text-lg font-semibold mb-1">{processing?'Processing...':'Drag & drop your CSV here, or click to browse'}</p>
          <p className="text-sm text-gray-500">Supports various Polymarket export formats</p>
          {processing && <div className="mt-4 flex justify-center"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"/></div>}
        </div>

        <div className="flex items-center justify-between mb-6">
          <a href="/sample-polymarket.csv" download className="text-sm text-violet-400 hover:text-violet-300 transition">
            📥 Download sample CSV
          </a>
          {fileName&&!error&&!processing&&(
            <span className="text-sm text-gray-500">Processed <strong>{fileName}</strong> — {txCount} transactions → {records.length} tax lots</span>
          )}
        </div>
        {error&&<div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-red-400 text-sm">{error}</div>}

        {summary && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                {l:'Total Lots',v:summary.totalLots.toString()},
                {l:'Net Short-Term',v:fmtN(summary.netShortTerm),c:summary.netShortTerm>=0?'text-green-400':'text-red-400'},
                {l:'Net Long-Term',v:fmtN(summary.netLongTerm),c:summary.netLongTerm>=0?'text-green-400':'text-red-400'},
                {l:'Net Gain/Loss',v:fmtN(summary.netTotal),c:summary.netTotal>=0?'text-green-400':'text-red-400'},
              ].map((x,i)=>(
                <div key={i} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <div className="text-xs text-gray-400 uppercase mb-1">{x.l}</div>
                  <div className={`text-2xl font-bold ${x.c||'text-white'}`}>{x.v}</div>
                </div>
              ))}
            </div>

            <div className="bg-slate-800 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Download Reports</h2>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={()=>download(generateForm8949(records),'form-8949.csv')} className="px-4 py-3 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-semibold transition">📋 Form 8949</button>
                <button onClick={()=>download(generateScheduleD(summary),'schedule-d.csv')} className="px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition">📊 Schedule D</button>
                <button onClick={()=>download(generateTurboTaxCSV(records),'turbotax.csv')} className="px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold transition">💰 TurboTax CSV</button>
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg overflow-hidden">
              <div className="p-6 flex justify-between items-center">
                <h2 className="text-lg font-semibold">Tax Lots ({records.length})</h2>
                <button onClick={()=>setShowDetails(!showDetails)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">
                  {showDetails?'Hide':'Show'} Details
                </button>
              </div>
              {showDetails&&(
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-900">
                      <tr>
                        {['Description','Acquired','Sold','Proceeds','Cost Basis','Gain/Loss','Term'].map(h=>(
                          <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-400 uppercase ${['Proceeds','Cost Basis','Gain/Loss'].includes(h)?'text-right':'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {records.slice(0,200).map((r,i)=>(
                        <tr key={i} className="hover:bg-slate-700/30">
                          <td className="px-4 py-3 text-sm max-w-xs truncate">{r.description}</td>
                          <td className="px-4 py-3 text-sm">{r.dateAcquired}</td>
                          <td className="px-4 py-3 text-sm">{r.dateSold}</td>
                          <td className="px-4 py-3 text-sm text-right">{fmtN(r.proceeds)}</td>
                          <td className="px-4 py-3 text-sm text-right">{fmtN(r.costBasis)}</td>
                          <td className={`px-4 py-3 text-sm text-right font-semibold ${r.gainLoss>=0?'text-green-400':'text-red-400'}`}>{fmtN(r.gainLoss)}</td>
                          <td className="px-4 py-3 text-sm"><span className={`px-2 py-0.5 text-xs rounded ${r.termType==='Short-term'?'bg-orange-500/20 text-orange-400':'bg-blue-500/20 text-blue-400'}`}>{r.termType}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {records.length>200&&<div className="p-4 text-center text-sm text-gray-400">Showing first 200 of {records.length}. Download for all.</div>}
                </div>
              )}
            </div>
          </>
        )}

        {!summary&&!processing&&!error&&(
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">Upload a CSV to calculate your Polymarket taxes</p>
            <p className="text-sm">FIFO cost basis • IRS Form 8949 • Schedule D • TurboTax compatible</p>
          </div>
        )}
      </div>
    </div>
  )
}
