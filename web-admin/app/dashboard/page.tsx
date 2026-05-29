"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  Boxes,
  CreditCard,
  FileDown,
  History,
  Package,
  RefreshCw,
  Route,
  Search,
  Settings,
  ShieldCheck,
  Shirt,
  Store,
  Trash2,
  Truck,
  UserCircle,
  UserPlus,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { ProtectedRoute } from "@/lib/protected-route";
import { useAuth, type UserProfile, type UserRole } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  canManageOperations,
  createCustomerOrder,
  createWalkInOrder,
  deleteShop,
  downloadCsv,
  getDashboardSnapshot,
  isCustomerRole,
  isDeliveryRole,
  saveCustomer,
  saveInventoryItem,
  saveService,
  seedDefaultServices,
  saveShop,
  saveSystemSetting,
  updateOwnProfile,
  updateAccount,
  updateOrderWorkflow,
  updatePaymentStatus,
  type AccountStatus,
  type DashboardSnapshot,
  type OrderStatus,
} from "@/lib/admin-queries";

type TabKey =
  | "overview"
  | "shops"
  | "track"
  | "history"
  | "profile"
  | "payments"
  | "settings"
  | "users"
  | "customers"
  | "orders"
  | "services"
  | "inventory"
  | "delivery"
  | "reports"
  | "machines";

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

const roleLabels: Record<UserRole, string> = {
  user: "Customer",
  customer: "Customer",
  shop_admin: "Shop Admin",
  general_admin: "General Admin",
  admin: "Admin",
  staff: "Staff",
  delivery_agent: "Delivery Agent",
};

const orderStatuses: OrderStatus[] = [
  "received",
  "washing",
  "drying",
  "ironing",
  "ready",
  "out_for_delivery",
  "completed",
];

const adminRoles: UserRole[] = ["customer", "admin", "staff", "delivery_agent", "shop_admin", "general_admin"];
const accountStatuses: AccountStatus[] = ["active", "suspended", "deactivated"];

function money(value: string | number | null | undefined) {
  return new Intl.NumberFormat("fr-CM", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function normalizeRole(role?: UserRole | null) {
  return role === "user" ? "customer" : role || "customer";
}

function statusClass(status: string) {
  if (status === "completed" || status === "active" || status === "sent") return "bg-emerald-50 text-emerald-700";
  if (status === "ready" || status === "out_for_delivery") return "bg-blue-50 text-blue-700";
  if (status === "suspended" || status === "fault") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [candidate.message, candidate.details, candidate.hint, candidate.code]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ");
  }
  return fallback;
}

function DashboardContent() {
  const { user, profile, loading: authLoading, profileLoading, profileError, refreshProfile } = useAuth();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(emptySnapshot);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");

  const role = normalizeRole(profile?.role);
  const canManage = canManageOperations(role);
  const isDelivery = isDeliveryRole(role);
  const isCustomer = isCustomerRole(role);
  const isGeneralAdmin = role === "general_admin" || role === "admin";

  useEffect(() => {
    if (isCustomer && activeTab === "overview") {
      setActiveTab("shops");
    }
  }, [activeTab, isCustomer]);

  const loadDashboard = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await getDashboardSnapshot(role, profile.id, profile.shop_id);
      setSnapshot(data);
    } catch (loadError) {
      const message = errorMessage(loadError, "Unable to load dashboard data.");
      setError(`${message} If this mentions a missing table, run supabase/requirements_extension.sql in Supabase SQL Editor.`);
    } finally {
      setLoading(false);
    }
  }, [profile, role]);

  useEffect(() => {
    if (!authLoading && !profileLoading) {
      void loadDashboard();
    }
  }, [authLoading, loadDashboard, profileLoading]);

  useEffect(() => {
    if (!profile || !isCustomer) return;

    const channel = supabase
      .channel(`customer-orders-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `customer_id=eq.${profile.id}`,
        },
        () => {
          void loadDashboard();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isCustomer, loadDashboard, profile]);

  useEffect(() => {
    if (!profile || isCustomer || isDelivery) return;

    const ordersChannel = supabase
      .channel(`admin-orders-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          void loadDashboard();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ordersChannel);
    };
  }, [isCustomer, isDelivery, loadDashboard, profile]);

  const summary = useMemo(() => {
    const totalRevenue = snapshot.orders.reduce((sum, order) => sum + Number(order.final_amount || order.total_price || 0), 0);
    const pendingOrders = snapshot.orders.filter((order) => order.status !== "completed").length;
    const lowStock = snapshot.inventory.filter((item) => item.quantity <= item.low_stock_threshold).length;
    const activeCustomers = snapshot.profiles.filter((person) => person.role === "customer" || person.role === "user").length;
    const averageDailyRevenue =
      snapshot.revenue.length === 0
        ? 0
        : snapshot.revenue.reduce((sum, row) => sum + Number(row.revenue || 0), 0) / snapshot.revenue.length;

    return {
      totalRevenue,
      pendingOrders,
      lowStock,
      activeCustomers,
      forecast: averageDailyRevenue * 7,
    };
  }, [snapshot]);

  const tabs = useMemo(() => {
    if (isCustomer) {
      return [
        { key: "shops" as TabKey, label: "Shops", icon: Store },
        { key: "track" as TabKey, label: "Track Order", icon: RefreshCw },
        { key: "history" as TabKey, label: "History", icon: History },
        { key: "profile" as TabKey, label: "Settings", icon: UserCircle },
      ];
    }

    if (isDelivery) {
      return [
        { key: "overview" as TabKey, label: "Deliveries", icon: Truck },
        { key: "delivery" as TabKey, label: "Routes", icon: Route },
      ];
    }

    if (isGeneralAdmin) {
      return [
        { key: "overview" as TabKey, label: "Overview", icon: BarChart3 },
        { key: "shops" as TabKey, label: "Shops", icon: Store },
        { key: "users" as TabKey, label: "Users", icon: Users },
        { key: "orders" as TabKey, label: "Orders", icon: Shirt },
        { key: "payments" as TabKey, label: "Payments", icon: CreditCard },
        { key: "services" as TabKey, label: "Pricing", icon: CreditCard },
        { key: "reports" as TabKey, label: "Analytics", icon: FileDown },
        { key: "settings" as TabKey, label: "Settings", icon: Settings },
      ];
    }

    return [
      { key: "overview" as TabKey, label: "Overview", icon: BarChart3 },
      { key: "customers" as TabKey, label: "Customers", icon: UserPlus },
      { key: "orders" as TabKey, label: "Orders", icon: Shirt },
      { key: "payments" as TabKey, label: "Payments", icon: CreditCard },
      { key: "services" as TabKey, label: "Pricing", icon: CreditCard },
      { key: "inventory" as TabKey, label: "Inventory", icon: Boxes },
      { key: "delivery" as TabKey, label: "Delivery", icon: Truck },
      { key: "reports" as TabKey, label: "Reports", icon: FileDown },
      { key: "machines" as TabKey, label: "Machines", icon: Wrench },
    ];
  }, [isCustomer, isDelivery, isGeneralAdmin]);

  const mainTabs = tabs.filter((tab) => tab.key !== "profile");
  const bottomTabs = tabs.filter((tab) => tab.key === "profile");

  async function runAction(label: string, action: () => Promise<unknown>) {
    setSaving(label);
    setError("");
    try {
      await action();
      await loadDashboard();
    } catch (actionError) {
      setError(errorMessage(actionError, "Action failed."));
    } finally {
      setSaving("");
    }
  }

  if (authLoading || profileLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (user && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md text-center">
          <h2 className="mb-2 text-2xl font-bold text-slate-900">Profile Loading Error</h2>
          <p className="mb-6 text-slate-600">{profileError || "Unable to load your profile."}</p>
          <button onClick={refreshProfile} className="rounded-md bg-blue-600 px-4 py-2 text-white">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col bg-slate-950 p-5 text-white lg:flex">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-600">
            <Shirt size={22} />
          </div>
          <div>
            <p className="text-lg font-bold">WASHWARE</p>
            <p className="text-xs text-slate-400">Laundry operations</p>
          </div>
        </div>

        <nav className="space-y-1">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                  activeTab === tab.key ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-900"
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2 border-t border-slate-800 pt-4">
          <button
            onClick={() => setShowProfile(true)}
            aria-label="View profile"
            title="View profile"
            className="grid h-11 w-11 place-items-center rounded-md bg-slate-900 text-slate-200 transition hover:bg-blue-600 hover:text-white"
          >
            <UserCircle size={26} />
          </button>

          {bottomTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                  activeTab === tab.key ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-900"
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </aside>

      <main className="lg:pl-72">
        <header className="border-b border-slate-200 bg-white px-5 py-4 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-medium text-blue-700">{roleLabels[role]}</p>
              <h1 className="text-2xl font-bold">Laundry Management Dashboard</h1>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Bell size={18} />
              Status changes can queue SMS/email notifications once providers are connected.
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 rounded-md px-3 py-2 text-sm ${
                  activeTab === tab.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <section className="space-y-6 p-5 lg:p-8">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {isCustomer && (
            <CustomerPortal
              activeTab={activeTab}
              snapshot={snapshot}
              profile={profile}
              userEmail={user?.email || ""}
              saving={saving}
              onCreateOrder={(input) => runAction("customer-order", () => createCustomerOrder(input))}
              onUpdateProfile={(input) =>
                runAction("profile", async () => {
                  await updateOwnProfile(input);
                  await refreshProfile();
                })
              }
            />
          )}

          {!isCustomer && activeTab === "overview" && (
            <Overview
              snapshot={snapshot}
              summary={summary}
              isCustomer={isCustomer}
              isDelivery={isDelivery}
              onStatusChange={(orderId, status) =>
                runAction("order", () => updateOrderWorkflow({ orderId, status }))
              }
            />
          )}

          {!isCustomer && activeTab === "shops" && isGeneralAdmin && (
            <ShopManagementPanel
              snapshot={snapshot}
              saving={saving === "shop"}
              onSave={(input) => runAction("shop", () => saveShop(input))}
              onDelete={(shopId) => runAction("shop", () => deleteShop(shopId))}
            />
          )}

          {activeTab === "users" && canManage && (
            <UsersPanel
              snapshot={snapshot}
              saving={saving === "user"}
              onSave={(id, nextRole, accountStatus, shopId) =>
                runAction("user", () => updateAccount(id, nextRole, accountStatus, shopId))
              }
            />
          )}

          {activeTab === "customers" && canManage && (
            <CustomersPanel
              snapshot={snapshot}
              saving={saving === "customer"}
              onSave={(input) => runAction("customer", () => saveCustomer(input))}
            />
          )}

          {activeTab === "orders" && canManage && (
            <OrdersPanel
              snapshot={snapshot}
              saving={saving}
              onCreate={(input) => runAction("order", () => createWalkInOrder(input))}
              onUpdate={(input) => runAction("order", () => updateOrderWorkflow(input))}
            />
          )}

          {activeTab === "payments" && canManage && (
            <PaymentsPanel
              snapshot={snapshot}
              saving={saving === "payment"}
              onUpdate={(orderId, status) => runAction("payment", () => updatePaymentStatus(orderId, status))}
            />
          )}

          {activeTab === "services" && canManage && (
            <ServicesPanel
              snapshot={snapshot}
              saving={saving === "service"}
              defaultShopId={profile?.shop_id || snapshot.shops[0]?.id || ""}
              onSave={(input) => runAction("service", () => saveService(input))}
              onSeed={(shopId) => runAction("service", () => seedDefaultServices(shopId || null))}
            />
          )}

          {activeTab === "inventory" && canManage && (
            <InventoryPanel
              snapshot={snapshot}
              saving={saving === "inventory"}
              defaultShopId={profile?.shop_id || snapshot.shops[0]?.id || ""}
              onSave={(input) => runAction("inventory", () => saveInventoryItem(input))}
            />
          )}

          {activeTab === "delivery" && (
            <DeliveryPanel
              snapshot={snapshot}
              saving={saving === "order"}
              onUpdate={(input) => runAction("order", () => updateOrderWorkflow(input))}
            />
          )}

          {activeTab === "reports" && canManage && <ReportsPanel snapshot={snapshot} summary={summary} />}

          {activeTab === "settings" && isGeneralAdmin && (
            <SystemSettingsPanel
              snapshot={snapshot}
              saving={saving === "setting"}
              onSave={(input) => runAction("setting", () => saveSystemSetting(input))}
            />
          )}

          {activeTab === "machines" && canManage && <MachinesPanel snapshot={snapshot} />}
        </section>
      </main>

      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
          <div className="w-full max-w-md rounded-md bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-md bg-blue-50 text-blue-700">
                  <UserCircle size={26} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Profile</h2>
                  <p className="text-sm text-slate-500">{roleLabels[role]}</p>
                </div>
              </div>
              <button
                onClick={() => setShowProfile(false)}
                aria-label="Close profile"
                className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <ProfileRow label="Name" value={profile?.name || "Not provided"} />
              <ProfileRow label="Email" value={user?.email || "Not provided"} />
              <ProfileRow label="Phone" value={profile?.phone || "Not provided"} />
              <ProfileRow label="Address" value={profile?.address || "Not provided"} />
              <ProfileRow label="Account status" value={profile?.account_status || "Active"} />
              <ProfileRow label="Role" value={roleLabels[role]} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerPortal({
  activeTab,
  snapshot,
  profile,
  userEmail,
  saving,
  onCreateOrder,
  onUpdateProfile,
}: {
  activeTab: TabKey;
  snapshot: DashboardSnapshot;
  profile: UserProfile | null;
  userEmail: string;
  saving: string;
  onCreateOrder: (input: {
    customer_id: string;
    shop_id: string;
    items: Array<{
      service_type: string;
      quantity: number;
      unit_price: number;
    }>;
    fulfillment: "pickup" | "drop_off";
    address: string;
    notes?: string;
    payment_method: "cash" | "online";
  }) => void;
  onUpdateProfile: (input: { id: string; name: string; phone?: string; address?: string }) => void;
}) {
  const [selectedShopId, setSelectedShopId] = useState(snapshot.shops[0]?.id || "");
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => undefined,
      { maximumAge: 300000, timeout: 5000 },
    );
  }, []);

  const effectiveSelectedShopId = selectedShopId || snapshot.shops[0]?.id || "";
  const selectedShop = snapshot.shops.find((shop) => shop.id === effectiveSelectedShopId) || snapshot.shops[0];
  const filteredShops = snapshot.shops.filter((shop) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return `${shop.name} ${shop.address}`.toLowerCase().includes(query);
  });

  if (!profile) return null;

  if (activeTab === "track") {
    return <CustomerTracking orders={snapshot.orders} />;
  }

  if (activeTab === "history") {
    return (
      <CustomerHistory
        orders={snapshot.orders}
        services={snapshot.services}
        defaultAddress={profile.address || ""}
        saving={saving === "customer-order"}
        onReorder={(order) => {
          const service = snapshot.services.find((item) => !item.shop_id || item.shop_id === order.shop_id);
          if (!service) return;
          onCreateOrder({
            customer_id: profile.id,
            shop_id: order.shop_id,
            items: [{ service_type: service.name, quantity: 1, unit_price: Number(service.price || 0) }],
            fulfillment: "pickup",
            address: profile.address || "",
            notes: `Reorder from ${order.order_number || order.id.slice(0, 8)}`,
            payment_method: "cash",
          });
        }}
      />
    );
  }

  if (activeTab === "profile") {
    return (
      <CustomerProfileForm
        profile={profile}
        userEmail={userEmail}
        saving={saving === "profile"}
        onSave={onUpdateProfile}
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-md bg-white p-3 shadow-sm">
          <Search size={18} className="text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search shops by name or address"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        <ShopMap
          shops={filteredShops}
          selectedShopId={selectedShop?.id || ""}
          userLocation={location}
          onSelectShop={setSelectedShopId}
        />

        <div className="grid gap-4 md:grid-cols-2">
          {filteredShops.map((shop) => {
            const services = snapshot.services.filter((service) => !service.shop_id || service.shop_id === shop.id);
            const isSelected = shop.id === selectedShop?.id;
            return (
              <button
                key={shop.id}
                onClick={() => setSelectedShopId(shop.id)}
                className={`rounded-md border bg-white p-4 text-left shadow-sm transition ${
                  isSelected ? "border-blue-600 ring-2 ring-blue-100" : "border-transparent hover:border-slate-200"
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{shop.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{shop.address}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {formatDistance(shop, location)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {services.length === 0 ? (
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">Pricing pending</span>
                  ) : (
                    services.slice(0, 4).map((service) => (
                      <span key={service.id} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                        {service.name} {money(service.price)}
                      </span>
                    ))
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <CustomerOrderForm
        profile={profile}
        shop={selectedShop}
        services={snapshot.services.filter((service) => !service.shop_id || service.shop_id === selectedShop?.id)}
        saving={saving === "customer-order"}
        onCreate={onCreateOrder}
      />
    </div>
  );
}

type LatLng = { latitude: number; longitude: number };

type GoogleMapNamespace = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
    Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance;
    LatLngBounds: new () => GoogleBoundsInstance;
  };
};

type GoogleMapInstance = {
  fitBounds: (bounds: GoogleBoundsInstance) => void;
  panTo: (latLng: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
};

type GoogleMarkerInstance = {
  addListener: (eventName: string, handler: () => void) => void;
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleBoundsInstance = {
  extend: (latLng: { lat: number; lng: number }) => void;
};

declare global {
  interface Window {
    google?: GoogleMapNamespace;
    washwareGoogleMapsPromise?: Promise<void>;
  }
}

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve();
  if (window.washwareGoogleMapsPromise) return window.washwareGoogleMapsPromise;

  window.washwareGoogleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-washware-google-maps="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.washwareGoogleMaps = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load."));
    document.head.appendChild(script);
  });

  return window.washwareGoogleMapsPromise;
}

function ShopMap({
  shops,
  selectedShopId,
  userLocation,
  onSelectShop,
}: {
  shops: DashboardSnapshot["shops"];
  selectedShopId: string;
  userLocation: LatLng | null;
  onSelectShop: (shopId: string) => void;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<GoogleMarkerInstance[]>([]);
  const [mapError, setMapError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const shopsWithCoordinates = useMemo(
    () => shops.filter((shop) => typeof shop.latitude === "number" && typeof shop.longitude === "number"),
    [shops],
  );
  const renderedMapError = apiKey ? mapError : "Google Maps is not configured.";

  useEffect(() => {
    if (!apiKey) {
      return;
    }

    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapElementRef.current || !window.google?.maps) return;

        const firstShop = shopsWithCoordinates[0];
        const initialCenter = firstShop
          ? { lat: firstShop.latitude as number, lng: firstShop.longitude as number }
          : userLocation
            ? { lat: userLocation.latitude, lng: userLocation.longitude }
            : { lat: 3.848, lng: 11.502 };

        if (!mapRef.current) {
          mapRef.current = new window.google.maps.Map(mapElementRef.current, {
            center: initialCenter,
            zoom: firstShop ? 13 : 11,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
        }

        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];

        const bounds = new window.google.maps.LatLngBounds();

        shopsWithCoordinates.forEach((shop) => {
          if (!mapRef.current || !window.google?.maps) return;
          const position = { lat: shop.latitude as number, lng: shop.longitude as number };
          bounds.extend(position);
          const marker = new window.google.maps.Marker({
            position,
            map: mapRef.current,
            title: shop.name,
            label: shop.id === selectedShopId ? "✓" : undefined,
          });
          marker.addListener("click", () => onSelectShop(shop.id));
          markersRef.current.push(marker);
        });

        if (shopsWithCoordinates.length > 1) {
          mapRef.current.fitBounds(bounds);
        } else if (shopsWithCoordinates.length === 1) {
          mapRef.current.panTo({ lat: shopsWithCoordinates[0].latitude as number, lng: shopsWithCoordinates[0].longitude as number });
          mapRef.current.setZoom(14);
        }
      })
      .catch((error) => {
        if (!cancelled) setMapError(errorMessage(error, "Google Maps failed to load."));
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, onSelectShop, selectedShopId, shopsWithCoordinates, userLocation]);

  return (
    <div className="overflow-hidden rounded-md bg-white shadow-sm">
      <div ref={mapElementRef} className="h-80 w-full bg-slate-100" />
      {renderedMapError && (
        <div className="border-t border-slate-200 p-4 text-sm text-slate-600">
          {renderedMapError}
        </div>
      )}
      {!renderedMapError && shopsWithCoordinates.length === 0 && (
        <div className="border-t border-slate-200 p-4 text-sm text-slate-600">
          No shop coordinates are available yet.
        </div>
      )}
    </div>
  );
}

function CustomerOrderForm({
  profile,
  shop,
  services,
  saving,
  onCreate,
}: {
  profile: UserProfile;
  shop?: DashboardSnapshot["shops"][number];
  services: DashboardSnapshot["services"];
  saving: boolean;
  onCreate: (input: {
    customer_id: string;
    shop_id: string;
    items: Array<{
      service_type: string;
      quantity: number;
      unit_price: number;
    }>;
    fulfillment: "pickup" | "drop_off";
    address: string;
    notes?: string;
    payment_method: "cash" | "online";
  }) => void;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [fulfillment, setFulfillment] = useState<"pickup" | "drop_off">("pickup");
  const [address, setAddress] = useState(profile.address || "");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");

  const effectiveServiceId = services.some((item) => item.id === serviceId) ? serviceId : services[0]?.id || "";
  const service = services.find((item) => item.id === effectiveServiceId) || services[0];
  const selectedItems = services
    .map((item) => ({
      service_type: item.name,
      quantity: quantities[item.id] || 0,
      unit_price: Number(item.price || 0),
    }))
    .filter((item) => item.quantity > 0);
  const subtotal = selectedItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!shop || selectedItems.length === 0) return;
        onCreate({
          customer_id: profile.id,
          shop_id: shop.id,
          items: selectedItems,
          fulfillment,
          address,
          notes,
          payment_method: paymentMethod,
        });
        setQuantities({});
        setServiceId(services[0]?.id || "");
        setNotes("");
      }}
      className="rounded-md bg-white p-5 shadow-sm"
    >
      <div className="mb-5">
        <p className="text-sm text-slate-500">Selected shop</p>
        <h2 className="font-semibold">{shop?.name || "Choose a shop"}</h2>
        {shop && <p className="mt-1 text-sm text-slate-500">{shop.address}</p>}
      </div>

      <label className="mb-3 block text-sm font-medium">
        Add cleaning service
        <select value={effectiveServiceId} onChange={(event) => setServiceId(event.target.value)} className="mt-1 w-full rounded-md border p-2">
          <option value="">Choose service</option>
          {services.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} - {money(item.price)} per {item.pricing_unit}
            </option>
          ))}
        </select>
      </label>

      <div className="mb-3 space-y-2">
        <p className="text-sm font-medium">Service quantities</p>
        {services.length === 0 ? (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">This shop has not published cleaning services yet.</p>
        ) : (
          services.map((item) => (
            <label key={item.id} className={`grid grid-cols-[1fr_92px] items-center gap-3 rounded-md border p-3 text-sm ${item.id === service?.id ? "border-blue-200 bg-blue-50/60" : "border-slate-200"}`}>
              <span>
                <span className="block font-medium text-slate-900">{item.name}</span>
                <span className="text-slate-500">{money(item.price)} per {item.pricing_unit}</span>
              </span>
              <input
                value={quantities[item.id] || ""}
                onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))}
                onFocus={() => setServiceId(item.id)}
                type="number"
                min={0}
                className="w-full rounded-md border p-2"
                placeholder="0"
              />
            </label>
          ))
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setFulfillment("pickup")} className={`rounded-md border px-3 py-2 text-sm ${fulfillment === "pickup" ? "border-blue-600 bg-blue-50 text-blue-700" : ""}`}>
          Pickup
        </button>
        <button type="button" onClick={() => setFulfillment("drop_off")} className={`rounded-md border px-3 py-2 text-sm ${fulfillment === "drop_off" ? "border-blue-600 bg-blue-50 text-blue-700" : ""}`}>
          Drop-off
        </button>
      </div>

      <label className="mb-3 block text-sm font-medium">
        Address
        <textarea value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 w-full rounded-md border p-2" rows={3} required />
      </label>

      <label className="mb-3 block text-sm font-medium">
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-md border p-2" rows={3} />
      </label>

      <label className="mb-4 block text-sm font-medium">
        Payment
        <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "cash" | "online")} className="mt-1 w-full rounded-md border p-2">
          <option value="cash">Cash</option>
          <option value="online">Online</option>
        </select>
      </label>

      <div className="mb-4 rounded-md bg-slate-50 p-3 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        <div className="mt-1 flex justify-between text-slate-500">
          <span>Estimated tax</span>
          <span>{money(subtotal * 0.05)}</span>
        </div>
      </div>

      <button disabled={saving || !shop || selectedItems.length === 0} className="w-full rounded-md bg-blue-600 px-3 py-2 text-white disabled:opacity-50">
        Place Order
      </button>
    </form>
  );
}

function CustomerTracking({ orders }: { orders: DashboardSnapshot["orders"] }) {
  const activeOrders = orders.filter((order) => order.status !== "completed");

  return (
    <div className="space-y-4">
      {activeOrders.length === 0 ? (
        <div className="rounded-md bg-white p-5 text-sm text-slate-500 shadow-sm">No active orders to track.</div>
      ) : (
        activeOrders.map((order) => (
          <div key={order.id} className="rounded-md bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-center">
              <div>
                <h2 className="font-semibold">{order.order_number || order.id.slice(0, 8)}</h2>
                <p className="text-sm text-slate-500">{order.shop?.name || "Laundry shop"} - {money(order.final_amount || order.total_price)}</p>
              </div>
              <span className={`w-fit rounded-full px-2 py-1 text-xs ${statusClass(order.payment_status)}`}>
                Payment {order.payment_status}
              </span>
            </div>
            <StatusTimeline status={order.status} />
          </div>
        ))
      )}
    </div>
  );
}

function StatusTimeline({ status }: { status: OrderStatus }) {
  const steps: OrderStatus[] = ["received", "washing", "drying", "ironing", "ready", "completed"];
  const currentIndex = steps.indexOf(status === "out_for_delivery" ? "ready" : status);

  return (
    <div className="grid gap-3 md:grid-cols-6">
      {steps.map((step, index) => {
        const active = index <= currentIndex;
        return (
          <div key={step} className={`rounded-md border p-3 text-sm ${active ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-500"}`}>
            <p className="font-medium capitalize">{step.replaceAll("_", " ")}</p>
          </div>
        );
      })}
    </div>
  );
}

function CustomerHistory({
  orders,
  services,
  defaultAddress,
  saving,
  onReorder,
}: {
  orders: DashboardSnapshot["orders"];
  services: DashboardSnapshot["services"];
  defaultAddress: string;
  saving: boolean;
  onReorder: (order: DashboardSnapshot["orders"][number]) => void;
}) {
  return (
    <div className="rounded-md bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="font-semibold">Order History</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {orders.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No orders yet.</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="font-medium">{order.order_number || order.id.slice(0, 8)}</p>
                <p className="text-sm text-slate-500">
                  {order.shop?.name || "Laundry shop"} - {new Date(order.created_at).toLocaleDateString()} - {money(order.final_amount || order.total_price)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs ${statusClass(order.status)}`}>{order.status.replaceAll("_", " ")}</span>
                  <span className={`rounded-full px-2 py-1 text-xs ${statusClass(order.payment_status)}`}>Payment {order.payment_status}</span>
                </div>
              </div>
              <button
                disabled={saving || !defaultAddress || services.filter((service) => !service.shop_id || service.shop_id === order.shop_id).length === 0}
                onClick={() => onReorder(order)}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                Reorder
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CustomerProfileForm({
  profile,
  userEmail,
  saving,
  onSave,
}: {
  profile: UserProfile;
  userEmail: string;
  saving: boolean;
  onSave: (input: { id: string; name: string; phone?: string; address?: string }) => void;
}) {
  const [name, setName] = useState(profile.name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [address, setAddress] = useState(profile.address || "");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ id: profile.id, name, phone, address });
      }}
      className="max-w-2xl rounded-md bg-white p-5 shadow-sm"
    >
      <h2 className="mb-5 font-semibold">Settings</h2>
      <label className="mb-3 block text-sm font-medium">
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-md border p-2" required />
      </label>
      <label className="mb-3 block text-sm font-medium">
        Email
        <input value={userEmail} className="mt-1 w-full rounded-md border bg-slate-50 p-2 text-slate-500" disabled />
      </label>
      <label className="mb-3 block text-sm font-medium">
        Phone
        <input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-md border p-2" />
      </label>
      <label className="mb-4 block text-sm font-medium">
        Address
        <textarea value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 w-full rounded-md border p-2" rows={4} />
      </label>
      <button disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
        Save Profile
      </button>
    </form>
  );
}

function formatDistance(shop: DashboardSnapshot["shops"][number], location: { latitude: number; longitude: number } | null) {
  if (!location || typeof shop.latitude !== "number" || typeof shop.longitude !== "number") return "Distance unavailable";

  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(shop.latitude - location.latitude);
  const longitudeDelta = toRadians(shop.longitude - location.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(location.latitude)) *
      Math.cos(toRadians(shop.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  const distance = earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return `${distance.toFixed(distance < 10 ? 1 : 0)} km`;
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-slate-900">{value}</p>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof BarChart3 }) {
  return (
    <div className="rounded-md bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <Icon className="text-blue-600" size={20} />
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Overview({
  snapshot,
  summary,
  isCustomer,
  isDelivery,
  onStatusChange,
}: {
  snapshot: DashboardSnapshot;
  summary: { totalRevenue: number; pendingOrders: number; lowStock: number; activeCustomers: number; forecast: number };
  isCustomer: boolean;
  isDelivery: boolean;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Revenue" value={money(summary.totalRevenue)} icon={CreditCard} />
        <Metric label="Open Orders" value={summary.pendingOrders} icon={Package} />
        <Metric label="Customers" value={summary.activeCustomers || "-"} icon={Users} />
        <Metric label="Low Stock Alerts" value={summary.lowStock} icon={Boxes} />
      </div>

      <div className="rounded-md bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="font-semibold">{isCustomer ? "My Orders" : isDelivery ? "Assigned Deliveries" : "Recent Orders"}</h2>
        </div>
        <OrderTable orders={snapshot.orders.slice(0, 8)} onStatusChange={onStatusChange} readonly={isCustomer} />
      </div>
    </>
  );
}

function ShopManagementPanel({
  snapshot,
  saving,
  onSave,
  onDelete,
}: {
  snapshot: DashboardSnapshot;
  saving: boolean;
  onSave: (input: {
    id?: string;
    name: string;
    address: string;
    phone?: string;
    latitude?: number | null;
    longitude?: number | null;
    shop_status?: "pending" | "approved" | "suspended";
  }) => void;
  onDelete: (shopId: string) => void;
}) {
  const [editingId, setEditingId] = useState("");
  const editingShop = snapshot.shops.find((shop) => shop.id === editingId);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [status, setStatus] = useState<"pending" | "approved" | "suspended">("approved");

  function loadShop(shop: DashboardSnapshot["shops"][number]) {
    setEditingId(shop.id);
    setName(shop.name);
    setAddress(shop.address);
    setPhone(shop.phone || "");
    setLatitude(shop.latitude == null ? "" : String(shop.latitude));
    setLongitude(shop.longitude == null ? "" : String(shop.longitude));
    setStatus(shop.shop_status || "approved");
  }

  function resetForm() {
    setEditingId("");
    setName("");
    setAddress("");
    setPhone("");
    setLatitude("");
    setLongitude("");
    setStatus("approved");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            id: editingId || undefined,
            name,
            address,
            phone,
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null,
            shop_status: status,
          });
          resetForm();
        }}
        className="rounded-md bg-white p-5 shadow-sm"
      >
        <h2 className="mb-4 font-semibold">{editingShop ? "Edit Shop" : "Create Shop"}</h2>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Shop name" className="mb-3 w-full rounded-md border p-2" required />
        <textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Address" className="mb-3 w-full rounded-md border p-2" required />
        <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" className="mb-3 w-full rounded-md border p-2" />
        <div className="mb-3 grid grid-cols-2 gap-2">
          <input value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="Latitude" className="rounded-md border p-2" />
          <input value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="Longitude" className="rounded-md border p-2" />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value as "pending" | "approved" | "suspended")} className="mb-3 w-full rounded-md border p-2">
          <option value="pending">Pending approval</option>
          <option value="approved">Approved</option>
          <option value="suspended">Suspended</option>
        </select>
        <div className="flex gap-2">
          <button disabled={saving} className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-white disabled:opacity-50">
            {editingShop ? "Save Shop" : "Create Shop"}
          </button>
          {editingShop && (
            <button type="button" onClick={resetForm} className="rounded-md border px-3 py-2 text-sm">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="rounded-md bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="font-semibold">Shop Management</h2>
          <p className="text-sm text-slate-500">Create shops, approve registrations, edit details, or suspend/remove shops.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {snapshot.shops.map((shop) => (
            <div key={shop.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{shop.name}</p>
                  <span className={`rounded-full px-2 py-1 text-xs ${statusClass(shop.shop_status || "approved")}`}>
                    {shop.shop_status || "approved"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{shop.address}</p>
                <p className="text-xs text-slate-500">{shop.phone || "No phone"} · {shop.latitude ?? "-"}, {shop.longitude ?? "-"}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => loadShop(shop)} className="rounded-md border px-3 py-2 text-sm">
                  Edit
                </button>
                <button onClick={() => onDelete(shop.id)} className="grid h-9 w-9 place-items-center rounded-md border text-red-600 hover:bg-red-50" aria-label="Remove shop">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsersPanel({
  snapshot,
  saving,
  onSave,
}: {
  snapshot: DashboardSnapshot;
  saving: boolean;
  onSave: (id: string, role: UserRole, status: AccountStatus, shopId: string | null) => void;
}) {
  return (
    <div className="rounded-md bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="font-semibold">User Management</h2>
        <p className="text-sm text-slate-500">Assign roles and suspend or deactivate accounts.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Role</th>
              <th className="p-3">Branch</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.profiles.map((person) => (
              <UserRow key={person.id} person={person} shops={snapshot.shops} saving={saving} onSave={onSave} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserRow({
  person,
  shops,
  saving,
  onSave,
}: {
  person: DashboardSnapshot["profiles"][number];
  shops: DashboardSnapshot["shops"];
  saving: boolean;
  onSave: (id: string, role: UserRole, status: AccountStatus, shopId: string | null) => void;
}) {
  const [role, setRole] = useState<UserRole>(normalizeRole(person.role));
  const [status, setStatus] = useState<AccountStatus>(person.account_status || "active");
  const [shopId, setShopId] = useState(person.shop_id || "");

  return (
    <tr className="border-t border-slate-100">
      <td className="p-3">
        <p className="font-medium">{person.name}</p>
        <p className="text-xs text-slate-500">{person.phone || person.id}</p>
      </td>
      <td className="p-3">
        <select value={role} onChange={(event) => setRole(event.target.value as UserRole)} className="rounded-md border p-2">
          {adminRoles.map((option) => (
            <option key={option} value={option}>
              {roleLabels[option]}
            </option>
          ))}
        </select>
      </td>
      <td className="p-3">
        <select value={shopId} onChange={(event) => setShopId(event.target.value)} className="rounded-md border p-2">
          <option value="">No branch</option>
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
            </option>
          ))}
        </select>
      </td>
      <td className="p-3">
        <select value={status} onChange={(event) => setStatus(event.target.value as AccountStatus)} className="rounded-md border p-2">
          {accountStatuses.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </td>
      <td className="p-3">
        <button
          disabled={saving}
          onClick={() => onSave(person.id, role, status, shopId || null)}
          className="rounded-md bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
        >
          Save
        </button>
      </td>
    </tr>
  );
}

function CustomersPanel({
  snapshot,
  saving,
  onSave,
}: {
  snapshot: DashboardSnapshot;
  saving: boolean;
  onSave: (input: { id?: string; name: string; phone?: string; address?: string; loyalty_points?: number }) => void;
}) {
  const customers = snapshot.profiles.filter((person) => person.role === "customer" || person.role === "user");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ name, phone, address });
          setName("");
          setPhone("");
          setAddress("");
        }}
        className="rounded-md bg-white p-5 shadow-sm"
      >
        <h2 className="mb-4 font-semibold">Create Walk-in Customer</h2>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Customer name" className="mb-3 w-full rounded-md border p-2" required />
        <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" className="mb-3 w-full rounded-md border p-2" />
        <textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Address" className="mb-3 w-full rounded-md border p-2" />
        <button disabled={saving} className="w-full rounded-md bg-blue-600 px-3 py-2 text-white disabled:opacity-50">
          Create Customer
        </button>
      </form>

      <div className="rounded-md bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="font-semibold">Customer Profiles</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {customers.map((customer) => (
            <div key={customer.id} className="grid gap-3 p-4 md:grid-cols-4">
              <div>
                <p className="font-medium">{customer.name}</p>
                <p className="text-xs text-slate-500">{customer.phone || "No phone"}</p>
              </div>
              <p className="text-sm text-slate-600">{customer.address || "No address"}</p>
              <div className="text-sm">
                <p>Orders: {snapshot.orders.filter((order) => order.customer_id === customer.id).length}</p>
                <p className="text-xs text-slate-500">
                  Last: {snapshot.orders.find((order) => order.customer_id === customer.id)?.order_number || "No orders"}
                </p>
              </div>
              <p className="text-sm">Loyalty: {customer.loyalty_points || 0} pts</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrdersPanel({
  snapshot,
  saving,
  onCreate,
  onUpdate,
}: {
  snapshot: DashboardSnapshot;
  saving: string;
  onCreate: (input: {
    customer_id: string;
    shop_id: string;
    items: Array<{
      service_type: string;
      quantity: number;
      unit_price: number;
    }>;
    pickup_time?: string;
    delivery_time?: string;
  }) => void;
  onUpdate: (input: { orderId: string; status: OrderStatus; payment_status?: string; delivery_agent_id?: string | null }) => void;
}) {
  const customers = snapshot.profiles.filter((person) => person.role === "customer" || person.role === "user");
  const deliveryAgents = snapshot.profiles.filter((person) => person.role === "delivery_agent");
  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [shopId, setShopId] = useState(snapshot.shops[0]?.id || "");
  const availableServices = snapshot.services.filter((service) => !service.shop_id || service.shop_id === shopId);
  const [serviceId, setServiceId] = useState(availableServices[0]?.id || "");
  const [quantity, setQuantity] = useState(1);
  const selectedService = availableServices.find((service) => service.id === serviceId) || availableServices[0];

  return (
    <div className="space-y-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!selectedService) return;
          onCreate({
            customer_id: customerId,
            shop_id: shopId,
            items: [{ service_type: selectedService.name, quantity, unit_price: Number(selectedService.price || 0) }],
          });
        }}
        className="grid gap-3 rounded-md bg-white p-5 shadow-sm md:grid-cols-6"
      >
        <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="rounded-md border p-2 md:col-span-2" required>
          <option value="">Customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        <select
          value={shopId}
          onChange={(event) => {
            const nextShopId = event.target.value;
            setShopId(nextShopId);
            const nextService = snapshot.services.find((service) => !service.shop_id || service.shop_id === nextShopId);
            setServiceId(nextService?.id || "");
          }}
          className="rounded-md border p-2"
          required
        >
          <option value="">Branch</option>
          {snapshot.shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
            </option>
          ))}
        </select>
        <select value={selectedService?.id || ""} onChange={(event) => setServiceId(event.target.value)} className="rounded-md border p-2" required>
          <option value="">Service</option>
          {availableServices.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>
        <input value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} type="number" min={1} className="rounded-md border p-2" />
        <input value={selectedService ? money(selectedService.price) : ""} className="rounded-md border bg-slate-50 p-2 text-slate-500" disabled />
        <button disabled={saving === "order" || !selectedService} className="rounded-md bg-blue-600 px-3 py-2 text-white disabled:opacity-50 md:col-span-6">
          Create Walk-in Order
        </button>
      </form>

      <OrderTable orders={snapshot.orders} deliveryAgents={deliveryAgents} onStatusChange={(orderId, status, deliveryAgentId) => onUpdate({ orderId, status, delivery_agent_id: deliveryAgentId })} />
    </div>
  );
}

function OrderTable({
  orders,
  deliveryAgents = [],
  readonly = false,
  onStatusChange,
}: {
  orders: DashboardSnapshot["orders"];
  deliveryAgents?: DashboardSnapshot["profiles"];
  readonly?: boolean;
  onStatusChange: (orderId: string, status: OrderStatus, deliveryAgentId?: string | null) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="p-3">Order</th>
            <th className="p-3">Customer</th>
            <th className="p-3">Branch</th>
            <th className="p-3">Status</th>
            <th className="p-3">Payment</th>
            <th className="p-3">Total</th>
            <th className="p-3">Delivery</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-slate-100">
              <td className="p-3">
                <p className="font-medium">{order.order_number || order.id.slice(0, 8)}</p>
                <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString()}</p>
              </td>
              <td className="p-3">{order.customer?.name || order.customer_id.slice(0, 8)}</td>
              <td className="p-3">{order.shop?.name || order.shop_id.slice(0, 8)}</td>
              <td className="p-3">
                {readonly ? (
                  <span className={`rounded-full px-2 py-1 text-xs ${statusClass(order.status)}`}>{order.status}</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <select value={order.status} onChange={(event) => onStatusChange(order.id, event.target.value as OrderStatus, order.delivery_agent_id)} className="rounded-md border p-2">
                      {orderStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                    {order.status === "received" && (
                      <button onClick={() => onStatusChange(order.id, "washing", order.delivery_agent_id)} className="rounded-md bg-blue-600 px-3 py-2 text-xs text-white">
                        Accept
                      </button>
                    )}
                  </div>
                )}
              </td>
              <td className="p-3">
                <span className={`rounded-full px-2 py-1 text-xs ${statusClass(order.payment_status)}`}>{order.payment_status}</span>
              </td>
              <td className="p-3">{money(order.final_amount || order.total_price)}</td>
              <td className="p-3">
                {readonly ? (
                  order.delivery_agent_id ? "Assigned" : "Not assigned"
                ) : (
                  <select value={order.delivery_agent_id || ""} onChange={(event) => onStatusChange(order.id, order.status, event.target.value || null)} className="rounded-md border p-2">
                    <option value="">Unassigned</option>
                    {deliveryAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentsPanel({
  snapshot,
  saving,
  onUpdate,
}: {
  snapshot: DashboardSnapshot;
  saving: boolean;
  onUpdate: (orderId: string, status: "pending" | "completed" | "failed" | "refunded") => void;
}) {
  const paymentRows =
    snapshot.payments.length > 0
      ? snapshot.payments
      : snapshot.orders.map((order) => ({
          id: order.id,
          order_id: order.id,
          amount: order.final_amount || order.total_price,
          method: "cash" as const,
          status: order.payment_status,
          transaction_id: null,
          created_at: order.created_at,
          order: {
            id: order.id,
            order_number: order.order_number,
            shop_id: order.shop_id,
            customer: order.customer || null,
            shop: order.shop ? { id: order.shop.id, name: order.shop.name } : null,
          },
        }));

  return (
    <div className="rounded-md bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="font-semibold">Payment Management</h2>
        <p className="text-sm text-slate-500">Monitor payments and mark cash payments as paid or pending.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Shop</th>
              <th className="p-3">Method</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {paymentRows.map((payment) => (
              <tr key={payment.id} className="border-t border-slate-100">
                <td className="p-3">{payment.order?.order_number || payment.order_id.slice(0, 8)}</td>
                <td className="p-3">{payment.order?.customer?.name || "Customer"}</td>
                <td className="p-3">{payment.order?.shop?.name || "Shop"}</td>
                <td className="p-3 capitalize">{payment.method.replaceAll("_", " ")}</td>
                <td className="p-3">{money(payment.amount)}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-1 text-xs ${statusClass(payment.status)}`}>{payment.status}</span>
                </td>
                <td className="p-3">
                  <select
                    disabled={saving}
                    value={payment.status}
                    onChange={(event) => onUpdate(payment.order_id, event.target.value as "pending" | "completed" | "failed" | "refunded")}
                    className="rounded-md border p-2"
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Paid</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServicesPanel({
  snapshot,
  saving,
  defaultShopId,
  onSave,
  onSeed,
}: {
  snapshot: DashboardSnapshot;
  saving: boolean;
  defaultShopId: string;
  onSave: (input: { id?: string; shop_id?: string | null; name: string; pricing_unit: "item" | "kg"; price: number; is_active: boolean }) => void;
  onSeed: (shopId: string) => void;
}) {
  const [shopId, setShopId] = useState(defaultShopId);
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<"item" | "kg">("item");
  const [price, setPrice] = useState(800);
  const [isActive, setIsActive] = useState(true);

  function editService(service: DashboardSnapshot["services"][number]) {
    setEditingId(service.id);
    setShopId(service.shop_id || "");
    setName(service.name);
    setUnit(service.pricing_unit);
    setPrice(Number(service.price || 0));
    setIsActive(service.is_active);
  }

  function resetForm() {
    setEditingId("");
    setName("");
    setUnit("item");
    setPrice(800);
    setIsActive(true);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ id: editingId || undefined, shop_id: shopId || null, name, pricing_unit: unit, price, is_active: isActive });
          resetForm();
        }}
        className="rounded-md bg-white p-5 shadow-sm"
      >
        <h2 className="mb-4 font-semibold">{editingId ? "Edit Cleaning Service" : "Service Pricing"}</h2>
        <select value={shopId} onChange={(event) => setShopId(event.target.value)} className="mb-3 w-full rounded-md border p-2">
          <option value="">All branches</option>
          {snapshot.shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
            </option>
          ))}
        </select>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Service name" className="mb-3 w-full rounded-md border p-2" required />
        <select value={unit} onChange={(event) => setUnit(event.target.value as "item" | "kg")} className="mb-3 w-full rounded-md border p-2">
          <option value="item">Per item</option>
          <option value="kg">Per kilogram</option>
        </select>
        <label className="mb-3 block text-sm font-medium text-slate-700">
          Price in CFA
          <input value={price} onChange={(event) => setPrice(Number(event.target.value))} type="number" min={0} step="50" className="mt-1 w-full rounded-md border p-2" />
        </label>
        <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
          <input checked={isActive} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" className="h-4 w-4" />
          Active and visible to customers
        </label>
        <div className="flex gap-2">
          <button disabled={saving} className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-white disabled:opacity-50">
            Save Service
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-md border px-3 py-2 text-sm">
              Cancel
            </button>
          )}
        </div>
        <button type="button" disabled={saving} onClick={() => onSeed(shopId)} className="mt-3 w-full rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-700 disabled:opacity-50">
          Add Default CFA Services
        </button>
      </form>

      <div className="rounded-md bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="font-semibold">Configured Services</h2>
          <p className="text-sm text-slate-500">Prices are shown to customers in CFA. Shop-specific services override branch availability.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {snapshot.services.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No services yet.</p>
          ) : (
            snapshot.services.map((service) => (
              <div key={service.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-sm text-slate-500">
                    {service.pricing_unit} pricing · {service.shop_id ? snapshot.shops.find((shop) => shop.id === service.shop_id)?.name || "Branch" : "All branches"} · {service.is_active ? "Active" : "Hidden"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{money(service.price)}</span>
                  <button onClick={() => editService(service)} className="rounded-md border px-3 py-2 text-sm">
                    Edit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function InventoryPanel({
  snapshot,
  saving,
  defaultShopId,
  onSave,
}: {
  snapshot: DashboardSnapshot;
  saving: boolean;
  defaultShopId: string;
  onSave: (input: { shop_id: string; item_name: string; quantity: number; unit: string; low_stock_threshold: number }) => void;
}) {
  const [shopId, setShopId] = useState(defaultShopId);
  const [item, setItem] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState("pieces");
  const [threshold, setThreshold] = useState(5);

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ shop_id: shopId, item_name: item, quantity, unit, low_stock_threshold: threshold });
          setItem("");
          setQuantity(0);
        }}
        className="rounded-md bg-white p-5 shadow-sm"
      >
        <h2 className="mb-4 font-semibold">Inventory Item</h2>
        <select value={shopId} onChange={(event) => setShopId(event.target.value)} className="mb-3 w-full rounded-md border p-2" required>
          <option value="">Branch</option>
          {snapshot.shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
            </option>
          ))}
        </select>
        <input value={item} onChange={(event) => setItem(event.target.value)} placeholder="Item name" className="mb-3 w-full rounded-md border p-2" required />
        <input value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} type="number" min={0} className="mb-3 w-full rounded-md border p-2" />
        <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Unit" className="mb-3 w-full rounded-md border p-2" />
        <input value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} type="number" min={0} className="mb-3 w-full rounded-md border p-2" />
        <button disabled={saving} className="w-full rounded-md bg-blue-600 px-3 py-2 text-white disabled:opacity-50">
          Save Inventory
        </button>
      </form>

      <SimpleList
        title="Stock Levels"
        rows={snapshot.inventory.map((stock) => ({
          id: stock.id,
          primary: stock.item_name,
          secondary: `${stock.quantity} ${stock.unit || ""} available`,
          right: stock.quantity <= stock.low_stock_threshold ? "Low stock" : "OK",
          danger: stock.quantity <= stock.low_stock_threshold,
        }))}
      />
    </div>
  );
}

function DeliveryPanel({
  snapshot,
  saving,
  onUpdate,
}: {
  snapshot: DashboardSnapshot;
  saving: boolean;
  onUpdate: (input: { orderId: string; status: OrderStatus; delivery_agent_id?: string | null }) => void;
}) {
  const deliveryOrders = snapshot.orders.filter((order) => order.status === "ready" || order.status === "out_for_delivery" || order.delivery_agent_id);
  const deliveryAgents = snapshot.profiles.filter((person) => person.role === "delivery_agent");

  return (
    <div className="rounded-md bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="font-semibold">Pickup and Delivery</h2>
        <p className="text-sm text-slate-500">Assign delivery agents and update real-time delivery status.</p>
      </div>
      <OrderTable
        orders={deliveryOrders}
        deliveryAgents={deliveryAgents}
        onStatusChange={(orderId, status, deliveryAgentId) => onUpdate({ orderId, status, delivery_agent_id: deliveryAgentId })}
      />
      {saving && <p className="p-4 text-sm text-slate-500">Saving delivery update...</p>}
    </div>
  );
}

function ReportsPanel({
  snapshot,
  summary,
}: {
  snapshot: DashboardSnapshot;
  summary: { totalRevenue: number; pendingOrders: number; lowStock: number; activeCustomers: number; forecast: number };
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Revenue Forecast" value={money(summary.forecast)} icon={BarChart3} />
        <Metric label="Orders Analyzed" value={snapshot.orders.length} icon={Package} />
        <Metric label="Branches" value={snapshot.shops.length} icon={Store} />
      </div>

      <div className="rounded-md bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Revenue Report</h2>
          <button
            onClick={() =>
              downloadCsv(
                "washware-revenue.csv",
                snapshot.revenue.map((row) => ({
                  date: row.report_date,
                  shop_id: row.shop_id,
                  orders: row.order_count,
                  revenue: row.revenue,
                })),
              )
            }
            className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm text-white"
          >
            <FileDown size={16} />
            Export CSV
          </button>
        </div>
        <SimpleList
          title=""
          rows={snapshot.revenue.map((row) => ({
            id: `${row.shop_id}-${row.report_date}`,
            primary: row.report_date,
            secondary: `${row.order_count} paid orders`,
            right: money(row.revenue),
          }))}
        />
      </div>
    </div>
  );
}

function SystemSettingsPanel({
  snapshot,
  saving,
  onSave,
}: {
  snapshot: DashboardSnapshot;
  saving: boolean;
  onSave: (input: { key: string; value: string; description?: string | null }) => void;
}) {
  const defaults = [
    { key: "customer_ordering_enabled", value: "true", description: "Allow customers to place orders from the app." },
    { key: "online_payments_enabled", value: "false", description: "Show online payment as an available payment method." },
    { key: "notifications_enabled", value: "true", description: "Queue email, SMS, or push notifications for order updates." },
  ];
  const rows = defaults.map((item) => snapshot.settings.find((setting) => setting.key === item.key) || item);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="rounded-md bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="font-semibold">System Settings</h2>
          <p className="text-sm text-slate-500">Configure app behavior, notifications, and platform features.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map((setting) => (
            <SettingRow key={setting.key} setting={setting} saving={saving} onSave={onSave} />
          ))}
        </div>
      </div>

      <div className="rounded-md bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-blue-700">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="font-semibold">Security Control</h2>
            <p className="text-sm text-slate-500">Roles and permissions are enforced by Supabase RLS policies.</p>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <ProfileRow label="General admins" value="Manage shops, users, payments, pricing, and system settings" />
          <ProfileRow label="Shop admins" value="Manage only their assigned shop orders, customers, pricing, inventory, and payments" />
          <ProfileRow label="Customers" value="Create and track their own orders only" />
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  setting,
  saving,
  onSave,
}: {
  setting: { key: string; value: string; description?: string | null };
  saving: boolean;
  onSave: (input: { key: string; value: string; description?: string | null }) => void;
}) {
  const [value, setValue] = useState(setting.value);

  return (
    <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <p className="font-medium">{setting.key.replaceAll("_", " ")}</p>
        <p className="text-sm text-slate-500">{setting.description}</p>
      </div>
      <div className="flex gap-2">
        <select value={value} onChange={(event) => setValue(event.target.value)} className="rounded-md border p-2">
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
        <button
          disabled={saving}
          onClick={() => onSave({ key: setting.key, value, description: setting.description })}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function MachinesPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <div className="rounded-md bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="font-semibold">IoT Machine Monitoring</h2>
        <p className="text-sm text-slate-500">Machine logs are ready for IoT device ingestion.</p>
      </div>
      <SimpleList
        title=""
        rows={snapshot.machines.map((machine) => ({
          id: machine.id,
          primary: machine.machine_name,
          secondary: `${machine.cycle_count} cycles, ${machine.runtime_minutes} runtime minutes`,
          right: machine.fault_message || machine.status,
          danger: machine.status === "fault",
        }))}
      />
    </div>
  );
}

function SimpleList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; primary: string; secondary: string; right: string; danger?: boolean }>;
}) {
  return (
    <div className="rounded-md bg-white shadow-sm">
      {title && (
        <div className="border-b border-slate-200 p-5">
          <h2 className="font-semibold">{title}</h2>
        </div>
      )}
      <div className="divide-y divide-slate-100">
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No records yet.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{row.primary}</p>
                <p className="text-sm text-slate-500">{row.secondary}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs ${row.danger ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>
                {row.right}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
