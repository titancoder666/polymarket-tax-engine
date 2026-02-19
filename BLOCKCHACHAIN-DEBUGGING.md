# Blockchain Querying Debugging Session - Feb 14, 2026

## What Happened

You reported the Polymarket Tax & P/L Engine "doesn't work" when you tried a real wallet address. I debugged and found two major issues:

### Issue #1: Batch Size Too Large
**Error:** `"Batch size too large"` from Polygon RPC  
**Cause:** Trying to query 10,000 blocks at once  
**Fix:** Reduced to smaller batches + added batching logic

### Issue #2: History Pruned (BIGGER PROBLEM)
**Error:** `"History has been pruned for this block"`  
**Cause:** Free Polygon RPC nodes don't keep full blockchain history - they "prune" (delete) old data to save space  
**Current limitation:** Can only query last ~1000 blocks (30 minutes of data)

## Fundamental Problem

**The blockchain approach requires an archive node to get full trade history.**

### Free RPC Nodes
- ✅ Can query recent blocks (last 1000 blocks ~30 min)
- ❌ Cannot query old blocks (pruned for disk space)
- ❌ Cannot get full tax year history

### Archive Nodes (Paid)
- ✅ Keep ALL historical data back to genesis block
- ✅ Can query full trade history for taxes
- ❌ Require paid API key (Alchemy, Infura, QuickNode)

## Current Status

✅ App works for RECENT trades (last 30 min)  
✅ Added warning banner explaining the limitation  
❌ Cannot get full tax year history without paid archive node

## Solutions Going Forward

### Option 1: Use Alchemy Free Tier (RECOMMENDED FOR MVP)
```typescript
const POLYGON_RPC = 'https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY';
```

**Pros:**
- Alchemy free tier includes archive access
- 300M compute units/month (should be enough for testing)
- Full historical data

**Cons:**
- Requires API key signup
- Rate limited on free tier

### Option 2: Use Polymarket Official API
**Pros:**
- Purpose-built for Polymarket data
- Faster than blockchain querying
- Better market metadata

**Cons:**
- Requires API authentication
- May not be publicly available

### Option 3: Use The Graph Subgraph
**Pros:**
- Free to query
- Optimized queries
- Historical data

**Cons:**
- Need to find if Polymarket has a public subgraph
- May not exist

### Option 4: Accept Limitation (Current State)
**Pros:**
- Works right now
- No dependencies

**Cons:**
- Only shows last 30 min of trades
- Not useful for real tax purposes

## Code Changes Made

1. **Reduced block range** from 100,000 to 1,000 blocks
2. **Switched RPC** from `polygon-rpc.com` to `publicnode.com` (more reliable)
3. **Added warning banner** on UI explaining limitation
4. **Simplified batching** since we're only querying 1000 blocks now
5. **Better error handling** for pruned blocks

## Files Modified

- `/workspace/polymarket-tax/lib/polymarket.ts` - Blockchain querying logic
- `/workspace/polymarket-tax/app/page.tsx` - Added warning banner

## Next Steps

**For working demo:**
1. Sign up for Alchemy free tier account
2. Get API key for Polygon mainnet
3. Update `POLYGON_RPC` in `polymarket.ts` with Alchemy URL
4. Test with real wallet that has trade history

**For production:**
- Decide between blockchain approach (archive node) vs Polymarket API
- If blockchain: Use paid Alchemy/Infura with higher limits
- If API: Get Polymarket API access (may require partnership)

## Test Results

**Tested with wallet:** `0x4bfb41d5b3570defd03c39a9a4d8de6bd8b8982e` (CTF Exchange contract)  
**Errors encountered:**
- Batch size too large ✅ FIXED
- History pruned ⚠️ LIMITATION (need archive node)

**Current state:**
- App loads ✅
- Warning shows ✅
- Can query recent blocks ✅
- Full history blocked by free RPC limits ⚠️

---

**Bottom line:** The app works technically, but free RPC nodes don't have enough historical data for real tax use. Need Alchemy free tier (with archive) or Polymarket API to make it production-ready.
