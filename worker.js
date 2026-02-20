/**
 * Cloudflare Worker for eBay API Integration (Proxy Only)
 *
 * This worker acts as a proxy between the frontend and eBay's Browse API.
 * It handles OAuth token generation, caching, and API requests while bypassing CORS restrictions.
 *
 * All data storage has been migrated to Supabase. This worker only handles:
 * - GET /listings — eBay Browse API proxy (needs server-side OAuth)
 * - POST /create-payment-intent — Stripe payment intent creation
 * - GET /health — Health check
 * - POST /webhook — eBay platform notifications
 *
 * SETUP:
 * 1. Deploy to Cloudflare Workers
 * 2. Add environment variables:
 *    - EBAY_APP_ID: Your eBay Developer App ID (Client ID)
 *    - EBAY_CLIENT_SECRET: Your eBay Developer Cert ID (Client Secret)
 *    - STRIPE_SECRET_KEY: Your Stripe secret key (sk_live_... or sk_test_...)
 * 3. Copy your Worker URL to the admin eBay settings panel
 */

// Token cache - stores OAuth token in memory
let tokenCache = {
  token: null,
  expiresAt: null
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

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

      const token = await getOAuthToken();

      if (!token) {
        return jsonResponse({ error: 'Failed to obtain eBay OAuth token' }, 500, corsHeaders);
      }

      const listings = await fetchEbayListings(token, seller, limit);
      return jsonResponse(listings, 200, corsHeaders);
    }

    // Route: POST /create-payment-intent (Stripe)
    if (url.pathname === '/create-payment-intent' && request.method === 'POST') {
      try {
        if (typeof STRIPE_SECRET_KEY === 'undefined' || !STRIPE_SECRET_KEY) {
          return jsonResponse({ error: 'Stripe secret key not configured' }, 500, corsHeaders);
        }

        const body = await request.json();
        const amountInDollars = parseFloat(body.amount);

        if (!amountInDollars || amountInDollars <= 0) {
          return jsonResponse({ error: 'Invalid amount' }, 400, corsHeaders);
        }

        const amountInCents = Math.round(amountInDollars * 100);

        const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `amount=${amountInCents}&currency=usd&automatic_payment_methods[enabled]=true`,
        });

        if (!stripeResponse.ok) {
          const errorData = await stripeResponse.text();
          console.error('Stripe API error:', errorData);
          return jsonResponse({ error: 'Failed to create payment intent' }, 500, corsHeaders);
        }

        const paymentIntent = await stripeResponse.json();
        return jsonResponse({ clientSecret: paymentIntent.client_secret }, 200, corsHeaders);
      } catch (error) {
        console.error('Payment intent error:', error);
        return jsonResponse({ error: error.message }, 500, corsHeaders);
      }
    }

    // Route: POST /webhook (eBay platform notifications)
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const notification = await request.json();
        console.log('eBay notification received:', JSON.stringify(notification));

        if (notification.notificationEventName === 'ACCOUNT_DELETION') {
          tokenCache.token = null;
          tokenCache.expiresAt = null;
        }

        return jsonResponse({ status: 'received', timestamp: new Date().toISOString() }, 200, corsHeaders);
      } catch (error) {
        return jsonResponse({ error: 'Invalid notification format' }, 400, corsHeaders);
      }
    }

    // Route: GET /health
    if (url.pathname === '/health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }, 200, corsHeaders);
    }

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
  if (tokenCache.token && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const appId = EBAY_APP_ID;
  const clientSecret = EBAY_CLIENT_SECRET;

  if (!appId || !clientSecret) {
    throw new Error('eBay credentials not configured. Add EBAY_APP_ID and EBAY_CLIENT_SECRET environment variables.');
  }

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

  tokenCache.token = data.access_token;
  tokenCache.expiresAt = Date.now() + (6600 * 1000); // 1h 50min

  return tokenCache.token;
}

/**
 * Fetch listings from eBay Browse API
 */
async function fetchEbayListings(token, seller, limit) {
  const searchUrl = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
  searchUrl.searchParams.set('q', 'Virginia Tech');
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
