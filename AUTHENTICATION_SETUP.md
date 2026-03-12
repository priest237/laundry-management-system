# Authentication Setup Guide

## ✅ Completed Setup

### 1. **Supabase Client** (`lib/supabase.ts`)
- Initializes Supabase client with environment variables
- Used across all authentication pages

### 2. **Authentication Context** (`lib/auth-context.tsx`)
- Manages global authentication state
- Tracks user sessions
- Provides `useAuth()` hook for components
- Listens for real-time authentication changes

### 3. **Protected Routes** (`lib/protected-route.tsx`)
- Wrapper component to protect pages from unauthorized access
- Redirects unauthenticated users to login
- Shows loading state while checking authentication

### 4. **Authentication Pages**

#### Register Page (`app/register/page.tsx`)
- ✅ Form validation
- ✅ Supabase Auth signup integration
- ✅ Error handling with user feedback
- ✅ Loading states
- ✅ Stores full name in user metadata
- ✅ Redirects to login on success

#### Login Page (`app/login/page.tsx`)
- ✅ Form validation
- ✅ Supabase Auth signin integration
- ✅ Error handling with user feedback
- ✅ Loading states
- ✅ Redirects to dashboard on success
- ✅ Links to forgot password

#### Forgot Password Page (`app/forgot-password/page.tsx`)
- ✅ Email validation
- ✅ Supabase password reset integration
- ✅ Success/error feedback
- ✅ Sends reset link to user email
- ✅ Redirects to reset-password page

### 5. **Dashboard Page** (`app/dashboard/page.tsx`)
- ✅ Protected with ProtectedRoute wrapper
- ✅ Shows user email in sidebar
- ✅ Logout functionality
- ✅ Session-based access control

### 6. **Root Layout** (`app/layout.tsx`)
- ✅ AuthProvider wraps entire app
- ✅ Updated metadata for WASHWARE branding

---

## 🔐 Authentication Flow

```
User Registration
├─ Fill form (name, email, password)
├─ Submit → handleRegister()
├─ Create account in Supabase Auth
├─ Store full_name in user metadata
└─ Redirect to /login

User Login
├─ Fill form (email, password)
├─ Submit → handleLogin()
├─ Authenticate with Supabase Auth
├─ Session stored automatically
└─ Redirect to /dashboard

Dashboard Access
├─ ProtectedRoute checks session
├─ If no user → redirect to /login
├─ If user → show dashboard
└─ Displays user.email in sidebar

User Logout
├─ Click logout button
├─ Call signOut()
├─ Clear session
└─ Redirect to /login

Password Reset
├─ Enter email on /forgot-password
├─ Send reset link via Supabase
├─ User clicks link in email
└─ Redirect to reset-password page
```

---

## 📋 Testing Checklist

### Register New User
- [ ] Navigate to `/register`
- [ ] Fill in: Full name, email, password
- [ ] Click "Create Account"
- [ ] Should redirect to login page
- [ ] Check Supabase Auth dashboard for new user

### Login
- [ ] Navigate to `/login`
- [ ] Enter registered email and password
- [ ] Click "Login"
- [ ] Should redirect to dashboard
- [ ] Dashboard shows user email in sidebar

### Protected Routes
- [ ] Without logging in, try to access `/dashboard`
- [ ] Should redirect to `/login`

### Logout
- [ ] From dashboard, click "Logout"
- [ ] Should redirect to login
- [ ] Session should be cleared

### Error Handling
- [ ] Try registering with invalid email
- [ ] Try registering with existing email
- [ ] Try logging in with wrong password
- [ ] Try login without filling form
- [ ] All should show error messages

### Password Reset
- [ ] Click "Forgot your password?" on login
- [ ] Enter email and submit
- [ ] Should show success message
- [ ] Check email for reset link

---

## 🔧 Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL=https://nkwcgolzugdqpkzajogq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_wE4SKOfqbpx6-paNtUQLVQ_61PeUKx5
SUPABASE_SERVICE_ROLE_KEY=sb_secret_4g3T8Zvv8D5AuWxwghH2dw_LR_9Cdew
DATABASE_URL=postgresql://postgres:[aY5Cvx+%,S*.JQe]@db.nkwcgolzugdqpkzajogq.supabase.co:5432/postgres
```

✅ Already configured in `.env.local`

---

## 📡 Supabase Configuration

### Required Settings in Supabase Project:

1. **Authentication → Providers**
   - Enable "Email" provider
   - Disable other providers if not needed

2. **Authentication → Email Templates**
   - Confirm signup email enabled
   - Password reset email enabled

3. **Authentication → URL Configuration**
   - Redirect URLs:
     - `http://localhost:3000/dashboard` (development)
     - `http://localhost:3000/login` (development)
     - Your production domain

4. **Database → Tables (Optional)**
   - Create `profiles` table to extend user data
   - Link to `auth.users` via UUID

---

## 🎯 What Happens Behind the Scenes

### User Registration
1. User submits form with name, email, password
2. `supabase.auth.signUp()` creates auth user
3. User metadata includes `full_name`
4. Confirmation email sent (if enabled)
5. Redirects to login

### User Login
1. User submits form with email, password
2. `supabase.auth.signInWithPassword()` authenticates
3. Session token stored in browser
4. `AuthProvider` updates user state
5. `useAuth()` hook notifies components
6. Redirects to dashboard

### Session Management
1. `AuthProvider` checks session on app load
2. Listens to `onAuthStateChange` event
3. Updates user state automatically
4. Components use `useAuth()` to access user

### Protected Routes
1. `ProtectedRoute` checks if user exists
2. If no user and not loading → redirect to login
3. If user exists → render page
4. If loading → show loading spinner

---

## 🚀 Next Steps

1. Test all authentication flows
2. Monitor Supabase Auth events in dashboard
3. Set up email templates for better UX
4. Create reset-password page for password update
5. Add user profile page to update account info
6. Consider adding social login (Google, GitHub, etc.)

---

## 📞 Support

If authentication fails:
1. Check `.env.local` for correct environment variables
2. Verify Supabase project URL and keys
3. Check browser console for error messages
4. Review Supabase Auth logs in dashboard
5. Ensure email provider is enabled in Supabase
