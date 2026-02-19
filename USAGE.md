# Polymarket Tax Engine - Usage Guide

## Running the App

**Server is currently running at:**
```
http://localhost:3000
```

**To restart later:**
```bash
cd /Users/alienware/.openclaw/workspace/polymarket-tax
npm run dev
```

---

## How to Use

### 1. Enter Wallet Address
Paste your Polygon wallet address in the input field. Format: `0x...` (42 characters)

Example test wallet (you can try):
```
0x0000000000000000000000000000000000000000
```

### 2. Query Trades
Click "Query Trades" to fetch all Polymarket trades for that wallet.

The app will:
- Query Polymarket's Gamma API for trade history
- Fetch market resolution data
- Parse all trades (buy/sell, YES/NO, prices, timestamps)

### 3. View Results

You'll see:
- **Summary Cards:** Total trades, P&L, short-term vs long-term breakdown
- **Tax Records Table:** Form 8949 ready data with all tax lots
- **Trade History Table:** Raw trade data for verification

### 4. Export CSV

Click "Download CSV" to export tax records in Form 8949 format.

The CSV includes:
- Description (market + side)
- Date acquired
- Date sold
- Proceeds
- Cost basis
- Gain/loss
- Term type (short/long)

---

## Understanding the Data

### FIFO Cost Basis

Trades are matched using First-In-First-Out:

**Example:**
1. Buy 100 YES @ $0.50 on Jan 1
2. Buy 50 YES @ $0.60 on Feb 1
3. Sell 75 YES @ $0.70 on Mar 1

**Result:**
- First 75 shares from Jan 1 purchase are sold
- Cost basis = 75 × $0.50 = $37.50
- Proceeds = 75 × $0.70 = $52.50
- Gain = $15.00
- Term = Short-term (held < 1 year)

### Short-term vs Long-term

- **Short-term:** Held ≤ 365 days → Taxed as ordinary income
- **Long-term:** Held > 365 days → Preferential tax rate (0%, 15%, or 20%)

Most prediction market trades are short-term since markets resolve quickly.

### Resolved Markets

When a market resolves:
- YES side settles at $1.00 if outcome is YES, $0.00 if NO
- NO side settles at $1.00 if outcome is NO, $0.00 if YES
- Remaining open positions are automatically closed at settlement price
- This generates a taxable event

---

## Current Limitations

### API Dependency
- Currently relies on Polymarket's Gamma API
- If API is down, queries will fail
- Blockchain fallback is stubbed but not fully implemented

### Data Accuracy
- Assumes API data is complete and accurate
- No validation against blockchain events
- Settlement prices assumed to be 0 or 1

### Edge Cases Not Handled
- ❌ Wash sales (selling at loss and rebuying within 30 days)
- ❌ Complex multi-leg strategies
- ❌ Token wrapping/unwrapping
- ❌ Gas fees
- ❌ Liquidity provider positions

### Testing Needed
- App has not been tested with real wallet data
- P&L calculations are theoretical
- CSV export format should be verified with tax software

---

## Troubleshooting

### "Invalid Ethereum address"
- Make sure address starts with `0x`
- Address must be exactly 42 characters
- Only hexadecimal characters (0-9, a-f)

### "No trades found for this wallet address"
- Wallet may have no Polymarket activity
- API might be down
- Address might be on wrong chain (must be Polygon)

### "Failed to fetch trades"
- Polymarket API might be rate-limiting
- Network connectivity issue
- Try again in a few seconds

### Trades show but no tax records
- All positions may still be open (not resolved)
- Only closed positions generate tax records
- Check if markets have resolved

---

## Testing with Real Data

To test with a real wallet:

1. Find a Polygon address that has Polymarket activity
2. You can check activity on Polygonscan: `https://polygonscan.com/address/0x...`
3. Look for transactions to/from Polymarket contracts
4. Common contract: `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` (CTF Exchange)

---

## Next Steps

**To make this production-ready:**

1. **Add blockchain fallback**
   - Query Polygon directly if API fails
   - Parse `Transfer` and `OrderFilled` events
   - Reconstruct trades from raw events

2. **Better error handling**
   - Retry logic for API calls
   - User-friendly error messages
   - Graceful degradation

3. **Data validation**
   - Cross-check API data with blockchain
   - Verify settlement prices
   - Detect missing trades

4. **Enhanced tax features**
   - Wash sale detection
   - Gas fee tracking
   - Multi-year support
   - Estimated tax liability calculator

5. **Performance**
   - Cache market data
   - Batch API requests
   - Loading progress indicator

---

## Support

This is an MVP built to demonstrate the concept. For production use:

- Add comprehensive error handling
- Implement blockchain fallback
- Add unit tests
- Consult with tax professionals for accuracy
- Consider using professional tax software APIs

**Remember:** This is NOT tax advice. Always consult a qualified tax professional.
