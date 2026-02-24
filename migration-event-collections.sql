-- ============================================
-- EVENT COLLECTIONS Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 13. EVENT COLLECTIONS — top-level container (date-bounded)
CREATE TABLE IF NOT EXISTS event_collections (
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
CREATE TABLE IF NOT EXISTS event_products (
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
CREATE TABLE IF NOT EXISTS event_product_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_product_id UUID NOT NULL REFERENCES event_products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  sold INT NOT NULL DEFAULT 0,
  UNIQUE(event_product_id, size)
);

-- 16. EVENT PRODUCT IMAGES
CREATE TABLE IF NOT EXISTS event_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_product_id UUID NOT NULL REFERENCES event_products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. EVENT ORDER ITEMS — separate from order_items
CREATE TABLE IF NOT EXISTS event_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_product_id UUID NOT NULL REFERENCES event_products(id),
  size TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL
);

-- Enable RLS
ALTER TABLE event_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_product_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public read event collections" ON event_collections FOR SELECT USING (true);
CREATE POLICY "Admin manage event collections" ON event_collections FOR ALL USING (is_admin());

CREATE POLICY "Public read event products" ON event_products FOR SELECT USING (true);
CREATE POLICY "Admin manage event products" ON event_products FOR ALL USING (is_admin());

CREATE POLICY "Public read event product sizes" ON event_product_sizes FOR SELECT USING (true);
CREATE POLICY "Admin manage event product sizes" ON event_product_sizes FOR ALL USING (is_admin());

CREATE POLICY "Public read event product images" ON event_product_images FOR SELECT USING (true);
CREATE POLICY "Admin manage event product images" ON event_product_images FOR ALL USING (is_admin());

CREATE POLICY "Users read own event order items" ON event_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = event_order_items.order_id AND (orders.user_id = auth.uid() OR is_admin())));
CREATE POLICY "Anyone create event order items" ON event_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin manage event order items" ON event_order_items FOR ALL USING (is_admin());
