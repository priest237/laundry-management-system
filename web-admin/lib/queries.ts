// Example queries for the Laundry Management System
// These demonstrate how to interact with the multi-shop database

import { supabase } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ========================================
// FETCHING NEARBY SHOPS
// ========================================

export async function getNearbyShops(userLat: number, userLng: number, radiusKm: number = 10) {
  // Using PostGIS for location queries (requires PostGIS extension)
  const { data, error } = await supabase.rpc('get_nearby_shops', {
    user_lat: userLat,
    user_lng: userLng,
    radius_km: radiusKm
  });

  if (error) throw error;
  return data;
}

// Alternative using basic distance calculation (less accurate but works without PostGIS)
export async function getNearbyShopsBasic(userLat: number, userLng: number, radiusKm: number = 10) {
  const { data, error } = await supabase
    .from('shops')
    .select(`
      id,
      name,
      address,
      latitude,
      longitude,
      phone,
      pricing (
        service_type,
        price
      )
    `)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (error) throw error;

  // Filter by distance on client side
  const nearbyShops = data.filter(shop => {
    const distance = calculateDistance(userLat, userLng, shop.latitude, shop.longitude);
    return distance <= radiusKm;
  });

  return nearbyShops;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ========================================
// FETCHING ORDERS BY USER
// ========================================

export async function getUserOrders(userId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      total_price,
      payment_status,
      created_at,
      shop:shops (
        id,
        name,
        address
      ),
      order_items (
        service_type,
        quantity,
        unit_price,
        total_price
      ),
      payments (
        amount,
        method,
        status,
        created_at
      )
    `)
    .eq('customer_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// ========================================
// FETCHING ORDERS BY SHOP ADMIN
// ========================================

export async function getShopOrders(shopId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      total_price,
      payment_status,
      created_at,
      customer:profiles (
        id,
        name
      ),
      order_items (
        service_type,
        quantity,
        unit_price,
        total_price
      ),
      payments (
        amount,
        method,
        status,
        created_at
      )
    `)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// ========================================
// FETCHING ALL ORDERS (GENERAL ADMIN)
// ========================================

export async function getAllOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      total_price,
      payment_status,
      created_at,
      shop:shops (
        id,
        name
      ),
      customer:profiles (
        id,
        name
      ),
      order_items (
        service_type,
        quantity,
        unit_price,
        total_price
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// ========================================
// CREATING A NEW ORDER
// ========================================

export async function createOrder(orderData: {
  shopId: string;
  customerId: string;
  items: Array<{
    serviceType: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes?: string;
}) {
  // Start a transaction-like operation
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: orderData.customerId,
      shop_id: orderData.shopId,
      notes: orderData.notes,
      // total_price will be calculated by trigger
    })
    .select()
    .single();

  if (orderError) throw orderError;

  // Insert order items
  const orderItems = orderData.items.map(item => ({
    order_id: order.id,
    service_type: item.serviceType,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_price: item.quantity * item.unitPrice
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) throw itemsError;

  return order;
}

// ========================================
// UPDATING ORDER STATUS
// ========================================

export async function updateOrderStatus(orderId: string, newStatus: string) {
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ========================================
// GETTING SHOP PRICING
// ========================================

export async function getShopPricing(shopId: string) {
  const { data, error } = await supabase
    .from('pricing')
    .select('*')
    .eq('shop_id', shopId)
    .order('service_type');

  if (error) throw error;
  return data;
}

// ========================================
// UPDATING SHOP PRICING
// ========================================

export async function updateShopPricing(shopId: string, pricing: Array<{
  serviceType: string;
  price: number;
}>) {
  // Delete existing pricing
  await supabase
    .from('pricing')
    .delete()
    .eq('shop_id', shopId);

  // Insert new pricing
  const { data, error } = await supabase
    .from('pricing')
    .insert(
      pricing.map(p => ({
        shop_id: shopId,
        service_type: p.serviceType,
        price: p.price
      }))
    )
    .select();

  if (error) throw error;
  return data;
}

// ========================================
// GETTING SHOP INVENTORY
// ========================================

export async function getShopInventory(shopId: string) {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('shop_id', shopId)
    .order('item_name');

  if (error) throw error;
  return data;
}

// ========================================
// REAL-TIME SUBSCRIPTION FOR ORDERS
// ========================================

export function subscribeToOrderUpdates(userId: string, callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void) {
  return supabase
    .channel('orders')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `customer_id=eq.${userId}`
      },
      callback
    )
    .subscribe();
}

export function subscribeToShopOrderUpdates(shopId: string, callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void) {
  return supabase
    .channel('shop_orders')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `shop_id=eq.${shopId}`
      },
      callback
    )
    .subscribe();
}

// ========================================
// DASHBOARD STATISTICS
// ========================================

export async function getUserDashboardStats(userId: string) {
  // Get user's orders statistics
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, status, total_price, created_at')
    .eq('customer_id', userId);

  if (ordersError) throw ordersError;

  const stats = {
    totalOrders: orders.length,
    totalSpent: orders.reduce((sum, order) => sum + parseFloat(order.total_price), 0),
    pendingOrders: orders.filter(o => o.status === 'received' || o.status === 'washing').length,
    completedOrders: orders.filter(o => o.status === 'completed').length,
    recentOrders: orders
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
  };

  return stats;
}

export async function getShopDashboardStats(shopId: string) {
  // Get shop's orders statistics
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('status, total_price, created_at')
    .eq('shop_id', shopId);

  if (ordersError) throw ordersError;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter(o => new Date(o.created_at) >= today);

  const stats = {
    totalOrders: orders.length,
    todayOrders: todayOrders.length,
    todayRevenue: todayOrders.reduce((sum, order) => sum + parseFloat(order.total_price), 0),
    pendingOrders: orders.filter(o => o.status !== 'completed').length,
    completedOrders: orders.filter(o => o.status === 'completed').length,
    totalRevenue: orders.reduce((sum, order) => sum + parseFloat(order.total_price), 0)
  };

  return stats;
}

// ========================================
// USER MANAGEMENT (ADMIN ONLY)
// ========================================

export async function updateUserRole(userId: string, newRole: string, shopId?: string) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      role: newRole,
      shop_id: shopId,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      name,
      role,
      shop_id,
      created_at,
      shop:shops (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
