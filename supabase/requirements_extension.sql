-- WashWare functional requirements extension
-- Run after supabase/setup_remote_schema.sql.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'customer';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'staff';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'delivery_agent';

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'credit_card';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'digital_wallet';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS loyalty_points integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active', 'suspended', 'deactivated'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS delivery_agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pickup_time timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_time timestamptz,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount numeric(10,2) GENERATED ALWAYS AS (total_price - discount_amount + tax_amount) STORED;

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS shop_status text NOT NULL DEFAULT 'approved';

ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_status_check;
ALTER TABLE public.shops
  ADD CONSTRAINT shops_status_check
  CHECK (shop_status IN ('pending', 'approved', 'suspended'));

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1000;

CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number = 'WW-' || to_char(now(), 'YYYYMMDD') || '-' || nextval('public.order_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_order_number_on_insert ON public.orders;
CREATE TRIGGER set_order_number_on_insert
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

CREATE TABLE IF NOT EXISTS public.service_types (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  pricing_unit text NOT NULL DEFAULT 'item',
  price numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT service_pricing_unit_check CHECK (pricing_unit IN ('item', 'kg'))
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'fixed',
  discount_value numeric(10,2) NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT coupons_discount_type_check CHECK (discount_type IN ('fixed', 'percent'))
);

CREATE TABLE IF NOT EXISTS public.tax_rates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  rate_percent numeric(6,3) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  delivery_agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  pickup_address text,
  delivery_address text,
  scheduled_pickup_at timestamptz,
  scheduled_delivery_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  route_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT delivery_status_check CHECK (status IN ('scheduled', 'assigned', 'picked_up', 'out_for_delivery', 'delivered', 'failed'))
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel text NOT NULL,
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  related_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT notifications_channel_check CHECK (channel IN ('sms', 'email', 'push')),
  CONSTRAINT notifications_status_check CHECK (status IN ('queued', 'sent', 'failed'))
);

CREATE TABLE IF NOT EXISTS public.inventory_usage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  quantity_used integer NOT NULL CHECK (quantity_used > 0),
  used_at timestamptz DEFAULT now()
);

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

CREATE TABLE IF NOT EXISTS public.machine_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  machine_name text NOT NULL,
  status text NOT NULL DEFAULT 'idle',
  cycle_count integer NOT NULL DEFAULT 0,
  runtime_minutes integer NOT NULL DEFAULT 0,
  fault_message text,
  logged_at timestamptz DEFAULT now(),
  CONSTRAINT machine_status_check CHECK (status IN ('idle', 'running', 'maintenance', 'fault'))
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.system_settings (key, value, description)
VALUES
  ('customer_ordering_enabled', 'true', 'Allow customers to place orders from the app.'),
  ('online_payments_enabled', 'false', 'Show online payment as an available payment method.'),
  ('notifications_enabled', 'true', 'Queue email, SMS, or push notifications for order updates.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE VIEW public.daily_revenue AS
SELECT
  o.shop_id,
  date_trunc('day', o.created_at)::date AS report_date,
  count(*) AS order_count,
  sum(o.final_amount) AS revenue
FROM public.orders o
WHERE o.payment_status = 'completed'
GROUP BY o.shop_id, date_trunc('day', o.created_at)::date;

ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin_or_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role()::text IN ('general_admin', 'shop_admin', 'admin', 'staff')
$$;

DROP POLICY IF EXISTS "Admin staff can manage service types" ON public.service_types;
CREATE POLICY "Admin staff can manage service types" ON public.service_types
  FOR ALL USING (public.is_admin_or_staff()) WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Customers can view active service types" ON public.service_types;
CREATE POLICY "Customers can view active service types" ON public.service_types
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admin staff can manage coupons" ON public.coupons;
CREATE POLICY "Admin staff can manage coupons" ON public.coupons
  FOR ALL USING (public.is_admin_or_staff()) WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admin staff can manage tax rates" ON public.tax_rates;
CREATE POLICY "Admin staff can manage tax rates" ON public.tax_rates
  FOR ALL USING (public.is_admin_or_staff()) WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Delivery visibility" ON public.delivery_assignments;
CREATE POLICY "Delivery visibility" ON public.delivery_assignments
  FOR SELECT USING (
    public.is_admin_or_staff()
    OR delivery_agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = delivery_assignments.order_id
        AND orders.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin staff can manage delivery" ON public.delivery_assignments;
CREATE POLICY "Admin staff can manage delivery" ON public.delivery_assignments
  FOR ALL USING (public.is_admin_or_staff()) WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admin staff can manage notifications" ON public.notifications;
CREATE POLICY "Admin staff can manage notifications" ON public.notifications
  FOR ALL USING (public.is_admin_or_staff()) WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admin staff can manage inventory usage" ON public.inventory_usage;
CREATE POLICY "Admin staff can manage inventory usage" ON public.inventory_usage
  FOR ALL USING (public.is_admin_or_staff()) WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admin staff can manage machine logs" ON public.machine_logs;
CREATE POLICY "Admin staff can manage machine logs" ON public.machine_logs
  FOR ALL USING (public.is_admin_or_staff()) WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Admin staff can view settings" ON public.system_settings;
CREATE POLICY "Admin staff can view settings" ON public.system_settings
  FOR SELECT USING (public.current_user_role()::text IN ('general_admin', 'admin'));

DROP POLICY IF EXISTS "System owners can manage settings" ON public.system_settings;
CREATE POLICY "System owners can manage settings" ON public.system_settings
  FOR ALL USING (public.current_user_role()::text IN ('general_admin', 'admin'))
  WITH CHECK (public.current_user_role()::text IN ('general_admin', 'admin'));

DROP POLICY IF EXISTS "Admins can manage shops extension" ON public.shops;
CREATE POLICY "Admins can manage shops extension" ON public.shops
  FOR ALL USING (public.current_user_role()::text IN ('general_admin', 'admin'))
  WITH CHECK (public.current_user_role()::text IN ('general_admin', 'admin'));

DROP POLICY IF EXISTS "Admin staff can update payments" ON public.payments;
DROP POLICY IF EXISTS "Admin staff can view payments extension" ON public.payments;
CREATE POLICY "Admin staff can view payments extension" ON public.payments
  FOR SELECT USING (
    public.current_user_role()::text IN ('general_admin', 'admin', 'staff')
    OR (
      public.current_user_role()::text = 'shop_admin'
      AND EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = payments.order_id
          AND orders.shop_id = public.current_user_shop_id()
      )
    )
  );

CREATE POLICY "Admin staff can update payments" ON public.payments
  FOR UPDATE USING (
    public.current_user_role()::text IN ('general_admin', 'admin', 'staff')
    OR (
      public.current_user_role()::text = 'shop_admin'
      AND EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = payments.order_id
          AND orders.shop_id = public.current_user_shop_id()
      )
    )
  )
  WITH CHECK (
    public.current_user_role()::text IN ('general_admin', 'admin', 'staff')
    OR (
      public.current_user_role()::text = 'shop_admin'
      AND EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = payments.order_id
          AND orders.shop_id = public.current_user_shop_id()
      )
    )
  );

DROP POLICY IF EXISTS "Admin staff can update orders extension" ON public.orders;
DROP POLICY IF EXISTS "Admin staff can view orders extension" ON public.orders;
CREATE POLICY "Admin staff can view orders extension" ON public.orders
  FOR SELECT USING (
    public.current_user_role()::text IN ('general_admin', 'admin', 'staff')
    OR (public.current_user_role()::text = 'shop_admin' AND public.current_user_shop_id() = shop_id)
  );

DROP POLICY IF EXISTS "Admin staff can create orders extension" ON public.orders;
CREATE POLICY "Admin staff can create orders extension" ON public.orders
  FOR INSERT WITH CHECK (
    public.current_user_role()::text IN ('general_admin', 'admin', 'staff')
    OR (public.current_user_role()::text = 'shop_admin' AND public.current_user_shop_id() = shop_id)
  );

CREATE POLICY "Admin staff can update orders extension" ON public.orders
  FOR UPDATE USING (
    public.current_user_role()::text IN ('general_admin', 'admin', 'staff')
    OR (public.current_user_role()::text = 'shop_admin' AND public.current_user_shop_id() = shop_id)
  )
  WITH CHECK (
    public.current_user_role()::text IN ('general_admin', 'admin', 'staff')
    OR (public.current_user_role()::text = 'shop_admin' AND public.current_user_shop_id() = shop_id)
  );

DROP POLICY IF EXISTS "Admin staff can view profiles extension" ON public.profiles;
CREATE POLICY "Admin staff can view profiles extension" ON public.profiles
  FOR SELECT USING (
    public.current_user_role()::text IN ('general_admin', 'admin', 'staff')
    OR (
      public.current_user_role()::text = 'shop_admin'
      AND (
        shop_id = public.current_user_shop_id()
        OR EXISTS (
          SELECT 1 FROM public.orders
          WHERE orders.customer_id = profiles.id
            AND orders.shop_id = public.current_user_shop_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS "System owners can update profiles extension" ON public.profiles;
CREATE POLICY "System owners can update profiles extension" ON public.profiles
  FOR UPDATE USING (public.current_user_role()::text IN ('general_admin', 'admin'))
  WITH CHECK (public.current_user_role()::text IN ('general_admin', 'admin'));

NOTIFY pgrst, 'reload schema';

-- Default CFA services used by the web and mobile ordering forms.
INSERT INTO public.service_types (shop_id, name, pricing_unit, price, is_active)
VALUES
  (NULL, 'Wash and Fold', 'kg', 800, true),
  (NULL, 'Wash and Iron', 'kg', 1200, true),
  (NULL, 'Dry Cleaning', 'item', 2500, true),
  (NULL, 'Ironing Only', 'item', 500, true),
  (NULL, 'Bedding and Duvets', 'item', 3500, true),
  (NULL, 'Express Service', 'kg', 1800, true)
ON CONFLICT DO NOTHING;
