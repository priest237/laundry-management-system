-- Migration: Multi-shop Laundry Management System
-- Date: 2026-03-19
-- Description: Upgrade from single-shop to multi-shop marketplace system

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('user', 'shop_admin', 'general_admin');
CREATE TYPE order_status AS ENUM ('received', 'washing', 'drying', 'ironing', 'ready', 'completed');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE payment_method AS ENUM ('cash', 'online');

-- Profiles table (linked to auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    shop_id UUID NULL, -- Only required for shop_admin role
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_shop_admin CHECK (
        (role = 'shop_admin' AND shop_id IS NOT NULL) OR
        (role != 'shop_admin' AND shop_id IS NULL)
    )
);

-- Shops table
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes for location-based queries
    CONSTRAINT valid_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude >= -90 AND latitude <= 90 AND longitude >= -180 AND longitude <= 180)
    )
);

-- Create index for location queries
CREATE INDEX idx_shops_location ON shops USING gist (point(longitude, latitude));

-- Orders table (multi-shop support)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    status order_status NOT NULL DEFAULT 'received',
    total_price NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
    payment_status payment_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    transaction_id TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pricing table (per shop)
CREATE TABLE pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    price NUMERIC(8,2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint per shop and service type
    UNIQUE(shop_id, service_type)
);

-- Inventory table (per shop)
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit TEXT DEFAULT 'pieces',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint per shop and item
    UNIQUE(shop_id, item_name)
);

-- Order items table (for detailed order breakdown)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(8,2) NOT NULL CHECK (unit_price >= 0),
    total_price NUMERIC(8,2) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_shop_id ON orders(shop_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);

CREATE INDEX idx_pricing_shop_id ON pricing(shop_id);
CREATE INDEX idx_inventory_shop_id ON inventory(shop_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create profile if one doesn't already exist (for manual profile creation)
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
        INSERT INTO public.profiles (id, name, role)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Unknown User'),
            'user'::user_role
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update order total when items change
CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the order's total_price based on order_items
    UPDATE orders
    SET total_price = (
        SELECT COALESCE(SUM(total_price), 0)
        FROM order_items
        WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
    )
    WHERE id = COALESCE(NEW.order_id, OLD.order_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for order total updates
CREATE TRIGGER update_order_total_on_items
    AFTER INSERT OR UPDATE OR DELETE ON order_items
    FOR EACH ROW EXECUTE FUNCTION update_order_total();

-- ========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (except role and shop_id)
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND
        role = (SELECT role FROM profiles WHERE id = auth.uid()) AND
        shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid())
    );

-- General admins can read all profiles
CREATE POLICY "General admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'general_admin'
        )
    );

-- General admins can update all profiles (including roles)
CREATE POLICY "General admins can update all profiles" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'general_admin'
        )
    );

-- Shop admins can read profiles of customers who ordered from their shop
CREATE POLICY "Shop admins can view customer profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role = 'shop_admin' AND p.shop_id = profiles.id
        ) OR
        EXISTS (
            SELECT 1 FROM orders o
            JOIN profiles p ON p.id = auth.uid() AND p.role = 'shop_admin'
            WHERE o.customer_id = profiles.id AND o.shop_id = p.shop_id
        )
    );

-- Allow profile creation during signup (handled by trigger)
CREATE POLICY "Allow profile creation" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- SHOPS POLICIES
-- Everyone can read shops (for browsing marketplace)
CREATE POLICY "Everyone can view shops" ON shops
    FOR SELECT USING (true);

-- Only general admins can create shops
CREATE POLICY "General admins can create shops" ON shops
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'general_admin'
        )
    );

-- General admins and shop admins can update their own shops
CREATE POLICY "Admins can update shops" ON shops
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'general_admin'
        ) OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'shop_admin' AND shop_id = shops.id
        )
    );

-- Only general admins can delete shops
CREATE POLICY "General admins can delete shops" ON shops
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'general_admin'
        )
    );

-- ORDERS POLICIES
-- Customers can view their own orders
CREATE POLICY "Customers can view own orders" ON orders
    FOR SELECT USING (auth.uid() = customer_id);

-- Customers can create orders
CREATE POLICY "Customers can create orders" ON orders
    FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Customers can update their own orders (limited fields)
CREATE POLICY "Customers can update own orders" ON orders
    FOR UPDATE USING (auth.uid() = customer_id)
    WITH CHECK (
        auth.uid() = customer_id AND
        shop_id = (SELECT shop_id FROM orders WHERE id = orders.id) AND
        customer_id = (SELECT customer_id FROM orders WHERE id = orders.id)
    );

-- Shop admins can view orders from their shop
CREATE POLICY "Shop admins can view shop orders" ON orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'shop_admin' AND shop_id = orders.shop_id
        )
    );

-- Shop admins can update orders from their shop
CREATE POLICY "Shop admins can update shop orders" ON orders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'shop_admin' AND shop_id = orders.shop_id
        )
    );

-- General admins can view all orders
CREATE POLICY "General admins can view all orders" ON orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'general_admin'
        )
    );

-- General admins can update all orders
CREATE POLICY "General admins can update all orders" ON orders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'general_admin'
        )
    );

-- PAYMENTS POLICIES
-- Customers can view payments for their orders
CREATE POLICY "Customers can view own payments" ON payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = payments.order_id AND orders.customer_id = auth.uid()
        )
    );

-- Shop admins can view payments for their shop's orders
CREATE POLICY "Shop admins can view shop payments" ON payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders o
            JOIN profiles p ON p.id = auth.uid() AND p.role = 'shop_admin'
            WHERE o.id = payments.order_id AND o.shop_id = p.shop_id
        )
    );

-- General admins can view all payments
CREATE POLICY "General admins can view all payments" ON payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'general_admin'
        )
    );

-- Allow payment creation (will be handled by application logic)
CREATE POLICY "Allow payment creation" ON payments
    FOR INSERT WITH CHECK (true);

-- PRICING POLICIES
-- Everyone can read pricing (for customers to see shop prices)
CREATE POLICY "Everyone can view pricing" ON pricing
    FOR SELECT USING (true);

-- Shop admins can manage pricing for their shop
CREATE POLICY "Shop admins can manage own pricing" ON pricing
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'shop_admin' AND shop_id = pricing.shop_id
        )
    );

-- General admins can manage all pricing
CREATE POLICY "General admins can manage all pricing" ON pricing
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'general_admin'
        )
    );

-- INVENTORY POLICIES
-- Shop admins can manage inventory for their shop
CREATE POLICY "Shop admins can manage own inventory" ON inventory
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'shop_admin' AND shop_id = inventory.shop_id
        )
    );

-- General admins can view all inventory
CREATE POLICY "General admins can view all inventory" ON inventory
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'general_admin'
        )
    );

-- ORDER ITEMS POLICIES
-- Customers can view items from their orders
CREATE POLICY "Customers can view own order items" ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id AND orders.customer_id = auth.uid()
        )
    );

-- Shop admins can view items from their shop's orders
CREATE POLICY "Shop admins can view shop order items" ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders o
            JOIN profiles p ON p.id = auth.uid() AND p.role = 'shop_admin'
            WHERE o.id = order_items.order_id AND o.shop_id = p.shop_id
        )
    );

-- General admins can view all order items
CREATE POLICY "General admins can view all order items" ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'general_admin'
        )
    );

-- Allow order item creation (handled by application)
CREATE POLICY "Allow order item creation" ON order_items
    FOR INSERT WITH CHECK (true);