# Shop Registration Feature

## Overview
This feature allows laundry shop owners to register their businesses directly through the website, creating both a Supabase Auth account and linking it to their shop profile.

## Features Implemented

### 1. Landing Page Update
- Added a call-to-action section at the bottom of the homepage
- "Own a Laundry Shop? Join Our Platform" section with registration button
- Modern, responsive design matching the existing UI

### 2. Shop Registration Page (`/register-shop`)
- Comprehensive form with validation
- Shop information: name, address, phone
- Account creation: email, password
- Optional location coordinates (manual entry or GPS detection)
- Loading states and error handling
- Success confirmation with auto-redirect

### 3. Authentication Integration
- Creates Supabase Auth user account
- Automatically creates shop record in database
- Links admin profile to shop with `shop_admin` role
- Handles database transactions properly

### 4. Utility Functions (`lib/shop-registration.ts`)
- `registerShop()`: Complete registration flow
- `getCurrentLocation()`: GPS location detection
- `validateShopRegistration()`: Form validation
- Additional helper functions for shop management

## Database Flow

### Registration Process
1. **User submits form** → Client-side validation
2. **Create Auth User** → Supabase Auth signup
3. **Create Shop Record** → Insert into `shops` table
4. **Create Admin Profile** → Insert into `profiles` table with `shop_admin` role
5. **Link Profile to Shop** → Set `shop_id` in profile
6. **Success Response** → Redirect to dashboard

### Database Changes
- Shop record created with all provided information
- Profile created with `role: 'shop_admin'` and linked to shop
- Auth user created with email/password authentication

## Usage

### For Shop Owners
1. Visit the homepage
2. Click "Register Your Shop" button
3. Fill out the registration form
4. Optionally use GPS for location
5. Submit to create account
6. Automatically redirected to shop admin dashboard

### For Developers
```typescript
import { registerShop } from '@/lib/shop-registration';

// Register a new shop
const result = await registerShop({
  shopName: "Clean Laundry Co",
  address: "123 Main St, City, State",
  phone: "+1234567890",
  email: "owner@cleanlaundry.com",
  password: "securepassword",
  latitude: 40.7128,
  longitude: -74.0060
});
```

## Security Considerations

### Row Level Security (RLS)
- Shop admins can only access their own shop data
- Orders are properly isolated by shop
- Profiles are secured by user ID and role

### Data Validation
- Email format validation
- Phone number format validation
- Required field checks
- Password strength requirements

## UI/UX Features

### Responsive Design
- Works on desktop, tablet, and mobile
- Modern gradient backgrounds
- Consistent with existing design system

### User Experience
- Real-time form validation
- Loading indicators during submission
- Clear error messages
- Success confirmation
- Auto-redirect after registration

### Accessibility
- Proper form labels
- Keyboard navigation support
- Screen reader friendly
- High contrast colors

## Technical Implementation

### File Structure
```
web-admin/
├── app/
│   ├── page.tsx (updated with CTA section)
│   └── register-shop/
│       └── page.tsx (registration form)
├── lib/
│   ├── shop-registration.ts (utility functions)
│   └── auth-context.tsx (existing auth)
└── supabase/
    └── migrations/ (database schema)
```

### Dependencies
- Next.js 14+ (App Router)
- React Hook Form (built-in validation)
- Supabase Client
- Tailwind CSS (styling)
- Lucide React (icons)

## Testing

### Manual Testing Checklist
- [ ] Landing page displays CTA section
- [ ] Register button navigates to /register-shop
- [ ] Form validation works for all fields
- [ ] GPS location detection works
- [ ] Shop registration creates all database records
- [ ] User is redirected to dashboard after registration
- [ ] Shop admin can access their shop data
- [ ] Error handling works for duplicate emails

### Automated Testing
```typescript
// Example test for registration utility
describe('registerShop', () => {
  it('should create shop and admin account', async () => {
    const result = await registerShop(testData);
    expect(result.success).toBe(true);
    expect(result.shop).toBeDefined();
    expect(result.user).toBeDefined();
  });
});
```

## Future Enhancements

### Phase 2 Features
- Email verification flow
- Shop logo upload
- Business license verification
- Stripe payment integration for subscriptions
- Shop analytics dashboard
- Multi-admin support per shop

### Phase 3 Features
- Shop profile editing
- Service catalog management
- Customer notification system
- Integration with delivery services
- Mobile app for shop owners

## Troubleshooting

### Common Issues
1. **GPS Location Not Working**
   - Check browser permissions
   - Ensure HTTPS in production
   - Provide manual coordinate entry as fallback

2. **Registration Fails**
   - Check Supabase configuration
   - Verify database permissions
   - Check for duplicate emails

3. **Database Errors**
   - Ensure migrations are applied
   - Check RLS policies
   - Verify foreign key constraints

### Debug Mode
```typescript
// Enable debug logging
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('Registration data:', formData);
  console.log('Supabase response:', result);
}
```

## Deployment Notes

### Environment Variables
Ensure these are set in production:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Database Setup
1. Apply the migration: `supabase db reset`
2. Enable phone auth in Supabase dashboard if needed
3. Configure SMTP for email verification

### Performance
- Form validation is client-side for instant feedback
- GPS detection is optional to avoid blocking
- Database operations are optimized with proper indexing

This implementation provides a complete, production-ready shop registration system that integrates seamlessly with your existing laundry management platform.