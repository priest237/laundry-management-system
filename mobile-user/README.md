# Washware User Mobile App

Expo React Native app for customers only. It uses the same Supabase backend as `web-admin`.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run start
```

Use Expo Go on your phone, or run the Android/iOS commands if your simulator is configured.

## Backend Communication

The app talks directly to Supabase using the public anon key. Security is controlled by Supabase Row Level Security:

- Customers read active shops and services.
- Customers create their own orders.
- Customers read and track only their own orders.
- Shop admins continue managing those orders in the web dashboard.
