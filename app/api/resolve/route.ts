import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  
  if (!username) {
    return NextResponse.json({ error: 'Username required' }, { status: 400 });
  }
  
  // If already a wallet address, just fetch profile stats
  if (username.startsWith('0x') && username.length === 42) {
    return NextResponse.json({ wallet: username.toLowerCase() });
  }
  
  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
  
  try {
    const response = await fetch(
      `https://polymarket.com/profile/@${encodeURIComponent(cleanUsername)}`,
      {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        redirect: 'follow',
      }
    );
    
    const html = await response.text();
    
    if (html.includes('"page":"/404"') || html.includes('404 Page Not Found')) {
      return NextResponse.json({ 
        error: `Profile "${cleanUsername}" does not exist on Polymarket.` 
      }, { status: 404 });
    }
    
    // Extract wallet
    const walletMatch = html.match(/"proxyWallet":"(0x[a-fA-F0-9]{40})"/);
    if (!walletMatch) {
      return NextResponse.json({ error: 'Could not extract wallet from profile.' }, { status: 400 });
    }
    const wallet = walletMatch[1].toLowerCase();
    
    // Parse ALL dehydrated React Query blocks
    const blocks: Array<{data: string, key: string}> = [];
    const blockRegex = /\{"dehydratedAt":\d+,"state":\{"data":(.*?),"dataUpdateCount":\d+.*?"queryKey":(\[[^\]]+\])/g;
    let match;
    while ((match = blockRegex.exec(html)) !== null) {
      blocks.push({ data: match[1], key: match[2] });
    }
    
    let stats: any = null;
    let profile: any = null;
    let positionsValue: number | null = null;
    
    for (const block of blocks) {
      try {
        const data = JSON.parse(block.data);
        
        // Volume + P&L (can be in "user-stats" or "/api/profile/volume")
        if (block.key.includes('/api/profile/volume') && data.amount !== undefined && data.pnl !== undefined) {
          stats = { volume: data.amount, pnl: data.pnl };
        }
        if (block.key.includes('user-stats') && data.amount !== undefined && data.pnl !== undefined) {
          stats = { volume: data.amount, pnl: data.pnl };
        }
        
        // Markets traded info
        if (block.key.includes('marketsTraded')) {
          profile = {
            predictions: data.trades ?? data.traded ?? 0,
            largestWin: data.largestWin ?? 0,
            views: data.views ?? 0,
            joinDate: data.joinDate ?? '',
          };
        }
        
        // user-stats may contain trades info instead
        if (block.key.includes('user-stats') && data.trades !== undefined) {
          profile = profile || {};
          profile.predictions = profile.predictions || data.traded || data.trades || 0;
          profile.largestWin = profile.largestWin || data.largestWin || 0;
          profile.views = profile.views || data.views || 0;
          profile.joinDate = profile.joinDate || data.joinDate || '';
        }
        
        // Positions value from userData
        if (block.key.includes('userData') && typeof data === 'number') {
          positionsValue = data;
        }
        
        // Positions value (alternative)
        if (block.key.includes('"positions","value"') && typeof data === 'number') {
          positionsValue = positionsValue ?? data;
        }
      } catch (e) {
        // Some data fields aren't valid JSON objects (arrays, etc.)
        if (block.key.includes('userData') || block.key.includes('"positions","value"')) {
          const numMatch = block.data.match(/^([\d.]+)$/);
          if (numMatch) positionsValue = parseFloat(numMatch[1]);
        }
      }
    }
    
    return NextResponse.json({ wallet, stats, profile, positionsValue });
    
  } catch (error: any) {
    return NextResponse.json({ 
      error: `Failed to resolve username: ${error.message}`
    }, { status: 500 });
  }
}
