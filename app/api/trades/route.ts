import { NextRequest } from 'next/server';
import axios from 'axios';

const DATA_API = 'https://data-api.polymarket.com';

export const maxDuration = 60; // Vercel max for hobby

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  if (!wallet) {
    return new Response(JSON.stringify({ error: 'wallet required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const allTrades: any[] = [];
        const BATCH_SIZE = 500;
        const MAX_OFFSET = 3000;
        const MAX_WINDOWS = 50; // Support up to ~175K trades
        let endTimestamp: number | undefined = undefined;

        for (let window = 0; window < MAX_WINDOWS; window++) {
          let offset = 0;
          let windowTradeCount = 0;
          let oldestTimestamp: number | undefined = undefined;

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

              const trades = activities.filter((t: any) =>
                t.type === 'TRADE' || (t.type === 'REDEEM' && t.usdcSize > 0)
              );

              for (const t of trades) {
                if (t.type === 'REDEEM') {
                  t.side = 'SELL';
                  t.price = 1.0;
                  t.size = t.usdcSize;
                  t.outcome = t.outcome || '__REDEEM__';
                }
              }

              allTrades.push(...trades);
              windowTradeCount += trades.length;

              if (activities.length < BATCH_SIZE) break;
              offset += BATCH_SIZE;

              await new Promise(r => setTimeout(r, 50));
            } catch (error: any) {
              if (error?.response?.status === 400) break;
              throw error;
            }
          }

          send({
            type: 'progress',
            window: window + 1,
            windowTrades: windowTradeCount,
            totalTrades: allTrades.length,
          });

          if (oldestTimestamp === undefined || windowTradeCount === 0) break;
          endTimestamp = oldestTimestamp - 1;
        }

        // Sort by timestamp
        allTrades.sort((a: any, b: any) => a.timestamp - b.timestamp);

        // Send trades in chunks to avoid huge single messages
        const CHUNK = 5000;
        for (let i = 0; i < allTrades.length; i += CHUNK) {
          send({
            type: 'trades',
            offset: i,
            trades: allTrades.slice(i, i + CHUNK),
          });
        }

        send({ type: 'done', totalTrades: allTrades.length });
      } catch (error: any) {
        send({ type: 'error', message: error.message || 'Failed to fetch trades' });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
