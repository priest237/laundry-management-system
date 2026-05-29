import { supabase } from "./supabase";
import type { Order, OrderItemInput, Profile, ServiceType, Shop } from "../types";

export async function getOrCreateProfile(userId: string, fallbackName: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, role, phone, address, account_status")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as Profile;

  const { data: profile, error: createError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      name: fallbackName,
      role: "customer",
      account_status: "active",
    })
    .select("id, name, role, phone, address, account_status")
    .single();

  if (createError) throw createError;
  return profile as Profile;
}

export async function updateProfile(input: { id: string; name: string; phone?: string; address?: string }) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      name: input.name,
      phone: input.phone || null,
      address: input.address || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select("id, name, role, phone, address, account_status")
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function getCustomerData(customerId: string) {
  const [shopsResult, servicesResult, ordersResult] = await Promise.all([
    supabase.from("shops").select("id, name, address, phone, latitude, longitude").eq("shop_status", "approved").order("name"),
    supabase.from("service_types").select("id, shop_id, name, pricing_unit, price, is_active").eq("is_active", true).order("name"),
    supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        payment_status,
        notes,
        total_price,
        tax_amount,
        final_amount,
        created_at,
        customer_id,
        shop_id,
        shop:shops(id, name, address)
      `)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
  ]);

  const firstError = shopsResult.error || servicesResult.error || ordersResult.error;
  if (firstError) throw firstError;

  return {
    shops: (shopsResult.data || []) as Shop[],
    services: (servicesResult.data || []) as ServiceType[],
    orders: (ordersResult.data || []) as unknown as Order[],
  };
}

export async function createCustomerOrder(input: {
  customer_id: string;
  shop_id: string;
  items: OrderItemInput[];
  fulfillment: "pickup" | "drop_off";
  address: string;
  notes?: string;
  payment_method: "cash" | "online";
}) {
  const orderTotal = input.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxAmount = orderTotal * 0.05;
  const notes = [
    `Fulfillment: ${input.fulfillment === "pickup" ? "Pickup" : "Drop-off"}`,
    `Address: ${input.address || "Not provided"}`,
    `Services: ${input.items.map((item) => `${item.service_type} x ${item.quantity}`).join(", ")}`,
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

  const { error: itemError } = await supabase.from("order_items").insert(
    input.items.map((item) => ({
      order_id: order.id,
      service_type: item.service_type,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
    })),
  );

  if (itemError) throw itemError;

  const { error: paymentError } = await supabase.from("payments").insert({
    order_id: order.id,
    amount: orderTotal + taxAmount,
    method: input.payment_method,
    status: "pending",
  });

  if (paymentError) throw paymentError;
  return order as Order;
}
