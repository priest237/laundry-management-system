export type OrderStatus =
  | "received"
  | "washing"
  | "drying"
  | "ironing"
  | "ready"
  | "out_for_delivery"
  | "completed";

export type Profile = {
  id: string;
  name: string;
  role: "user" | "customer" | "shop_admin" | "general_admin" | "admin" | "staff" | "delivery_agent";
  phone: string | null;
  address: string | null;
  account_status: "active" | "suspended" | "deactivated";
};

export type Shop = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type ServiceType = {
  id: string;
  shop_id: string | null;
  name: string;
  pricing_unit: "item" | "kg";
  price: string | number;
  is_active: boolean;
};

export type Order = {
  id: string;
  order_number: string | null;
  status: OrderStatus;
  payment_status: string;
  notes: string | null;
  total_price: string | number;
  tax_amount: string | number | null;
  final_amount: string | number | null;
  created_at: string;
  customer_id: string;
  shop_id: string;
  shop?: { id: string; name: string; address?: string | null } | null;
};

export type OrderItemInput = {
  service_type: string;
  quantity: number;
  unit_price: number;
};
