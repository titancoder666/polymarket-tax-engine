import { NextRequest } from 'next/server';
import axios from 'axios';

const DATA_API = 'https://data-api.polymarket.com';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Fetch one "window" of trades from the Activity API.
 * Query params:
 *   wallet - proxy wallet address
 *   end    - (optional) end timestamp for this window
 * 
 * Returns JSON:
 *   { trades: [...], oldestTimestamp: number|null, count: number }
 * 
 * The frontend calls this repeatedly, passing the returned oldestTimestamp - 1
 * as the next `end` parameter, until count === 0.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  if (!wallet) {
    return Response.json({ error: 'wallet required' }, { status: 400 });
  }

  const endParam = request.nextUrl.searchParams.get('end');
  const endTimestamp = endParam ? parseInt(endParam) : undefined;

  const BATCH_SIZE = 500;
  const MAX_OFFSET = 3000;

  const trades: any[] = [];
  let oldestTimestamp: number | undefined = undefined;
  let offset = 0;

  while (offset <= MAX_OFFSET) {
    try {
      const params: any = { user: wallet, limit: BATCH_SIZE, offset };
      if (endTimestamp !== undefined) params.end = endTimestamp;

      const response = await axios.get(`${DATA_API}/activity`, { params, timeout: 10000 });
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

      const filtered = activities.filter((t: any) =>
        t.type === 'TRADE' || (t.type === 'REDEEM' && t.usdcSize > 0)
      );

      for (const t of filtered) {
        if (t.type === 'REDEEM') {
          t.side = 'SELL';
          t.price = 1.0;
          t.size = t.usdcSize;
          t.outcome = t.outcome || '__REDEEM__';
        }
      }

      trades.push(...filtered);

      if (activities.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;

      await new Promise(r => setTimeout(r, 50));
    } catch (error: any) {
      if (error?.response?.status === 400) break;
      throw error;
    }
  }

  return Response.json({
    trades,
    oldestTimestamp: oldestTimestamp ?? null,
    count: trades.length,
  });
}
