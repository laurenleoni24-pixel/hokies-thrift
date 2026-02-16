# Hokies Thrift Admin Backend Guide

## Getting Started

### Accessing the Admin Panel

1. Open `admin.html` in your browser
2. Login with default credentials:
   - **Username:** `admin`
   - **Password:** `hokies2021`

## Admin Features

### 1. Dashboard Overview
- View pending and completed orders
- See total revenue and profit
- Quick access to all sections
- Active listings count

### 2. Manage Drops

**Set Countdown:**
- Set the date/time for your next drop
- The countdown automatically appears on the homepage

**Add New Items:**
- Click "Create New Drop" button
- Fill in item details:
  - Name, description, price
  - Cost (what you paid - for profit tracking)
  - Category, size, condition
  - **Upload photos** (up to 5 images)
    - Select multiple photos at once
    - Preview thumbnails appear before saving
    - Images saved directly in the system (no external hosting needed)
- Items automatically appear in the shop when marked as available

**Manage Inventory:**
- View all items
- Mark items as sold/available
- Delete items
- See profit margin for each item

### 3. Order Management

**View Orders:**
- See all customer orders
- Filter by status (pending, processing, shipped, delivered)
- View order details

**Process Orders:**
- Update order status as you fulfill them
- Generate shipping labels (simulated - will integrate with shipping APIs)
- Track customer information and shipping addresses

**Order Workflow:**
1. Customer places order → Status: **Pending**
2. You confirm order → Change to **Processing**
3. Generate shipping label → Change to **Shipped**
4. Customer receives → Change to **Delivered**

### 4. Profit Tracking

**Automatic Calculations:**
- Total Revenue (all completed sales)
- Total Costs (what you paid for items)
- Net Profit (revenue - costs)

**Sales History:**
- See every item sold
- Track profit per item
- Filter by date

### 5. Seller Submissions

**View Submissions:**
- See all items submitted through the "Sell Your Gear" form on your website
- Filter by status: new, reviewed, contacted, accepted, declined
- Dashboard shows count of new submissions

**Review Submissions:**
- Click "View" to see full details including:
  - Seller contact information
  - Item description and condition
  - Estimated payout you calculated for them
- Review item details and photos

**Process Submissions:**
- **Accept:** Mark as accepted and get reminder to contact seller
- **Decline:** Mark as declined with reminder to send polite email
- **Update Status:** Change status as you progress (new → reviewed → contacted → accepted/declined)

**Workflow:**
1. Customer submits item via "Sell Your Gear" form → Status: **New**
2. You review the submission → Change to **Reviewed**
3. You email/text the seller → Change to **Contacted**
4. Accept or decline the submission
5. If accepted, meet seller, inspect item, and add to inventory

### 6. Syndicated Listings (Browse Section)

**Add Listings:**
- Add items from eBay, Poshmark, Mercari, etc.
- Include your affiliate link
- Items appear in the Browse section on the homepage

**Manage Listings:**
- Show/hide listings
- Edit or delete listings
- Track which platforms perform best

### 7. Settings
- Store name
- Contact email
- Instagram handle

## How It Works

### Data Storage
- All data is stored in your browser's localStorage
- Data persists between sessions
- When you deploy online, you'll migrate to a real database

### Frontend ↔ Backend Connection

**Shop Page:**
- Automatically loads items from your inventory
- Only shows available items
- Updates in real-time when items are purchased
- **Image Carousel:** Items with multiple photos display as an interactive gallery
  - Customers can browse through all photos using arrow buttons
  - Dots indicate current photo
  - Smooth transitions between images

**Countdown:**
- Pulls date from admin settings
- Updates automatically when you change the drop date

**Browse Section:**
- Shows your curated syndicated listings
- Searchable and filterable

### Checkout Flow

**Customer Journey:**
1. Click "Purchase" on an item
2. Fill in shipping info and select payment method
3. Submit order
4. Receives confirmation with order number

**Your Backend:**
1. Order appears in Orders section
2. Customer info and shipping address saved
3. Item automatically marked as sold
4. Revenue and profit automatically calculated

## Next Steps for Deployment

When you're ready to deploy online, you'll need to:

1. **Database:** Replace localStorage with a real database (Firebase, MongoDB, etc.)
2. **Payment Processing:** Integrate Stripe, PayPal, or Venmo API for automatic payments
3. **Shipping Labels:** Integrate with ShipStation, EasyPost, or USPS API
4. **Email Notifications:** Send order confirmations via email
5. **Hosting:** Deploy to Netlify, Vercel, or custom hosting

## Tips

- **Add items gradually:** Start with a few items to test the system
- **Set realistic countdown:** Give yourself time to prepare drops
- **Track costs:** Always enter what you paid for items for accurate profit tracking
- **Update order status:** Keep customers informed by updating order statuses promptly
- **Curate syndicated listings:** Only add quality items you'd recommend to your followers

## Troubleshooting

**Lost login access?**
- Clear browser data or use browser console: `localStorage.removeItem('adminLoggedIn')`

**Items not showing in shop?**
- Check that items are marked as "Available" in Manage Drops
- Refresh the homepage

**Orders not appearing?**
- Check browser console for errors
- Ensure you're using the same browser for admin and frontend

## Support

For questions or issues, refer to the codebase or modify the default password in `admin.js`.
