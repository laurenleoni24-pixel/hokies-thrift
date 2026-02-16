/**
 * Cloudflare Worker for eBay API Integration
 *
 * This worker acts as a proxy between your frontend and eBay's Browse API.
 * It handles OAuth token generation, caching, and API requests while bypassing CORS restrictions.
 *
 * SETUP INSTRUCTIONS:
 * 1. Deploy this code to Cloudflare Workers
 * 2. Add environment variables in Cloudflare Dashboard:
 *    - EBAY_APP_ID: Your eBay Developer App ID (Client ID)
 *    - EBAY_CLIENT_SECRET: Your eBay Developer Cert ID (Client Secret)
 *    - ADMIN_KEY: A secret key for admin write operations
 * 3. Bind a KV namespace as "STORE" in Worker settings
 * 4. Copy your Worker URL and add it to the admin settings panel and script.js/admin.js
 */

// Token cache - stores OAuth token in memory
let tokenCache = {
  token: null,
  expiresAt: null
};

/**
 * Main request handler
 */
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Add CORS headers to allow requests from your site
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
  };

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);

    // Route: GET /listings?seller={username}&limit={n}
    if (url.pathname === '/listings' && request.method === 'GET') {
      const seller = url.searchParams.get('seller');
      const limit = url.searchParams.get('limit') || '200';

      if (!seller) {
        return jsonResponse({ error: 'Missing seller parameter' }, 400, corsHeaders);
      }

      // Get or refresh OAuth token
      const token = await getOAuthToken();

      if (!token) {
        return jsonResponse({ error: 'Failed to obtain eBay OAuth token' }, 500, corsHeaders);
      }

      // Fetch listings from eBay
      const listings = await fetchEbayListings(token, seller, limit);

      return jsonResponse(listings, 200, corsHeaders);
    }

    // Route: POST /webhook (eBay platform notifications)
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const notification = await request.json();

        // Log the notification for audit/debugging
        console.log('eBay notification received:', JSON.stringify(notification));

        // Handle account deletion notification
        if (notification.notificationEventName === 'ACCOUNT_DELETION') {
          console.log('Account deletion notification received');
          // Clear cached token if needed
          tokenCache.token = null;
          tokenCache.expiresAt = null;
        }

        // Acknowledge receipt (required by eBay)
        return jsonResponse({ status: 'received', timestamp: new Date().toISOString() }, 200);

      } catch (error) {
        console.error('Webhook error:', error);
        return jsonResponse({ error: 'Invalid notification format' }, 400);
      }
    }

    // Route: GET /health (health check endpoint)
    if (url.pathname === '/health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }, 200, corsHeaders);
    }

    // Route: GET/POST /settings — KV-backed eBay settings
    if (url.pathname === '/settings') {
      return handleKvEndpoint(request, 'ebaySettings', corsHeaders);
    }

    // Route: GET/POST /approved-items — KV-backed approved items list
    if (url.pathname === '/approved-items') {
      return handleKvEndpoint(request, 'ebayApprovedItems', corsHeaders);
    }

    // Route: GET/POST /syndicated-listings — KV-backed syndicated listings
    if (url.pathname === '/syndicated-listings') {
      return handleKvEndpoint(request, 'syndicatedListings', corsHeaders);
    }

    // Unknown route
    return jsonResponse({ error: 'Not found' }, 404, corsHeaders);

  } catch (error) {
    console.error('Worker error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

/**
 * Get OAuth token (from cache or generate new one)
 */
async function getOAuthToken() {
  // Check if cached token is still valid
  if (tokenCache.token && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt) {
    console.log('Using cached OAuth token');
    return tokenCache.token;
  }

  console.log('Generating new OAuth token');

  // Generate new token
  const appId = EBAY_APP_ID;
  const clientSecret = EBAY_CLIENT_SECRET;

  if (!appId || !clientSecret) {
    throw new Error('eBay credentials not configured. Add EBAY_APP_ID and EBAY_CLIENT_SECRET environment variables.');
  }

  // Create Basic Auth header
  const credentials = btoa(`${appId}:${clientSecret}`);

  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth token generation failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Cache token (eBay tokens last 2 hours = 7200 seconds)
  // We cache for slightly less (1 hour 50 min) to be safe
  tokenCache.token = data.access_token;
  tokenCache.expiresAt = Date.now() + (6600 * 1000); // 1h 50min

  console.log('OAuth token generated and cached');
  return tokenCache.token;
}

/**
 * Fetch listings from eBay Browse API
 */
async function fetchEbayListings(token, seller, limit) {
  // Build search URL with seller filter
  // Using a more specific search query to avoid "response too large" error
  const searchUrl = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
  searchUrl.searchParams.set('q', 'Virginia Tech'); // Search for Virginia Tech items
  searchUrl.searchParams.set('filter', `seller:${seller}`);
  searchUrl.searchParams.set('limit', limit);

  const response = await fetch(searchUrl.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay API request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Return formatted response
  return {
    total: data.total || 0,
    items: data.itemSummaries ? data.itemSummaries.map(item => ({
      itemId: item.itemId,
      title: item.title,
      price: {
        value: item.price?.value || '0',
        currency: item.price?.currency || 'USD'
      },
      condition: item.condition || 'Not specified',
      image: item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || '',
      itemWebUrl: item.itemWebUrl,
      seller: item.seller?.username || seller,
      location: item.itemLocation?.city || '',
      shippingOptions: item.shippingOptions || []
    })) : []
  };
}

/**
 * Handle GET/POST for a KV-backed endpoint
 */
async function handleKvEndpoint(request, kvKey, corsHeaders) {
  if (request.method === 'GET') {
    const value = await STORE.get(kvKey);
    return jsonResponse(value ? JSON.parse(value) : null, 200, corsHeaders);
  }

  if (request.method === 'POST') {
    // Verify admin key
    const adminKey = request.headers.get('X-Admin-Key');
    if (!adminKey || adminKey !== ADMIN_KEY) {
      return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
    }

    const body = await request.json();
    await STORE.put(kvKey, JSON.stringify(body));
    return jsonResponse({ success: true }, 200, corsHeaders);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
}

/**
 * Helper function to create JSON response with CORS headers
 */
function jsonResponse(data, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...additionalHeaders
    }
  });
}
