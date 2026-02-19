import { getUserTrades, calculatePnL, getUserPositions } from './lib/polymarket';

async function test() {
  console.log('=== teen11 E2E Test ===\n');
  
  // Step 1: Fetch trades
  const trades = await getUserTrades('teen11');
  const wallet = trades[0]?.proxyWallet?.toLowerCase();
  console.log(`\nWallet: ${wallet}`);
  console.log(`Expected: 0x7319ce70fb19a3ebc9d16ad7a8e0d54544bd72d5`);
  console.log(`Match: ${wallet === '0x7319ce70fb19a3ebc9d16ad7a8e0d54544bd72d5' ? '✅' : '❌'}`);
  console.log(`Total trades fetched: ${trades.length}`);
  
  // Step 2: Calculate P&L
  const pnl = await calculatePnL(trades);
  let totalGainLoss = 0;
  let totalRecords = 0;
  let totalProceeds = 0;
  let totalCostBasis = 0;
  for (const records of pnl.values()) {
    for (const r of records) {
      totalGainLoss += r.gainLoss;
      totalProceeds += r.proceeds;
      totalCostBasis += r.costBasis;
      totalRecords++;
    }
  }
  
  // Step 3: Fetch positions
  const positions = await getUserPositions('teen11');
  let totalCashPnl = 0;
  let totalRealizedPnl = 0;
  for (const p of positions) {
    totalCashPnl += p.cashPnl;
    totalRealizedPnl += p.realizedPnl;
  }
  
  console.log(`\n=== COMPARISON WITH POLYMARKET ===`);
  console.log(`Polymarket shows:`);
  console.log(`  Markets traded: 950`);
  console.log(`  Volume: $1,184,949.86`);
  console.log(`  P&L: $4,188.15`);
  console.log(`  Largest win: $1,877.67`);
  console.log(`  Portfolio value: $405.83`);
  
  console.log(`\nOur tool shows:`);
  console.log(`  Trades fetched: ${trades.length}`);
  console.log(`  Unique positions: ${pnl.size}`);
  console.log(`  Tax records (closed positions): ${totalRecords}`);
  console.log(`  Total proceeds: $${totalProceeds.toFixed(2)}`);
  console.log(`  Total cost basis: $${totalCostBasis.toFixed(2)}`);
  console.log(`  Realized gain/loss (FIFO): $${totalGainLoss.toFixed(2)}`);
  console.log(`  Positions from API: ${positions.length}`);
  console.log(`  Sum cashPnl from positions API: $${totalCashPnl.toFixed(2)}`);
  
  // Count buy volume
  let buyVol = 0, sellVol = 0;
  for (const t of trades) {
    if (t.side === 'BUY') buyVol += t.usdcSize;
    else sellVol += t.usdcSize;
  }
  console.log(`\n  Buy volume: $${buyVol.toFixed(2)}`);
  console.log(`  Sell volume: $${sellVol.toFixed(2)}`);
  console.log(`  Total volume: $${(buyVol + sellVol).toFixed(2)}`);
}

test().catch(console.error);
