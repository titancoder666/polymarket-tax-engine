import axios from 'axios';

// Polymarket public data API
const DATA_API = 'https://data-api.polymarket.com';

export interface PolymarketTrade {
  proxyWallet: string;
  side: 'BUY' | 'SELL';
  asset: string;
  conditionId: string;
  size: number;
  price: number;
  timestamp: number;
  title: string;
  slug: string;
  eventSlug: string;
  outcome: string;
  outcomeIndex: number;
  name: string;
  pseudonym: string;
  transactionHash: string;
  usdcSize: number;
  type: string;
}

export interface TaxRecord {
  description: string;
  dateAcquired: string;
  dateSold: string;
  proceeds: number;
  costBasis: number;
  gainLoss: number;
  termType: 'Short-term' | 'Long-term';
}

export interface PositionSummary {
  title: string;
  outcome: string;
  size: number;
  avgPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  realizedPnl: number;
  totalBought: number;
}

/**
 * Resolve a Polymarket username/slug to a wallet address.
 * Tries multiple approaches.
 */
async function resolveUsernameToWallet(username: string): Promise<string> {
  // If already a wallet address, return as-is
  if (username.startsWith('0x') && username.length === 42) {
    return username.toLowerCase();
  }

  // Approach 1: Scan recent trades to find matching name
  // This works because the trades endpoint includes a "name" field
  console.log(`Resolving username "${username}" to wallet address...`);
  
  const SCAN_BATCHES = 20; // Scan up to 10,000 recent trades
  const BATCH_SIZE = 500;
  
  for (let i = 0; i < SCAN_BATCHES; i++) {
    try {
      const response = await axios.get(`${DATA_API}/trades`, {
        params: { limit: BATCH_SIZE, offset: i * BATCH_SIZE }
      });
      
      const trades = response.data;
      if (!trades || trades.length === 0) break;
      
      // Check for matching username (case-insensitive)
      const match = trades.find((t: any) => 
        t.name && t.name.toLowerCase() === username.toLowerCase()
      );
      
      if (match) {
        console.log(`Resolved "${username}" to wallet: ${match.proxyWallet}`);
        return match.proxyWallet.toLowerCase();
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.warn(`Batch ${i} failed:`, error);
    }
  }
  
  throw new Error(
    `Could not resolve username "${username}" to a wallet address. ` +
    `Try entering your Polymarket wallet address directly (starts with 0x). ` +
    `You can find it on your Polymarket profile page.`
  );
}

/**
 * Fetch all trades for a wallet address using the activity endpoint (server-side filtered)
 */
export async function getUserTrades(usernameOrWallet: string): Promise<PolymarketTrade[]> {
  console.log(`Fetching trades for: ${usernameOrWallet}`);
  
  // Step 1: Resolve to wallet address
  const wallet = await resolveUsernameToWallet(usernameOrWallet);
  console.log(`Using wallet: ${wallet}`);
  
  // Step 2: Fetch ALL trades using the activity endpoint (server-side filtered!)
  const allTrades: PolymarketTrade[] = [];
  const BATCH_SIZE = 500;
  const MAX_BATCHES = 200; // Up to 100,000 trades
  let offset = 0;
  
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    console.log(`Batch ${batch + 1}: Fetching ${BATCH_SIZE} trades (offset ${offset})...`);
    
    try {
      const response = await axios.get(`${DATA_API}/activity`, {
        params: {
          user: wallet,
          limit: BATCH_SIZE,
          offset: offset
        }
      });
      
      const trades = response.data;
      
      if (!Array.isArray(trades) || trades.length === 0) {
        console.log('No more trades available');
        break;
      }
      
      // Only include TRADE type entries (not deposits/withdrawals)
      const tradeTrades = trades.filter((t: any) => t.type === 'TRADE');
      allTrades.push(...tradeTrades);
      
      console.log(`Got ${tradeTrades.length} trades in this batch (total: ${allTrades.length})`);
      
      // If we got fewer than requested, we've reached the end
      if (trades.length < BATCH_SIZE) {
        console.log('Reached end of trade history');
        break;
      }
      
      offset += BATCH_SIZE;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error('Error fetching trades:', error);
      throw new Error(`Failed to fetch trades: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  console.log(`Total trades fetched: ${allTrades.length}`);
  
  if (allTrades.length === 0) {
    throw new Error(`No trades found for: ${usernameOrWallet}`);
  }
  
  // Sort by timestamp (oldest first for FIFO)
  return allTrades.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Fetch current positions with pre-calculated P&L from Polymarket
 */
export async function getUserPositions(usernameOrWallet: string): Promise<PositionSummary[]> {
  const wallet = await resolveUsernameToWallet(usernameOrWallet);
  
  const positions: PositionSummary[] = [];
  let offset = 0;
  const BATCH_SIZE = 100;
  
  for (let batch = 0; batch < 50; batch++) {
    try {
      const response = await axios.get(`${DATA_API}/positions`, {
        params: {
          user: wallet,
          limit: BATCH_SIZE,
          offset: offset,
          sortBy: 'CASHPNL'
        }
      });
      
      const data = response.data;
      if (!Array.isArray(data) || data.length === 0) break;
      
      for (const p of data) {
        positions.push({
          title: p.title || 'Unknown Market',
          outcome: p.outcome || `Index ${p.outcomeIndex}`,
          size: p.size || 0,
          avgPrice: p.avgPrice || 0,
          initialValue: p.initialValue || 0,
          currentValue: p.currentValue || 0,
          cashPnl: p.cashPnl || 0,
          percentPnl: p.percentPnl || 0,
          realizedPnl: p.realizedPnl || 0,
          totalBought: p.totalBought || 0
        });
      }
      
      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
      
    } catch (error) {
      console.warn('Error fetching positions:', error);
      break;
    }
  }
  
  return positions;
}

/**
 * Group trades by market and calculate P&L using FIFO
 */
export async function calculatePnL(trades: PolymarketTrade[]): Promise<Map<string, TaxRecord[]>> {
  const recordsByMarket = new Map<string, TaxRecord[]>();
  
  // Group trades by (conditionId + outcome)
  const positionKey = (trade: PolymarketTrade) => `${trade.conditionId}-${trade.outcome}`;
  
  const positionMap = new Map<string, PolymarketTrade[]>();
  
  for (const trade of trades) {
    const key = positionKey(trade);
    if (!positionMap.has(key)) {
      positionMap.set(key, []);
    }
    positionMap.get(key)!.push(trade);
  }
  
  console.log(`Analyzing ${positionMap.size} unique positions...`);
  
  // Calculate P&L for each position using FIFO
  for (const [key, positionTrades] of positionMap) {
    const firstTrade = positionTrades[0];
    const taxRecords: TaxRecord[] = [];
    
    // FIFO queue of buys
    const buyQueue: Array<{ size: number; price: number; timestamp: number }> = [];
    
    for (const trade of positionTrades) {
      if (trade.side === 'BUY') {
        buyQueue.push({
          size: trade.size,
          price: trade.price,
          timestamp: trade.timestamp
        });
      } else if (trade.side === 'SELL') {
        let remainingSize = trade.size;
        const sellPrice = trade.price;
        const sellDate = new Date(trade.timestamp * 1000);
        
        while (remainingSize > 0.0001 && buyQueue.length > 0) {
          const oldestBuy = buyQueue[0];
          const sizeToSell = Math.min(remainingSize, oldestBuy.size);
          
          const proceeds = sizeToSell * sellPrice;
          const costBasis = sizeToSell * oldestBuy.price;
          const gainLoss = proceeds - costBasis;
          
          const buyDate = new Date(oldestBuy.timestamp * 1000);
          const holdingDays = (sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24);
          const termType = holdingDays > 365 ? 'Long-term' : 'Short-term';
          
          taxRecords.push({
            description: `${firstTrade.title || 'Unknown Market'} - ${firstTrade.outcome || 'Unknown'}`,
            dateAcquired: buyDate.toISOString().split('T')[0],
            dateSold: sellDate.toISOString().split('T')[0],
            proceeds: Math.round(proceeds * 100) / 100,
            costBasis: Math.round(costBasis * 100) / 100,
            gainLoss: Math.round(gainLoss * 100) / 100,
            termType
          });
          
          remainingSize -= sizeToSell;
          oldestBuy.size -= sizeToSell;
          
          if (oldestBuy.size <= 0.0001) {
            buyQueue.shift();
          }
        }
      }
    }
    
    if (taxRecords.length > 0) {
      recordsByMarket.set(key, taxRecords);
    }
  }
  
  return recordsByMarket;
}

/**
 * Export tax records to CSV for Form 8949
 */
export function exportToCSV(recordsByMarket: Map<string, TaxRecord[]>): string {
  const allRecords: TaxRecord[] = [];
  for (const records of recordsByMarket.values()) {
    allRecords.push(...records);
  }
  
  // Sort by date sold
  allRecords.sort((a, b) => new Date(a.dateSold).getTime() - new Date(b.dateSold).getTime());
  
  const headers = [
    'Description of Property',
    'Date Acquired',
    'Date Sold',
    'Proceeds',
    'Cost Basis',
    'Gain/Loss',
    'Term (Short/Long)'
  ];
  
  let csv = headers.join(',') + '\n';
  
  for (const record of allRecords) {
    csv += [
      `"${record.description}"`,
      record.dateAcquired,
      record.dateSold,
      record.proceeds.toFixed(2),
      record.costBasis.toFixed(2),
      record.gainLoss.toFixed(2),
      record.termType
    ].join(',') + '\n';
  }
  
  return csv;
}
