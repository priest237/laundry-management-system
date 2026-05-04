-- Fix recursive profiles RLS policies.
-- Policies on profiles must not query profiles directly, or Supabase/Postgres can
-- reject even simple "select my own profile" requests with infinite recursion.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
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
    OR public.current_user_role() = 'general_admin'::user_role
    OR (
      public.current_user_role() = 'shop_admin'::user_role
      AND EXISTS (
        SELECT 1
        FROM public.orders
        WHERE customer_id = profile_id
          AND shop_id = public.current_user_shop_id()
      )
    )
$$;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "General admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "General admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Shop admins can view customer profiles" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;

CREATE POLICY "Authenticated users can view visible profiles" ON profiles
  FOR SELECT
  USING (public.can_view_profile(id));

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.current_user_role()
    AND shop_id IS NOT DISTINCT FROM public.current_user_shop_id()
  );

CREATE POLICY "General admins can update all profiles" ON profiles
  FOR UPDATE
  USING (public.current_user_role() = 'general_admin'::user_role)
  WITH CHECK (public.current_user_role() = 'general_admin'::user_role);

CREATE POLICY "Users can create own profile" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow profile creation during shop registration (before email verification)
-- This checks that the profile ID exists in auth.users table
CREATE POLICY "Service can insert profiles" ON profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users WHERE id = profiles.id)
  );

-- Allow shop creation during registration (any authenticated or newly created user)
CREATE POLICY "Authenticated users can create shops" ON shops
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL OR 
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );
