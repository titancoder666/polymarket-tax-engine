import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  
  if (!username) {
    return NextResponse.json({ error: 'Username required' }, { status: 400 });
  }
  
  // If already a wallet address, return as-is
  if (username.startsWith('0x') && username.length === 42) {
    return NextResponse.json({ wallet: username.toLowerCase() });
  }
  
  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
  
  try {
    // Fetch the profile page server-side (no CORS issues)
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
    
    // Check for 404
    if (html.includes('"page":"/404"') || html.includes('404 Page Not Found')) {
      return NextResponse.json({ 
        error: `Profile "${cleanUsername}" does not exist on Polymarket. Check for typos or use your wallet address (0x...).` 
      }, { status: 404 });
    }
    
    // Extract proxyWallet
    const walletMatch = html.match(/"proxyWallet":"(0x[a-fA-F0-9]{40})"/);
    if (walletMatch) {
      return NextResponse.json({ wallet: walletMatch[1].toLowerCase() });
    }
    
    // Fallback: proxyAddress
    const proxyMatch = html.match(/"proxyAddress":"(0x[a-fA-F0-9]{40})"/);
    if (proxyMatch) {
      return NextResponse.json({ wallet: proxyMatch[1].toLowerCase() });
    }
    
    return NextResponse.json({ 
      error: `Could not extract wallet from profile. Please enter your wallet address directly (0x...).`
    }, { status: 400 });
    
  } catch (error: any) {
    return NextResponse.json({ 
      error: `Failed to resolve username: ${error.message}`
    }, { status: 500 });
  }
}
