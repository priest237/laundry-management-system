import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/lib/auth-context";

export type AccountStatus = "active" | "suspended" | "deactivated";
export type OrderStatus =
  | "received"
  | "washing"
  | "drying"
  | "ironing"
  | "ready"
  | "out_for_delivery"
  | "completed";

export type ProfileRow = {
  id: string;
  name: string;
  role: UserRole;
  shop_id: string | null;
  phone: string | null;
  address: string | null;
  account_status: AccountStatus;
  loyalty_points: number;
  created_at: string;
};

export type ShopRow = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  latitude?: number | null;
  longitude?: number | null;
  shop_status?: "pending" | "approved" | "suspended";
  created_at?: string;
};

export type OrderRow = {
  id: string;
  order_number: string | null;
  status: OrderStatus;
  payment_status: string;
  notes: string | null;
  total_price: string | number;
  discount_amount: string | number | null;
  tax_amount: string | number | null;
  final_amount: string | number | null;
  created_at: string;
  customer_id: string;
  shop_id: string;
  delivery_agent_id: string | null;
  customer?: { id: string; name: string; phone: string | null } | null;
  shop?: { id: string; name: string; address?: string | null } | null;
};

export type ServiceTypeRow = {
  id: string;
  shop_id: string | null;
  name: string;
  pricing_unit: "item" | "kg";
  price: string | number;
  is_active: boolean;
};

export type InventoryRow = {
  id: string;
  shop_id: string;
  item_name: string;
  quantity: number;
  unit: string | null;
  low_stock_threshold: number;
};

export type RevenueRow = {
  shop_id: string | null;
  report_date: string;
  order_count: number;
  revenue: string | number | null;
};

export type MachineLogRow = {
  id: string;
  shop_id: string | null;
  machine_name: string;
  status: "idle" | "running" | "maintenance" | "fault";
  cycle_count: number;
  runtime_minutes: number;
  fault_message: string | null;
  logged_at: string;
};

export type PaymentRow = {
  id: string;
  order_id: string;
  amount: string | number;
  method: "cash" | "online" | "credit_card" | "digital_wallet";
  status: string;
  transaction_id: string | null;
  created_at: string;
  order?: {
    id: string;
    order_number: string | null;
    shop_id: string;
    customer?: { id: string; name: string; phone: string | null } | null;
    shop?: { id: string; name: string } | null;
  } | null;
};

export type SystemSettingRow = {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
};

export type DashboardSnapshot = {
  profiles: ProfileRow[];
  shops: ShopRow[];
  orders: OrderRow[];
  services: ServiceTypeRow[];
  inventory: InventoryRow[];
  revenue: RevenueRow[];
  machines: MachineLogRow[];
  payments: PaymentRow[];
  settings: SystemSettingRow[];
};

const emptySnapshot: DashboardSnapshot = {
  profiles: [],
  shops: [],
  orders: [],
  services: [],
  inventory: [],
  revenue: [],
  machines: [],
  payments: [],
  settings: [],
};

export function canManageOperations(role?: UserRole | null) {
  return role === "general_admin" || role === "shop_admin" || role === "admin" || role === "staff";
}

export function isDeliveryRole(role?: UserRole | null) {
  return role === "delivery_agent";
}

export function isCustomerRole(role?: UserRole | null) {
  return role === "user" || role === "customer";
}

export async function getDashboardSnapshot(role?: UserRole | null, profileId?: string, shopId?: string | null) {
  if (isCustomerRole(role) && profileId) {
    const [ordersResult, shopsResult, servicesResult] = await Promise.all([
      supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        payment_status,
        notes,
        total_price,
        discount_amount,
        tax_amount,
        final_amount,
        created_at,
        customer_id,
        shop_id,
        delivery_agent_id,
        shop:shops(id, name, address)
      `)
      .eq("customer_id", profileId)
      .order("created_at", { ascending: false }),
      supabase.from("shops").select("id, name, address, phone, latitude, longitude").order("name"),
      supabase.from("service_types").select("id, shop_id, name, pricing_unit, price, is_active").eq("is_active", true).order("name"),
    ]);

    const firstError = ordersResult.error || shopsResult.error || servicesResult.error;
    if (firstError) throw firstError;

    return {
      ...emptySnapshot,
      orders: (ordersResult.data || []) as unknown as OrderRow[],
      shops: (shopsResult.data || []) as ShopRow[],
      services: (servicesResult.data || []) as ServiceTypeRow[],
    };
  }

  if (isDeliveryRole(role) && profileId) {
    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        payment_status,
        notes,
        total_price,
        discount_amount,
        tax_amount,
        final_amount,
        created_at,
        customer_id,
        shop_id,
        delivery_agent_id,
        customer:profiles(id, name, phone),
        shop:shops(id, name)
      `)
      .eq("delivery_agent_id", profileId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { ...emptySnapshot, orders: (orders || []) as unknown as OrderRow[] };
  }

  const scopedToShop = role === "shop_admin" || role === "staff";
  const ordersQuery = supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      payment_status,
      notes,
      total_price,
      discount_amount,
      tax_amount,
      final_amount,
      created_at,
      customer_id,
      shop_id,
      delivery_agent_id,
      customer:profiles(id, name, phone),
      shop:shops(id, name)
    `);
  const servicesQuery = supabase.from("service_types").select("id, shop_id, name, pricing_unit, price, is_active");
  const inventoryQuery = supabase.from("inventory").select("id, shop_id, item_name, quantity, unit, low_stock_threshold");
  const revenueQuery = supabase.from("daily_revenue").select("shop_id, report_date, order_count, revenue");
  const machinesQuery = supabase
    .from("machine_logs")
    .select("id, shop_id, machine_name, status, cycle_count, runtime_minutes, fault_message, logged_at");
  const paymentsQuery = supabase
    .from("payments")
    .select(`
      id,
      order_id,
      amount,
      method,
      status,
      transaction_id,
      created_at,
      order:orders(id, order_number, shop_id, customer:profiles(id, name, phone), shop:shops(id, name))
    `);

  const [
    profilesResult,
    shopsResult,
    ordersResult,
    servicesResult,
    inventoryResult,
    revenueResult,
    machinesResult,
    paymentsResult,
    settingsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, role, shop_id, phone, address, account_status, loyalty_points, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("shops").select("id, name, address, phone, latitude, longitude, shop_status, created_at").order("name"),
    (scopedToShop && shopId ? ordersQuery.eq("shop_id", shopId) : ordersQuery).order("created_at", { ascending: false }),
    (scopedToShop && shopId ? servicesQuery.eq("shop_id", shopId) : servicesQuery).order("name"),
    (scopedToShop && shopId ? inventoryQuery.eq("shop_id", shopId) : inventoryQuery).order("item_name"),
    (scopedToShop && shopId ? revenueQuery.eq("shop_id", shopId) : revenueQuery).order("report_date", { ascending: false }),
    (scopedToShop && shopId ? machinesQuery.eq("shop_id", shopId) : machinesQuery).order("logged_at", { ascending: false }),
    (scopedToShop && shopId ? paymentsQuery.eq("order.shop_id", shopId) : paymentsQuery).order("created_at", { ascending: false }),
    role === "general_admin" || role === "admin"
      ? supabase.from("system_settings").select("key, value, description, updated_at").order("key")
      : Promise.resolve({ data: [], error: null }),
  ]);

  const firstError =
    profilesResult.error ||
    shopsResult.error ||
    ordersResult.error ||
    servicesResult.error ||
    inventoryResult.error ||
    revenueResult.error ||
    machinesResult.error ||
    paymentsResult.error ||
    settingsResult.error;

  if (firstError) throw firstError;

  return {
    profiles: (profilesResult.data || []) as ProfileRow[],
    shops: (shopsResult.data || []) as ShopRow[],
    orders: (ordersResult.data || []) as unknown as OrderRow[],
    services: (servicesResult.data || []) as ServiceTypeRow[],
    inventory: (inventoryResult.data || []) as InventoryRow[],
    revenue: (revenueResult.data || []) as RevenueRow[],
    machines: (machinesResult.data || []) as MachineLogRow[],
    payments: (paymentsResult.data || []) as unknown as PaymentRow[],
    settings: (settingsResult.data || []) as SystemSettingRow[],
  };
}

export async function saveShop(input: {
  id?: string;
  name: string;
  address: string;
  phone?: string;
  latitude?: number | null;
  longitude?: number | null;
  shop_status?: "pending" | "approved" | "suspended";
}) {
  const payload = {
    name: input.name,
    address: input.address,
    phone: input.phone || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    shop_status: input.shop_status || "approved",
    updated_at: new Date().toISOString(),
  };

  const request = input.id
    ? supabase.from("shops").update(payload).eq("id", input.id)
    : supabase.from("shops").insert(payload);

  const { data, error } = await request.select().single();
  if (error) throw error;
  return data as ShopRow;
}

export async function deleteShop(shopId: string) {
  const { error } = await supabase.from("shops").delete().eq("id", shopId);
  if (error) throw error;
}

export async function updateOwnProfile(input: {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      name: input.name,
      phone: input.phone || null,
      address: input.address || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select()
    .single();

  if (error) throw error;
  return data as ProfileRow;
}

export async function saveCustomer(input: {
  id?: string;
  name: string;
  phone?: string;
  address?: string;
  loyalty_points?: number;
}) {
  if (!input.id) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch("/api/admin/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify(input),
    });

    const result = (await response.json()) as { profile?: ProfileRow; error?: string };
    if (!response.ok || !result.profile) {
      throw new Error(result.error || "Unable to create customer.");
    }
    return result.profile;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      name: input.name,
      phone: input.phone || null,
      address: input.address || null,
      loyalty_points: input.loyalty_points || 0,
    })
    .eq("id", input.id)
    .select()
    .single();

  if (error) throw error;
  return data as ProfileRow;
}

export async function updateAccount(userId: string, role: UserRole, accountStatus: AccountStatus, shopId?: string | null) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      role,
      account_status: accountStatus,
      shop_id: shopId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as ProfileRow;
}

export async function saveService(input: {
  id?: string;
  shop_id?: string | null;
  name: string;
  pricing_unit: "item" | "kg";
  price: number;
  is_active: boolean;
}) {
  const payload = {
    shop_id: input.shop_id || null,
    name: input.name,
    pricing_unit: input.pricing_unit,
    price: input.price,
    is_active: input.is_active,
  };

  const request = input.id
    ? supabase.from("service_types").update(payload).eq("id", input.id)
    : supabase.from("service_types").insert(payload);

  const { data, error } = await request.select().single();
  if (error) throw error;
  return data as ServiceTypeRow;
}

export async function saveInventoryItem(input: {
  id?: string;
  shop_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
}) {
  const payload = {
    shop_id: input.shop_id,
    item_name: input.item_name,
    quantity: input.quantity,
    unit: input.unit,
    low_stock_threshold: input.low_stock_threshold,
  };

  const request = input.id
    ? supabase.from("inventory").update(payload).eq("id", input.id)
    : supabase.from("inventory").insert(payload);

  const { data, error } = await request.select().single();
  if (error) throw error;
  return data as InventoryRow;
}

export async function createWalkInOrder(input: {
  customer_id: string;
  shop_id: string;
  service_type: string;
  quantity: number;
  unit_price: number;
  pickup_time?: string;
  delivery_time?: string;
}) {
  const orderTotal = input.quantity * input.unit_price;
  const taxAmount = orderTotal * 0.05;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: input.customer_id,
      shop_id: input.shop_id,
      total_price: orderTotal,
      tax_amount: taxAmount,
      pickup_time: input.pickup_time || null,
      delivery_time: input.delivery_time || null,
      status: "received",
    })
    .select()
    .single();

  if (orderError) throw orderError;

  const { error: itemError } = await supabase.from("order_items").insert({
    order_id: order.id,
    service_type: input.service_type,
    quantity: input.quantity,
    unit_price: input.unit_price,
    total_price: orderTotal,
  });

  if (itemError) throw itemError;

  return order as OrderRow;
}

export async function createCustomerOrder(input: {
  customer_id: string;
  shop_id: string;
  service_type: string;
  quantity: number;
  unit_price: number;
  fulfillment: "pickup" | "drop_off";
  address: string;
  notes?: string;
  payment_method: "cash" | "online";
}) {
  const orderTotal = input.quantity * input.unit_price;
  const taxAmount = orderTotal * 0.05;
  const notes = [
    `Fulfillment: ${input.fulfillment === "pickup" ? "Pickup" : "Drop-off"}`,
    `Address: ${input.address || "Not provided"}`,
    input.notes ? `Notes: ${input.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: input.customer_id,
      shop_id: input.shop_id,
      total_price: orderTotal,
      tax_amount: taxAmount,
      status: "received",
      payment_status: "pending",
      notes,
    })
    .select()
    .single();

  if (orderError) throw orderError;

  const { error: itemError } = await supabase.from("order_items").insert({
    order_id: order.id,
    service_type: input.service_type,
    quantity: input.quantity,
    unit_price: input.unit_price,
    total_price: orderTotal,
  });

  if (itemError) throw itemError;

  const { error: paymentError } = await supabase.from("payments").insert({
    order_id: order.id,
    amount: orderTotal + taxAmount,
    method: input.payment_method,
    status: "pending",
  });

  if (paymentError) throw paymentError;
  return order as OrderRow;
}

export async function updateOrderWorkflow(input: {
  orderId: string;
  status: OrderStatus;
  payment_status?: string;
  delivery_agent_id?: string | null;
}) {
  const { data, error } = await supabase
    .from("orders")
    .update({
      status: input.status,
      payment_status: input.payment_status,
      delivery_agent_id: input.delivery_agent_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.orderId)
    .select()
    .single();

  if (error) throw error;
  return data as OrderRow;
}

export async function updatePaymentStatus(orderId: string, status: "pending" | "completed" | "failed" | "refunded") {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .update({
      payment_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select()
    .single();

  if (orderError) throw orderError;

  const { error: paymentError } = await supabase
    .from("payments")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", orderId);

  if (paymentError) throw paymentError;
  return order as OrderRow;
}

export async function saveSystemSetting(input: { key: string; value: string; description?: string | null }) {
  const { data, error } = await supabase
    .from("system_settings")
    .upsert({
      key: input.key,
      value: input.value,
      description: input.description || null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as SystemSettingRow;
}

export function downloadCsv(filename: string, rows: Array<Record<string, string | number | null | undefined>>) {
  const headers = Object.keys(rows[0] || { empty: "" });
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? "";
          return `"${String(value).replaceAll('"', '""')}"`;
        })
        .join(","),
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
