# Laundry Management System - Multi-Shop Upgrade

## Overview
This upgrade transforms the single-shop laundry system into a multi-shop marketplace with role-based access control, supporting customers, shop administrators, and general administrators.

## Database Schema

### Core Tables

#### 1. Profiles Table
- **Purpose**: Extended user information linked to Supabase auth
- **Key Fields**: id (UUID, FK to auth.users), name, role, shop_id
- **Roles**: user, shop_admin, general_admin

#### 2. Shops Table
- **Purpose**: Laundry shop information
- **Key Fields**: id, name, address, coordinates, phone

#### 3. Orders Table
- **Purpose**: Laundry orders (multi-shop support)
- **Key Fields**: customer_id, shop_id, status, total_price, payment_status

#### 4. Order Items Table
- **Purpose**: Detailed breakdown of order contents
- **Key Fields**: order_id, service_type, quantity, pricing

#### 5. Payments Table
- **Purpose**: Payment tracking
- **Key Fields**: order_id, amount, method, status

#### 6. Pricing Table
- **Purpose**: Per-shop service pricing
- **Key Fields**: shop_id, service_type, price

#### 7. Inventory Table
- **Purpose**: Per-shop inventory management
- **Key Fields**: shop_id, item_name, quantity

## Authentication System

### Features
- **Email/Password Authentication**: Standard Supabase auth
- **Phone OTP Authentication**: SMS-based login
- **Automatic Profile Creation**: Trigger creates profile on user signup
- **Role-Based Access**: Different permissions per user role

### Authentication Flow
1. User signs up (email/password or phone OTP)
2. Supabase Auth creates user record
3. Database trigger creates profile with default 'user' role
4. Admin can later assign shop_admin or general_admin roles

## Security (RLS Policies)

### Profiles Policies
- Users can view/edit their own profile
- General admins can manage all profiles
- Shop admins can view customer profiles from their shop

### Orders Policies
- Customers see only their orders
- Shop admins see only orders from their shop
- General admins see all orders

### Shops Policies
- Everyone can browse shops (marketplace)
- General admins can create/manage shops
- Shop admins can update their own shop

## Setup Instructions

### 1. Apply Database Migration
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Start local Supabase (if not running)
supabase start

# Apply the migration
supabase db reset
```

### 2. Enable Phone Authentication
In your Supabase dashboard:
1. Go to Authentication > Providers
2. Enable "Phone" provider
3. Configure SMS settings (Twilio recommended)

### 3. Environment Variables
Ensure your `.env.local` has:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Test the System
1. Register a new user (email or phone)
2. Login and verify profile creation
3. Create some shops (as general admin)
4. Assign shop_admin role to users
5. Test order creation and management

## API Examples

### Fetch Nearby Shops
```typescript
import { getNearbyShopsBasic } from '@/lib/queries';

// Get shops within 10km
const shops = await getNearbyShopsBasic(userLat, userLng, 10);
```

### Create Order
```typescript
import { createOrder } from '@/lib/queries';

const order = await createOrder({
  shopId: 'shop-uuid',
  customerId: 'user-uuid',
  items: [
    { serviceType: 'wash_fold', quantity: 5, unitPrice: 2.50 }
  ]
});
```

### Real-time Updates
```typescript
import { subscribeToOrderUpdates } from '@/lib/queries';

// Subscribe to order status changes
const subscription = subscribeToOrderUpdates(userId, (payload) => {
  console.log('Order updated:', payload);
});
```

## Role-Based Features

### Customer (user)
- Browse nearby shops
- Place orders
- Track order status
- View order history
- Make payments

### Shop Admin (shop_admin)
- Manage assigned shop
- View orders for their shop
- Update order status
- Manage pricing
- Manage inventory
- View shop analytics

### General Admin (general_admin)
- Manage all users and roles
- Create/manage shops
- View all orders and analytics
- System-wide settings

## Real-time Features
- Order status updates
- New order notifications
- Shop availability updates

## Next Steps
1. Implement shop creation UI
2. Build order placement flow
3. Add payment integration
4. Create admin management interfaces
5. Add location services for shop discovery
6. Implement push notifications

## File Structure
```
supabase/
  migrations/
    20240319000000_multi_shop_upgrade.sql  # Database schema

web-admin/
  lib/
    auth-context.tsx      # Enhanced auth with phone support
    queries.ts           # Database query examples
  app/
    register/page.tsx    # Updated with phone auth
    login/page.tsx       # Updated with phone auth
    dashboard/page.tsx   # Role-based dashboard
```

This upgrade provides a solid foundation for a multi-shop laundry marketplace with proper security, role management, and scalability.