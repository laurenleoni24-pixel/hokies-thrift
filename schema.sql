-- ============================================
-- Hokies Thrift - Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. DROPS (must be created before products due to FK)
CREATE TABLE drops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','scheduled','live','completed')),
  scheduled_date TIMESTAMPTZ,
  activated_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. PRODUCTS
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) DEFAULT 0,
  cost NUMERIC(10,2) DEFAULT 0,
  category TEXT CHECK (category IN ('hoodie','jacket','tshirt','jersey','hat','other')),
  size TEXT,
  condition TEXT CHECK (condition IN ('excellent','good','fair','poor')),
  available BOOLEAN DEFAULT true,
  drop_id TEXT REFERENCES drops(id) ON DELETE SET NULL,
  submission_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PRODUCT IMAGES
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. DROP ITEMS (junction table)
CREATE TABLE drop_items (
  drop_id TEXT NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (drop_id, product_id)
);

-- 5. PROFILES (linked to auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  is_admin BOOLEAN DEFAULT false,
  can_sell BOOLEAN DEFAULT true,
  default_commission_rate NUMERIC(4,2) DEFAULT 0.60,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. ORDERS
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  shipping_street TEXT,
  shipping_apt TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_full_address TEXT,
  payment_method TEXT,
  payment_method_id TEXT,
  total NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','processing','shipped','delivered')),
  shipping_label_url TEXT,
  shipping_tracking_number TEXT,
  shipping_tracking_url TEXT,
  shipping_carrier TEXT,
  shipping_service TEXT,
  shipping_cost NUMERIC(10,2),
  shipping_transaction_id TEXT,
  shipping_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. ORDER ITEMS
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL
);

-- 8. SELLER SUBMISSIONS
CREATE TABLE seller_submissions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  item_type TEXT CHECK (item_type IN ('hoodie','jacket','tshirt','jersey','hat','other')),
  description TEXT,
  condition TEXT CHECK (condition IN ('excellent','good','fair','poor')),
  era TEXT,
  estimate TEXT,
  status TEXT DEFAULT 'pending_admin' CHECK (status IN ('pending_admin','pending_seller','approved','rejected')),
  admin_price NUMERIC(10,2),
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  seller_approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. SUBMISSION IMAGES
CREATE TABLE submission_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id TEXT NOT NULL REFERENCES seller_submissions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. SYNDICATED LISTINGS
CREATE TABLE syndicated_listings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('ebay','poshmark','mercari','depop','grailed')),
  price TEXT,
  link TEXT,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. HOKIES EVENTS
CREATE TABLE hokies_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  description TEXT,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. SETTINGS (key-value for admin config)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Helper function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE drop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndicated_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hokies_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admin full access profiles" ON profiles FOR ALL USING (is_admin());

-- PRODUCTS: public read, admin write
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Admin manage products" ON products FOR ALL USING (is_admin());

-- PRODUCT_IMAGES: public read, admin write
CREATE POLICY "Public read product images" ON product_images FOR SELECT USING (true);
CREATE POLICY "Admin manage product images" ON product_images FOR ALL USING (is_admin());

-- DROPS: public read, admin write
CREATE POLICY "Public read drops" ON drops FOR SELECT USING (true);
CREATE POLICY "Admin manage drops" ON drops FOR ALL USING (is_admin());

-- DROP_ITEMS: public read, admin write
CREATE POLICY "Public read drop items" ON drop_items FOR SELECT USING (true);
CREATE POLICY "Admin manage drop items" ON drop_items FOR ALL USING (is_admin());

-- ORDERS: users read own, anyone can insert, admin full
CREATE POLICY "Users read own orders" ON orders FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "Anyone create orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin manage orders" ON orders FOR ALL USING (is_admin());

-- ORDER_ITEMS: follows orders access
CREATE POLICY "Users read own order items" ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (orders.user_id = auth.uid() OR is_admin())));
CREATE POLICY "Anyone create order items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin manage order items" ON order_items FOR ALL USING (is_admin());

-- SELLER_SUBMISSIONS: anyone can create/read by id, admin full
CREATE POLICY "Public read submissions" ON seller_submissions FOR SELECT USING (true);
CREATE POLICY "Anyone create submissions" ON seller_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update submissions" ON seller_submissions FOR UPDATE USING (true);
CREATE POLICY "Admin manage submissions" ON seller_submissions FOR ALL USING (is_admin());

-- SUBMISSION_IMAGES: public read, anyone can insert
CREATE POLICY "Public read submission images" ON submission_images FOR SELECT USING (true);
CREATE POLICY "Anyone create submission images" ON submission_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin manage submission images" ON submission_images FOR ALL USING (is_admin());

-- SYNDICATED_LISTINGS: public read, admin write
CREATE POLICY "Public read syndicated" ON syndicated_listings FOR SELECT USING (true);
CREATE POLICY "Admin manage syndicated" ON syndicated_listings FOR ALL USING (is_admin());

-- HOKIES_EVENTS: public read, admin write
CREATE POLICY "Public read events" ON hokies_events FOR SELECT USING (true);
CREATE POLICY "Admin manage events" ON hokies_events FOR ALL USING (is_admin());

-- SETTINGS: public read, admin write
CREATE POLICY "Public read settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Admin manage settings" ON settings FOR ALL USING (is_admin());

-- ============================================
-- EVENT COLLECTIONS (Limited Edition Products)
-- ============================================

-- 13. EVENT COLLECTIONS — top-level container (date-bounded)
CREATE TABLE event_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  banner_image_url TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. EVENT PRODUCTS — products within a collection
CREATE TABLE event_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES event_collections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost NUMERIC(10,2) DEFAULT 0,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. EVENT PRODUCT SIZES — size variants with stock tracking
CREATE TABLE event_product_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_product_id UUID NOT NULL REFERENCES event_products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  sold INT NOT NULL DEFAULT 0,
  UNIQUE(event_product_id, size)
);

-- 16. EVENT PRODUCT IMAGES
CREATE TABLE event_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_product_id UUID NOT NULL REFERENCES event_products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. EVENT ORDER ITEMS — separate from order_items to avoid breaking existing orders
CREATE TABLE event_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_product_id UUID NOT NULL REFERENCES event_products(id),
  size TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL
);

-- Enable RLS on event tables
ALTER TABLE event_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_product_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_order_items ENABLE ROW LEVEL SECURITY;

-- EVENT_COLLECTIONS: public read, admin write
CREATE POLICY "Public read event collections" ON event_collections FOR SELECT USING (true);
CREATE POLICY "Admin manage event collections" ON event_collections FOR ALL USING (is_admin());

-- EVENT_PRODUCTS: public read, admin write
CREATE POLICY "Public read event products" ON event_products FOR SELECT USING (true);
CREATE POLICY "Admin manage event products" ON event_products FOR ALL USING (is_admin());

-- EVENT_PRODUCT_SIZES: public read, admin write
CREATE POLICY "Public read event product sizes" ON event_product_sizes FOR SELECT USING (true);
CREATE POLICY "Admin manage event product sizes" ON event_product_sizes FOR ALL USING (is_admin());

-- EVENT_PRODUCT_IMAGES: public read, admin write
CREATE POLICY "Public read event product images" ON event_product_images FOR SELECT USING (true);
CREATE POLICY "Admin manage event product images" ON event_product_images FOR ALL USING (is_admin());

-- EVENT_ORDER_ITEMS: follows orders access
CREATE POLICY "Users read own event order items" ON event_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = event_order_items.order_id AND (orders.user_id = auth.uid() OR is_admin())));
CREATE POLICY "Anyone create event order items" ON event_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin manage event order items" ON event_order_items FOR ALL USING (is_admin());

-- ============================================
-- STORAGE BUCKETS (run in Supabase Dashboard or via API)
-- ============================================
-- Create these buckets manually in Supabase Dashboard > Storage:
--   1. product-images (public)
--   2. submission-images (public)
--   3. event-product-images (public)
--
-- Storage policies (set in Dashboard):
--   product-images: public read, authenticated admin insert/delete
--   submission-images: public read, anyone can insert, admin delete
--   event-product-images: public read, authenticated admin insert/delete
