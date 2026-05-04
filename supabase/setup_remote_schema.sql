-- WashWare remote Supabase setup
-- Run this once in Supabase Dashboard > SQL Editor for the project used by web-admin/.env.local.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('user', 'shop_admin', 'general_admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM ('received', 'washing', 'drying', 'ironing', 'ready', 'completed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE public.payment_method AS ENUM ('cash', 'online');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.shops (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  address text NOT NULL,
  latitude double precision,
  longitude double precision,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_coordinates CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude >= -90 AND latitude <= 90 AND longitude >= -180 AND longitude <= 180)
  )
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'user',
  shop_id uuid NULL REFERENCES public.shops(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_shop_admin CHECK (
    (role = 'shop_admin' AND shop_id IS NOT NULL)
    OR (role <> 'shop_admin' AND shop_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  status public.order_status NOT NULL DEFAULT 'received',
  total_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  method public.payment_method NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  transaction_id text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pricing (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  price numeric(8,2) NOT NULL CHECK (price >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, service_type)
);

CREATE TABLE IF NOT EXISTS public.inventory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit text DEFAULT 'pieces',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, item_name)
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(8,2) NOT NULL CHECK (unit_price >= 0),
  total_price numeric(8,2) NOT NULL CHECK (total_price >= 0),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shops_location ON public.shops USING gist (point(longitude, latitude));
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON public.orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_pricing_shop_id ON public.pricing(shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_shop_id ON public.inventory(shop_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shops_updated_at ON public.shops;
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'User'),
    'user'::public.user_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, name, role)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1), 'User'),
  'user'::public.user_role
FROM auth.users
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_order_total()
RETURNS trigger AS $$
BEGIN
  UPDATE public.orders
  SET total_price = (
    SELECT COALESCE(SUM(total_price), 0)
    FROM public.order_items
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
  )
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_order_total_on_items ON public.order_items;
CREATE TRIGGER update_order_total_on_items
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_order_total();

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_shop_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.can_view_profile(profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() = profile_id
    OR public.current_user_role() = 'general_admin'::public.user_role
    OR (
      public.current_user_role() = 'shop_admin'::public.user_role
      AND EXISTS (
        SELECT 1
        FROM public.orders
        WHERE customer_id = profile_id
          AND shop_id = public.current_user_shop_id()
      )
    )
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view visible profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "General admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;

CREATE POLICY "Authenticated users can view visible profiles" ON public.profiles
  FOR SELECT USING (public.can_view_profile(id));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.current_user_role()
    AND shop_id IS NOT DISTINCT FROM public.current_user_shop_id()
  );

CREATE POLICY "General admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.current_user_role() = 'general_admin'::public.user_role)
  WITH CHECK (public.current_user_role() = 'general_admin'::public.user_role);

CREATE POLICY "Users can create own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Everyone can view shops" ON public.shops;
DROP POLICY IF EXISTS "General admins can create shops" ON public.shops;
DROP POLICY IF EXISTS "Admins can update shops" ON public.shops;
DROP POLICY IF EXISTS "General admins can delete shops" ON public.shops;

CREATE POLICY "Everyone can view shops" ON public.shops
  FOR SELECT USING (true);

CREATE POLICY "General admins can create shops" ON public.shops
  FOR INSERT WITH CHECK (public.current_user_role() = 'general_admin'::public.user_role);

CREATE POLICY "Admins can update shops" ON public.shops
  FOR UPDATE USING (
    public.current_user_role() = 'general_admin'::public.user_role
    OR (public.current_user_role() = 'shop_admin'::public.user_role AND public.current_user_shop_id() = id)
  );

CREATE POLICY "General admins can delete shops" ON public.shops
  FOR DELETE USING (public.current_user_role() = 'general_admin'::public.user_role);

DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can create orders" ON public.orders;
DROP POLICY IF EXISTS "Shop admins can view shop orders" ON public.orders;
DROP POLICY IF EXISTS "Shop admins can update shop orders" ON public.orders;
DROP POLICY IF EXISTS "General admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "General admins can update all orders" ON public.orders;

CREATE POLICY "Customers can view own orders" ON public.orders
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Shop admins can view shop orders" ON public.orders
  FOR SELECT USING (
    public.current_user_role() = 'shop_admin'::public.user_role
    AND public.current_user_shop_id() = shop_id
  );

CREATE POLICY "Shop admins can update shop orders" ON public.orders
  FOR UPDATE USING (
    public.current_user_role() = 'shop_admin'::public.user_role
    AND public.current_user_shop_id() = shop_id
  );

CREATE POLICY "General admins can view all orders" ON public.orders
  FOR SELECT USING (public.current_user_role() = 'general_admin'::public.user_role);

CREATE POLICY "General admins can update all orders" ON public.orders
  FOR UPDATE USING (public.current_user_role() = 'general_admin'::public.user_role);

DROP POLICY IF EXISTS "Customers can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Shop admins can view shop payments" ON public.payments;
DROP POLICY IF EXISTS "General admins can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Allow payment creation" ON public.payments;

CREATE POLICY "Customers can view own payments" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = payments.order_id AND orders.customer_id = auth.uid()
    )
  );

CREATE POLICY "Shop admins can view shop payments" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = payments.order_id AND orders.shop_id = public.current_user_shop_id()
    )
  );

CREATE POLICY "General admins can view all payments" ON public.payments
  FOR SELECT USING (public.current_user_role() = 'general_admin'::public.user_role);

CREATE POLICY "Allow payment creation" ON public.payments
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Everyone can view pricing" ON public.pricing;
DROP POLICY IF EXISTS "Shop admins can manage own pricing" ON public.pricing;
DROP POLICY IF EXISTS "General admins can manage all pricing" ON public.pricing;

CREATE POLICY "Everyone can view pricing" ON public.pricing
  FOR SELECT USING (true);

CREATE POLICY "Shop admins can manage own pricing" ON public.pricing
  FOR ALL USING (
    public.current_user_role() = 'shop_admin'::public.user_role
    AND public.current_user_shop_id() = shop_id
  );

CREATE POLICY "General admins can manage all pricing" ON public.pricing
  FOR ALL USING (public.current_user_role() = 'general_admin'::public.user_role);

DROP POLICY IF EXISTS "Shop admins can manage own inventory" ON public.inventory;
DROP POLICY IF EXISTS "General admins can view all inventory" ON public.inventory;

CREATE POLICY "Shop admins can manage own inventory" ON public.inventory
  FOR ALL USING (
    public.current_user_role() = 'shop_admin'::public.user_role
    AND public.current_user_shop_id() = shop_id
  );

CREATE POLICY "General admins can view all inventory" ON public.inventory
  FOR SELECT USING (public.current_user_role() = 'general_admin'::public.user_role);

DROP POLICY IF EXISTS "Customers can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Shop admins can view shop order items" ON public.order_items;
DROP POLICY IF EXISTS "General admins can view all order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow order item creation" ON public.order_items;

CREATE POLICY "Customers can view own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id AND orders.customer_id = auth.uid()
    )
  );

CREATE POLICY "Shop admins can view shop order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id AND orders.shop_id = public.current_user_shop_id()
    )
  );

CREATE POLICY "General admins can view all order items" ON public.order_items
  FOR SELECT USING (public.current_user_role() = 'general_admin'::public.user_role);

CREATE POLICY "Allow order item creation" ON public.order_items
  FOR INSERT WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
