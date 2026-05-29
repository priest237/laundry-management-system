import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_SERVICE_TYPES } from "@/lib/admin-queries";

export async function POST(request: Request) {
  const body = await request.json();
  const { shopName, address, phone, email, password, latitude, longitude } = body;

  // Validate input
  if (!shopName?.trim()) {
    return NextResponse.json({ error: "Shop name is required" }, { status: 400 });
  }
  if (!address?.trim()) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }
  if (!phone?.trim()) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }
  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!password?.trim()) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase server credentials" }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 1. Create a confirmed user account with Supabase Auth.
    // This runs on the server, so it does not create a browser session.
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: shopName },
    });

    if (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: authError.message || "Failed to create user account" }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create user account" }, { status: 400 });
    }

    // 2. Create shop record
    const { data: shopData, error: shopError } = await adminClient
      .from("shops")
      .insert({
        name: shopName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        latitude: latitude || null,
        longitude: longitude || null,
      })
      .select()
      .single();

    if (shopError) {
      console.error("Shop insert error:", shopError);
      return NextResponse.json({ error: shopError.message || "Failed to create shop" }, { status: 400 });
    }

    // 3. Create profile record with shop_admin role
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: authData.user.id,
        name: shopName.trim(),
        role: "shop_admin",
        shop_id: shopData.id,
        phone: phone.trim(),
        address: address.trim(),
        account_status: "active",
      }, {
        onConflict: "id",
      });

    if (profileError) {
      console.error("Profile insert error:", profileError);
      return NextResponse.json({ error: profileError.message || "Failed to create profile" }, { status: 400 });
    }

    const { error: serviceError } = await adminClient
      .from("service_types")
      .insert(
        DEFAULT_SERVICE_TYPES.map((service) => ({
          shop_id: shopData.id,
          name: service.name,
          pricing_unit: service.pricing_unit,
          price: service.price,
          is_active: true,
        })),
      );

    if (serviceError) {
      console.error("Default service insert error:", serviceError);
      return NextResponse.json({ error: serviceError.message || "Failed to create default services" }, { status: 400 });
    }

    return NextResponse.json({
      user: { id: authData.user.id, email: authData.user.email },
      shop: shopData,
      success: true,
    });
  } catch (error) {
    console.error("Registration error:", error);
    const err = error as { message?: string; details?: string; hint?: string };
    return NextResponse.json({ error: err.message || err.details || err.hint || "Registration failed" }, { status: 500 });
  }
}
