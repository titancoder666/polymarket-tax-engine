# Polymarket Tax & P/L Engine

A web app that calculates tax-ready P&L data from your Polymarket trades using only your Polygon wallet address.

## Features

✅ **Wallet-Based Querying** - No CSV uploads needed, just enter your address  
✅ **On-Chain Data** - Queries Polymarket trades from Polygon blockchain  
✅ **FIFO Cost Basis** - Proper first-in-first-out matching for tax compliance  
✅ **Form 8949 Ready** - Exports CSV formatted for IRS tax forms  
✅ **Short-term vs Long-term** - Automatically classifies capital gains  
✅ **Realized P&L Only** - Only shows closed positions with realized gains/losses  

## How It Works

1. **Enter Wallet Address** - Paste your Polygon wallet address (0x...)
2. **Query Trades** - Fetches all Polymarket trades via Polymarket API
3. **Calculate P&L** - Uses FIFO to match buys/sells and compute realized gains
4. **Export CSV** - Download tax-ready data for Form 8949

## Tech Stack

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Blockchain:** ethers.js, Polygon RPC
- **APIs:** Polymarket Gamma API, CLOB API
- **Calculations:** FIFO cost basis, short-term vs long-term capital gains

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Tax Calculations

### FIFO Matching
- Buys are matched with sells using First-In-First-Out
- Each sale is matched against the oldest remaining buy

### Capital Gains
- **Short-term:** Held < 1 year (taxed as ordinary income)
- **Long-term:** Held > 1 year (preferential tax rate)

### Settlement
- Resolved markets automatically close remaining positions at $0 or $1
- Settlement date is used as the sell date

## CSV Export Format

The exported CSV includes these columns:

- **Description of Property:** Market name + side (YES/NO)
- **Date Acquired:** When the position was opened
- **Date Sold:** When closed or settled
- **Proceeds:** Sale price × shares
- **Cost Basis:** Purchase price × shares
- **Gain/Loss:** Proceeds - Cost Basis
- **Term:** Short-term or Long-term

## Limitations (MVP)

⚠️ **This is an MVP** - Not all edge cases are handled:

- No wash sale detection
- No multi-leg strategy support
- Limited error handling for API failures
- Blockchain fallback not fully implemented
- Assumes USDC = $1.00

## Disclaimer

This tool provides informational estimates only and is **not tax advice**. Consult a qualified tax professional before filing. Polymarket trades may have unique tax treatment - the IRS has not issued definitive guidance on prediction market contracts.

## API Endpoints Used

- **Gamma API:** `https://gamma-api.polymarket.com` (trade history)
- **CLOB API:** `https://clob.polymarket.com` (market data)
- **Polygon RPC:** Public RPC for blockchain queries

## Development

Built by an AI assistant in ~1 hour as a proof of concept.

**Next Steps:**
- Add better error handling
- Implement full blockchain fallback
- Support batch wallet queries
- Add tax estimation (brackets, rates)
- Multi-year support
- PDF report generation

## License

MIT
