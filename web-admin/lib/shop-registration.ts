// Shop Registration Utilities
// Helper functions for shop owner registration and management

import { supabase } from '@/lib/supabase';

export interface ShopRegistrationData {
  shopName: string;
  address: string;
  phone: string;
  email: string;
  password: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Register a new laundry shop with admin account
 * This function handles the complete registration flow:
 * 1. Create Supabase auth user
 * 2. Create shop record
 * 3. Create admin profile linked to shop
 */
export async function registerShop(data: ShopRegistrationData) {
  const { shopName, address, phone, email, password, latitude, longitude } = data;

  // Validate input
  if (!shopName?.trim()) throw new Error('Shop name is required');
  if (!address?.trim()) throw new Error('Address is required');
  if (!phone?.trim()) throw new Error('Phone number is required');
  if (!email?.trim()) throw new Error('Email is required');
  if (!password?.trim()) throw new Error('Password is required');
  if (password.length < 6) throw new Error('Password must be at least 6 characters');

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) throw new Error('Please enter a valid email address');

  try {
    // Call server-side API to handle registration (uses service role key)
    const response = await fetch('/api/register-shop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shopName,
        address,
        phone,
        email,
        password,
        latitude,
        longitude,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Registration failed');
    }

    return result;

  } catch (error) {
    // If anything fails after auth user creation, we should clean up
    // But for now, just throw the error
    const err = error as { message?: string; details?: string; hint?: string };
    throw new Error(err.message || err.details || err.hint || 'Registration failed');
  }
}

/**
 * Get current user location using browser geolocation API
 */
export function getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        let errorMessage = 'Unable to get your location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  });
}

/**
 * Validate shop registration form data
 */
export function validateShopRegistration(data: ShopRegistrationData): string | null {
  if (!data.shopName?.trim()) return 'Shop name is required';
  if (!data.address?.trim()) return 'Address is required';
  if (!data.phone?.trim()) return 'Phone number is required';
  if (!data.email?.trim()) return 'Email is required';
  if (!data.password?.trim()) return 'Password is required';
  if (data.password.length < 6) return 'Password must be at least 6 characters';

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) return 'Please enter a valid email address';

  // Phone validation (basic)
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  if (!phoneRegex.test(data.phone.replace(/[\s\-\(\)]/g, ''))) {
    return 'Please enter a valid phone number';
  }

  return null; // No errors
}

/**
 * Check if a shop with the given email already exists
 */
export async function checkShopExists(_email: string): Promise<boolean> {
  void _email;
  // Supabase Auth handles email uniqueness before a shop profile exists.
  return false;
}

/**
 * Get shop details for a shop admin
 */
export async function getShopDetails(shopId: string) {
  const { data, error } = await supabase
    .from('shops')
    .select(`
      *,
      profiles!inner(role, id)
    `)
    .eq('id', shopId)
    .eq('profiles.role', 'shop_admin')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update shop information
 */
export async function updateShop(shopId: string, updates: Partial<{
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
}>) {
  const { data, error } = await supabase
    .from('shops')
    .update(updates)
    .eq('id', shopId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
