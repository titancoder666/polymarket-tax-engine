import axios from 'axios';

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
  conditionId: string;
  curPrice: number;
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

export interface ProfileSummary {
  username: string;
  wallet: string;
  positions: PositionSummary[];
  totalCashPnl: number;
  totalRealizedPnl: number;
  totalInitialValue: number;
  totalCurrentValue: number;
  totalUnrealizedPnl: number;
  marketsTraded: number;
  portfolioValue: number;
}

/**
 * Resolve a Polymarket username to wallet address
 */
async function resolveUsernameToWallet(username: string): Promise<string> {
  if (username.startsWith('0x') && username.length === 42) {
    return username.toLowerCase();
  }

  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
  console.log(`Resolving username "${cleanUsername}"...`);
  
  const isBrowser = typeof window !== 'undefined';
  
  if (isBrowser) {
    const response = await axios.get(`/api/resolve?username=${encodeURIComponent(cleanUsername)}`);
    if (response.data.wallet) {
      console.log(`Resolved "${cleanUsername}" to wallet: ${response.data.wallet}`);
      return response.data.wallet;
    }
    throw new Error(response.data.error || 'Unknown error resolving username');
  }
  
  // Server-side: fetch profile page directly
  const response = await axios.get(
    `https://polymarket.com/profile/@${encodeURIComponent(cleanUsername)}`,
    {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      maxRedirects: 5,
      timeout: 15000
    }
  );
  
  const html = typeof response.data === 'string' ? response.data : '';
  
  if (html.includes('"page":"/404"') || html.includes('404 Page Not Found')) {
    throw new Error(
      `Profile "${cleanUsername}" does not exist on Polymarket. Check for typos or use your wallet address (0x...).`
    );
  }
  
  const walletMatch = html.match(/"proxyWallet":"(0x[a-fA-F0-9]{40})"/);
  if (walletMatch) return walletMatch[1].toLowerCase();
  
  const proxyMatch = html.match(/"proxyAddress":"(0x[a-fA-F0-9]{40})"/);
  if (proxyMatch) return proxyMatch[1].toLowerCase();
  
  throw new Error(`Could not extract wallet from profile. Please enter your wallet address directly (0x...).`);
}

/**
 * Fetch user profile with positions P&L from Polymarket's positions API.
 * This is the SOURCE OF TRUTH — same data Polymarket's UI uses.
 */
export async function getUserProfile(usernameOrWallet: string): Promise<ProfileSummary> {
  const wallet = await resolveUsernameToWallet(usernameOrWallet);
  const cleanUsername = usernameOrWallet.startsWith('0x') ? '' : usernameOrWallet.replace(/^@/, '');
  
  console.log(`Fetching positions for wallet: ${wallet}`);
  
  // Fetch ALL positions (paginated)
  const allPositions: PositionSummary[] = [];
  let offset = 0;
  const BATCH_SIZE = 500;
  
  for (let batch = 0; batch < 20; batch++) {
    const response = await axios.get(`${DATA_API}/positions`, {
      params: { user: wallet, limit: BATCH_SIZE, offset, sortBy: 'CASHPNL' }
    });
    
    const data = response.data;
    if (!Array.isArray(data) || data.length === 0) break;
    
    for (const p of data) {
      allPositions.push({
        title: p.title || 'Unknown Market',
        outcome: p.outcome || `Outcome ${p.outcomeIndex}`,
        size: parseFloat(p.size) || 0,
        avgPrice: parseFloat(p.avgPrice) || 0,
        initialValue: parseFloat(p.initialValue) || 0,
        currentValue: parseFloat(p.currentValue) || 0,
        cashPnl: parseFloat(p.cashPnl) || 0,
        percentPnl: parseFloat(p.percentPnl) || 0,
        realizedPnl: parseFloat(p.realizedPnl) || 0,
        totalBought: parseFloat(p.totalBought) || 0,
        conditionId: p.conditionId || '',
        curPrice: parseFloat(p.curPrice) || 0,
      });
    }
    
    if (data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }
  
  // Calculate totals
  const totalCashPnl = allPositions.reduce((sum, p) => sum + p.cashPnl, 0);
  const totalRealizedPnl = allPositions.reduce((sum, p) => sum + p.realizedPnl, 0);
  const totalInitialValue = allPositions.reduce((sum, p) => sum + p.initialValue, 0);
  const totalCurrentValue = allPositions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalUnrealizedPnl = totalCurrentValue - totalInitialValue;
  
  // Count unique markets
  const uniqueMarkets = new Set(allPositions.map(p => p.conditionId));
  
  // Portfolio = current value of open positions
  const portfolioValue = allPositions
    .filter(p => p.size > 0)
    .reduce((sum, p) => sum + p.currentValue, 0);
  
  return {
    username: cleanUsername || wallet,
    wallet,
    positions: allPositions,
    totalCashPnl: Math.round(totalCashPnl * 100) / 100,
    totalRealizedPnl: Math.round(totalRealizedPnl * 100) / 100,
    totalInitialValue: Math.round(totalInitialValue * 100) / 100,
    totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
    totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
    marketsTraded: uniqueMarkets.size,
    portfolioValue: Math.round(portfolioValue * 100) / 100,
  };
}

/**
 * Fetch trades for tax record generation.
 * Uses cursor-based pagination to get as many trades as possible.
 */
export async function getUserTrades(usernameOrWallet: string): Promise<PolymarketTrade[]> {
  const wallet = await resolveUsernameToWallet(usernameOrWallet);
  console.log(`Fetching trades for wallet: ${wallet}`);
  
  const allTrades: PolymarketTrade[] = [];
  const BATCH_SIZE = 500;
  const MAX_OFFSET = 3000;
  const MAX_WINDOWS = 20;
  let endTimestamp: number | undefined = undefined;
  
  for (let window = 0; window < MAX_WINDOWS; window++) {
    let offset = 0;
    let windowTradeCount = 0;
    let oldestTimestamp: number | undefined = undefined;
    
    while (offset <= MAX_OFFSET) {
      console.log(`Window ${window + 1}, offset ${offset}...`);
      
      try {
        const params: any = { user: wallet, limit: BATCH_SIZE, offset };
        if (endTimestamp !== undefined) params.end = endTimestamp;
        
        const response = await axios.get(`${DATA_API}/activity`, { params });
        const activities = response.data;
        
        if (!Array.isArray(activities) || activities.length === 0) {
          oldestTimestamp = undefined;
          break;
        }
        
        for (const a of activities) {
          if (oldestTimestamp === undefined || a.timestamp < oldestTimestamp) {
            oldestTimestamp = a.timestamp;
          }
        }
        
        const trades = activities.filter((t: any) => t.type === 'TRADE');
        allTrades.push(...trades);
        windowTradeCount += trades.length;
        
        console.log(`  +${trades.length} trades (total: ${allTrades.length})`);
        
        if (activities.length < BATCH_SIZE) break;
        offset += BATCH_SIZE;
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        if (error?.response?.status === 400) break;
        throw error;
      }
    }
    
    if (oldestTimestamp === undefined || windowTradeCount === 0) break;
    endTimestamp = oldestTimestamp - 1;
  }
  
  console.log(`Total trades fetched: ${allTrades.length}`);
  return allTrades.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Calculate tax records from trades using FIFO method
 */
export function calculateTaxRecords(trades: PolymarketTrade[]): TaxRecord[] {
  const positionKey = (t: PolymarketTrade) => `${t.conditionId}-${t.outcome}`;
  const grouped = new Map<string, PolymarketTrade[]>();
  
  for (const trade of trades) {
    const key = positionKey(trade);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(trade);
  }
  
  const allRecords: TaxRecord[] = [];
  
  for (const [, positionTrades] of grouped) {
    const firstTrade = positionTrades[0];
    const buyQueue: Array<{ shares: number; costPerShare: number; timestamp: number }> = [];
    
    for (const trade of positionTrades) {
      if (trade.side === 'BUY') {
        buyQueue.push({
          shares: trade.size,
          costPerShare: trade.usdcSize / trade.size, // actual USD cost per share
          timestamp: trade.timestamp
        });
      } else if (trade.side === 'SELL') {
        let remainingShares = trade.size;
        const proceedsPerShare = trade.usdcSize / trade.size;
        const sellDate = new Date(trade.timestamp * 1000);
        
        while (remainingShares > 0.001 && buyQueue.length > 0) {
          const oldest = buyQueue[0];
          const sharesToSell = Math.min(remainingShares, oldest.shares);
          
          const proceeds = sharesToSell * proceedsPerShare;
          const costBasis = sharesToSell * oldest.costPerShare;
          const gainLoss = proceeds - costBasis;
          
          const buyDate = new Date(oldest.timestamp * 1000);
          const holdingDays = (sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24);
          
          allRecords.push({
            description: `${firstTrade.title} - ${firstTrade.outcome}`,
            dateAcquired: buyDate.toISOString().split('T')[0],
            dateSold: sellDate.toISOString().split('T')[0],
            proceeds: Math.round(proceeds * 100) / 100,
            costBasis: Math.round(costBasis * 100) / 100,
            gainLoss: Math.round(gainLoss * 100) / 100,
            termType: holdingDays > 365 ? 'Long-term' : 'Short-term'
          });
          
          remainingShares -= sharesToSell;
          oldest.shares -= sharesToSell;
          if (oldest.shares <= 0.001) buyQueue.shift();
        }
      }
    }
  }
  
  return allRecords.sort((a, b) => new Date(a.dateSold).getTime() - new Date(b.dateSold).getTime());
}

/**
 * Export tax records to CSV for IRS Form 8949
 */
export function exportToCSV(records: TaxRecord[]): string {
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
  
  for (const r of records) {
    csv += [
      `"${r.description}"`,
      r.dateAcquired,
      r.dateSold,
      r.proceeds.toFixed(2),
      r.costBasis.toFixed(2),
      r.gainLoss.toFixed(2),
      r.termType
    ].join(',') + '\n';
  }
  
  return csv;
}
