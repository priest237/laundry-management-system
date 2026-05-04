import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CreateCustomerBody = {
  name?: string;
  phone?: string;
  address?: string;
  loyalty_points?: number;
};

export async function POST(request: Request) {
  const body = (await request.json()) as CreateCustomerBody;
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase server credentials." }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: requesterData, error: requesterError } = await adminClient.auth.getUser(token);
  if (requesterError || !requesterData.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: requesterProfile, error: profileLookupError } = await adminClient
    .from("profiles")
    .select("role, account_status")
    .eq("id", requesterData.user.id)
    .single();

  const allowedRoles = new Set(["general_admin", "shop_admin", "admin", "staff"]);
  if (
    profileLookupError ||
    !requesterProfile ||
    requesterProfile.account_status !== "active" ||
    !allowedRoles.has(String(requesterProfile.role))
  ) {
    return NextResponse.json({ error: "Only active admin or staff users can create customers." }, { status: 403 });
  }

  const syntheticEmail = `walkin-${crypto.randomUUID()}@washware.local`;
  const temporaryPassword = crypto.randomUUID() + "Aa1!";

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: syntheticEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { name },
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || "Unable to create customer." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .upsert({
      id: authData.user.id,
      name,
      phone: body.phone || null,
      address: body.address || null,
      loyalty_points: body.loyalty_points || 0,
      role: "customer",
      account_status: "active",
    })
    .select()
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ profile });
}
