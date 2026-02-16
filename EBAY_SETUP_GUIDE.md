# eBay Integration Setup Guide

Your browse page has been successfully integrated with eBay! Follow the steps below to complete the setup and start displaying your eBay listings.

## Overview

The integration replaces the multi-platform search with a direct connection to your eBay storefront. When visitors view the Browse page, they'll see your actual eBay listings, and when they click, they'll be taken to eBay with your affiliate tracking links.

## What Was Changed

### Files Modified:
1. **worker.js** (NEW) - Cloudflare Worker for eBay API proxy
2. **index.html** - Browse page UI transformed to display eBay listings
3. **script.js** - New eBay integration functions replace old search functionality
4. **admin.html** - Added eBay settings configuration panel
5. **admin.js** - Functions to save/load/test eBay settings
6. **styles.css** - eBay-specific styling for listing cards

### Key Features:
- Auto-loads your eBay listings when browse page is accessed
- 15-minute caching to reduce API calls
- Sort by price (low to high, high to low) or recent
- Manual refresh button
- Affiliate link generation with your EPN Campaign ID
- Error handling and loading states
- Mobile responsive design

---

## Setup Instructions

### Step 1: Get eBay Developer Credentials

1. Go to [eBay Developer Program](https://developer.ebay.com/)
2. Sign in or create a free account
3. Navigate to **"My Account"** → **"Application Keys"**
4. Create a **Production** keyset (NOT Sandbox)
   - Sandbox is for testing only and won't work with real listings
5. Copy and save these values:
   - **App ID (Client ID)** - looks like: `YourAppN-HokiesT-PRD-...`
   - **Cert ID (Client Secret)** - looks like: `PRD-...`

**Important:** Keep your Client Secret secure and never share it publicly.

### Step 2: Deploy Cloudflare Worker

The Cloudflare Worker acts as a secure proxy between your website and eBay's API. This is necessary because:
- eBay APIs don't allow direct browser calls (CORS restrictions)
- Keeps your API credentials secure (not exposed in browser)
- Handles OAuth token generation automatically

**Deployment Steps:**

1. Go to [Cloudflare Workers](https://workers.cloudflare.com/)
2. Sign up for a free account (if you don't have one)
3. Click **"Create Application"** → **"Create Worker"**
4. Replace the default code with the contents of `worker.js`
5. Click **"Save and Deploy"**
6. Go to **Settings** → **Variables and Secrets**
7. Add these environment variables:
   - Variable name: `EBAY_APP_ID`, Value: Your eBay App ID
   - Variable name: `EBAY_CLIENT_SECRET`, Value: Your eBay Client Secret
8. Click **"Deploy"** again
9. Copy your Worker URL (e.g., `https://ebay-proxy.your-subdomain.workers.dev`)

**Testing Your Worker:**
- Visit: `https://your-worker-url.workers.dev/health`
- You should see: `{"status":"ok","timestamp":"..."}`

### Step 3: Configure Admin Panel

1. Open `admin.html` in your browser
2. Login with credentials:
   - Username: `admin`
   - Password: `hokies2021`
3. Navigate to the **Settings** section
4. Scroll down to **"eBay Integration Settings"**
5. Fill in all fields:
   - **eBay App ID**: Paste your App ID from Step 1
   - **eBay Client Secret**: Paste your Cert ID from Step 1
   - **eBay Seller Username**: Your eBay username (e.g., `hokiesthrift_store`)
     - Find it at: https://www.ebay.com/usr/YOUR_USERNAME
   - **EPN Campaign ID**: Your eBay Partner Network Campaign ID
   - **Cloudflare Worker Proxy URL**: Your Worker URL from Step 2
6. Click **"Test Connection"**
   - If successful, you'll see: "✓ Connection successful! Found X listings..."
   - If failed, check your credentials and Worker deployment
7. Click **"Save eBay Settings"**

### Step 4: Test the Integration

1. Navigate to your main website (`index.html`)
2. Click on **"Browse"** in the navigation
3. You should see your eBay listings load automatically
4. Test features:
   - Sort listings by price or date
   - Click "Refresh Listings" button
   - Click a listing to verify it opens eBay in a new tab
   - Check that the URL includes your Campaign ID (`campid=...`)

---

## How It Works

### Data Flow

```
User visits Browse page
    ↓
Frontend calls Cloudflare Worker
    ↓
Worker generates OAuth token (cached 2 hours)
    ↓
Worker fetches listings from eBay Browse API
    ↓
Worker returns formatted JSON to frontend
    ↓
Frontend displays listings with affiliate links
    ↓
User clicks listing → Opens eBay with your affiliate tracking
```

### Caching Strategy

- **OAuth Tokens**: Cached in Worker for 1 hour 50 minutes (eBay tokens last 2 hours)
- **Listings**: Cached in browser for 15 minutes
- **Benefits**: Reduces API calls, faster page loads, stays within eBay's 5,000 calls/day limit

### Affiliate Link Format

Generated links include your EPN Campaign ID:
```
https://www.ebay.com/itm/123456789?mkevt=1&mkcid=1&mkrid=711-53200-19255-0&campid=YOUR_CAMPAIGN_ID&toolid=10001
```

- `mkevt=1` - Event tracking
- `mkcid=1` - Marketing channel (EPN)
- `mkrid=711-53200-19255-0` - US marketplace rotation ID
- `campid=YOUR_CAMPAIGN_ID` - Your unique EPN identifier
- `toolid=10001` - Tool identifier

---

## Troubleshooting

### "eBay Integration Not Configured" Error

**Problem:** Settings not saved or incomplete

**Solution:**
1. Go to admin panel → Settings
2. Fill in ALL eBay fields
3. Click "Save eBay Settings"
4. Refresh browse page

### "Connection failed" Error

**Possible causes:**

1. **Proxy not responding**
   - Check Worker URL is correct (no trailing slash needed)
   - Verify Worker is deployed and running
   - Test health endpoint: `https://your-worker-url/health`

2. **Invalid credentials**
   - Verify App ID and Client Secret are correct
   - Make sure you're using **Production** keys, not Sandbox
   - Check environment variables are set in Cloudflare

3. **CORS error**
   - Worker should handle CORS automatically
   - Check browser console for specific error messages

### "Failed to fetch listings" Error

**Possible causes:**

1. **Wrong seller username**
   - Verify your eBay seller username is correct
   - Visit: `https://www.ebay.com/usr/YOUR_USERNAME`
   - Copy the exact username from the URL

2. **No listings available**
   - Make sure you have active listings on eBay
   - Check listings are public (not private/draft)

3. **API rate limit**
   - eBay allows 5,000 calls/day
   - Caching should prevent hitting this limit
   - Wait 15 minutes for cache to expire

### Listings Not Updating

**Problem:** New eBay listings don't appear on browse page

**Solution:**
1. Click "Refresh Listings" button on browse page
2. Or wait 15 minutes for cache to expire
3. Or clear browser localStorage and reload

---

## API Limits & Costs

### eBay API
- **Cost:** FREE for production apps
- **Limit:** 5,000 calls per day
- **Your usage:** ~96 calls/day (1 call every 15 min with caching)

### Cloudflare Workers
- **Cost:** FREE tier available
- **Limit:** 100,000 requests per day (free tier)
- **Your usage:** Well within free tier limits

### eBay Partner Network
- **Cost:** FREE to join
- **Earnings:** Commission on sales (varies by category)
- **Payment:** Monthly via PayPal or direct deposit

---

## Maintenance

### Regular Tasks

1. **Monitor EPN Dashboard**
   - Check affiliate link performance
   - Track commissions earned
   - Ensure Campaign ID is active

2. **Review API Usage**
   - Cloudflare Workers dashboard shows request count
   - Should stay well under 100k/day limit

3. **Update Credentials**
   - If you regenerate eBay API keys, update:
     - Cloudflare Worker environment variables
     - Admin panel settings

### Optional Enhancements

**Future improvements you could make:**

1. **Pagination** - If you have >200 listings, implement pagination
2. **Category Filtering** - Add filter by item category
3. **Search Function** - Add keyword search within your listings
4. **Price Range Filter** - Filter by min/max price
5. **Recently Sold** - Show completed sales using eBay's Shopping API

---

## Support & Resources

### Official Documentation
- [eBay Browse API](https://developer.ebay.com/api-docs/buy/browse/overview.html)
- [eBay Partner Network](https://partnernetwork.ebay.com/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

### Need Help?
- Check browser console for error messages (F12 → Console tab)
- Review Cloudflare Worker logs for API errors
- Test connection using admin panel's "Test Connection" button

---

## Security Notes

1. **Never commit credentials to Git**
   - `.env` files should be in `.gitignore`
   - Use environment variables in Cloudflare

2. **Keep Client Secret private**
   - Only stored in Cloudflare (server-side)
   - Never exposed in browser/frontend code

3. **Validate affiliate links**
   - Always include your Campaign ID
   - Test links open correctly on eBay

---

## Summary

You've successfully integrated your eBay storefront with your browse page! Visitors will now see your actual eBay listings and you'll earn affiliate commissions when they make purchases.

**Next Steps:**
1. Complete the setup steps above
2. Test the integration thoroughly
3. Monitor your EPN dashboard for commissions
4. Enjoy the automated listing sync!

If you encounter any issues, refer to the troubleshooting section or check the browser/Worker console logs for detailed error messages.
