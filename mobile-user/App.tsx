import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import type { Session } from "@supabase/supabase-js";
import { createCustomerOrder, getCustomerData, getOrCreateProfile, updateProfile } from "./src/lib/api";
import { money, statusLabel } from "./src/lib/format";
import { supabase } from "./src/lib/supabase";
import type { Order, Profile, ServiceType, Shop } from "./src/types";

type Tab = "shops" | "track" | "history" | "profile";

type CustomerState = {
  shops: Shop[];
  services: ServiceType[];
  orders: Order[];
};

const emptyCustomerState: CustomerState = {
  shops: [],
  services: [],
  orders: [],
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<CustomerState>(emptyCustomerState);
  const [tab, setTab] = useState<Tab>("shops");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadCustomer = useCallback(async (activeSession: Session | null) => {
    if (!activeSession?.user) {
      setProfile(null);
      setData(emptyCustomerState);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const fallbackName =
        activeSession.user.user_metadata?.name ||
        activeSession.user.user_metadata?.full_name ||
        activeSession.user.email?.split("@")[0] ||
        "Customer";
      const nextProfile = await getOrCreateProfile(activeSession.user.id, fallbackName);
      const nextData = await getCustomerData(activeSession.user.id);
      setProfile(nextProfile);
      setData(nextData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load app data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: sessionData }) => {
      setSession(sessionData.session);
      void loadCustomer(sessionData.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadCustomer(nextSession);
    });

    return () => subscription.unsubscribe();
  }, [loadCustomer]);

  useEffect(() => {
    if (!session?.user) return;

    const channel = supabase
      .channel(`mobile-customer-orders-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `customer_id=eq.${session.user.id}`,
        },
        () => {
          void loadCustomer(session);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadCustomer, session]);

  async function runAction(action: () => Promise<void>) {
    setSaving(true);
    setError("");
    try {
      await action();
      await loadCustomer(session);
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "Action failed.";
      setError(message);
      Alert.alert("Washware", message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.muted}>Loading Washware...</Text>
      </SafeAreaView>
    );
  }

  if (!session || !profile) {
    return <AuthScreen />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>WASHWARE</Text>
          <Text style={styles.muted}>Laundry orders for {profile.name}</Text>
        </View>
        <Pressable style={styles.ghostButton} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.ghostButtonText}>Logout</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.tabs}>
        {(["shops", "track", "history", "profile"] as Tab[]).map((item) => (
          <Pressable key={item} style={[styles.tab, tab === item && styles.activeTab]} onPress={() => setTab(item)}>
            <Text style={[styles.tabText, tab === item && styles.activeTabText]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "shops" && (
        <ShopOrderScreen
          profile={profile}
          shops={data.shops}
          services={data.services}
          saving={saving}
          onCreate={(input) => runAction(() => createCustomerOrder(input).then(() => undefined))}
        />
      )}

      {tab === "track" && <TrackingScreen orders={data.orders.filter((order) => order.status !== "completed")} />}
      {tab === "history" && <HistoryScreen orders={data.orders} />}
      {tab === "profile" && (
        <ProfileScreen
          profile={profile}
          saving={saving}
          onSave={(input) =>
            runAction(async () => {
              const nextProfile = await updateProfile(input);
              setProfile(nextProfile);
            })
          }
        />
      )}
    </SafeAreaView>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      if (!email || !password || (mode === "register" && !name)) {
        throw new Error("Fill in all required fields.");
      }

      if (mode === "login") {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw loginError;
      } else {
        const { error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (signupError) throw signupError;
        Alert.alert("Account created", "Check your email if verification is enabled, then sign in.");
        setMode("login");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.authBody}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>W</Text>
        </View>
        <Text style={styles.authTitle}>WASHWARE</Text>
        <Text style={styles.authSubtitle}>Customer laundry ordering and tracking</Text>

        <View style={styles.card}>
          <View style={styles.segmented}>
            <Pressable style={[styles.segment, mode === "login" && styles.segmentActive]} onPress={() => setMode("login")}>
              <Text style={[styles.segmentText, mode === "login" && styles.segmentTextActive]}>Login</Text>
            </Pressable>
            <Pressable style={[styles.segment, mode === "register" && styles.segmentActive]} onPress={() => setMode("register")}>
              <Text style={[styles.segmentText, mode === "register" && styles.segmentTextActive]}>Register</Text>
            </Pressable>
          </View>

          {mode === "register" && (
            <TextInput value={name} onChangeText={setName} placeholder="Full name" style={styles.input} placeholderTextColor="#64748b" />
          )}
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={styles.input} placeholderTextColor="#64748b" />
          <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} placeholderTextColor="#64748b" />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable disabled={loading} style={[styles.primaryButton, loading && styles.disabled]} onPress={submit}>
            <Text style={styles.primaryButtonText}>{loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ShopOrderScreen({
  profile,
  shops,
  services,
  saving,
  onCreate,
}: {
  profile: Profile;
  shops: Shop[];
  services: ServiceType[];
  saving: boolean;
  onCreate: (input: Parameters<typeof createCustomerOrder>[0]) => void;
}) {
  const [selectedShopId, setSelectedShopId] = useState(shops[0]?.id || "");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [fulfillment, setFulfillment] = useState<"pickup" | "drop_off">("pickup");
  const [address, setAddress] = useState(profile.address || "");
  const [notes, setNotes] = useState("");
  const [locationText, setLocationText] = useState("");
  const selectedShop = shops.find((shop) => shop.id === selectedShopId) || shops[0];
  const availableServices = services.filter((service) => !service.shop_id || service.shop_id === selectedShop?.id);
  const selectedItems = availableServices
    .map((service) => ({
      service_type: service.name,
      quantity: quantities[service.id] || 0,
      unit_price: Number(service.price || 0),
    }))
    .filter((item) => item.quantity > 0);
  const subtotal = selectedItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  async function useCurrentLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      setLocationText("Location permission denied.");
      return;
    }
    const current = await Location.getCurrentPositionAsync({});
    setLocationText(`Near ${current.coords.latitude.toFixed(4)}, ${current.coords.longitude.toFixed(4)}`);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Choose Laundry Shop</Text>
          <Pressable onPress={useCurrentLocation}>
            <Text style={styles.linkText}>Use location</Text>
          </Pressable>
        </View>
        {locationText ? <Text style={styles.muted}>{locationText}</Text> : null}
        {shops.length === 0 ? <Text style={styles.muted}>No approved shops yet.</Text> : null}
        {shops.map((shop) => (
          <Pressable key={shop.id} style={[styles.listItem, selectedShop?.id === shop.id && styles.selectedItem]} onPress={() => setSelectedShopId(shop.id)}>
            <Text style={styles.itemTitle}>{shop.name}</Text>
            <Text style={styles.muted}>{shop.address}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Cleaning Services</Text>
        {availableServices.length === 0 ? <Text style={styles.muted}>This shop has not published services yet.</Text> : null}
        {availableServices.map((service) => (
          <View key={service.id} style={styles.serviceRow}>
            <View style={styles.serviceInfo}>
              <Text style={styles.itemTitle}>{service.name}</Text>
              <Text style={styles.muted}>{money(service.price)} per {service.pricing_unit}</Text>
            </View>
            <TextInput
              value={quantities[service.id] ? String(quantities[service.id]) : ""}
              onChangeText={(value) => setQuantities((current) => ({ ...current, [service.id]: Number(value) || 0 }))}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#64748b"
              style={styles.quantityInput}
            />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Pickup Details</Text>
        <View style={styles.twoColumns}>
          <Pressable style={[styles.choice, fulfillment === "pickup" && styles.choiceActive]} onPress={() => setFulfillment("pickup")}>
            <Text style={[styles.choiceText, fulfillment === "pickup" && styles.choiceTextActive]}>Pickup</Text>
          </Pressable>
          <Pressable style={[styles.choice, fulfillment === "drop_off" && styles.choiceActive]} onPress={() => setFulfillment("drop_off")}>
            <Text style={[styles.choiceText, fulfillment === "drop_off" && styles.choiceTextActive]}>Drop-off</Text>
          </Pressable>
        </View>
        <TextInput value={address} onChangeText={setAddress} placeholder="Address" multiline style={[styles.input, styles.textArea]} placeholderTextColor="#64748b" />
        <TextInput value={notes} onChangeText={setNotes} placeholder="Notes" multiline style={[styles.input, styles.textArea]} placeholderTextColor="#64748b" />
        <View style={styles.totalBox}>
          <View style={styles.rowBetween}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text style={styles.itemTitle}>{money(subtotal)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.muted}>Estimated tax</Text>
            <Text style={styles.itemTitle}>{money(subtotal * 0.05)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Total</Text>
            <Text style={styles.sectionTitle}>{money(subtotal * 1.05)}</Text>
          </View>
        </View>
        <Pressable
          disabled={saving || !selectedShop || selectedItems.length === 0 || !address}
          style={[styles.primaryButton, (saving || !selectedShop || selectedItems.length === 0 || !address) && styles.disabled]}
          onPress={() => {
            if (!selectedShop) return;
            onCreate({
              customer_id: profile.id,
              shop_id: selectedShop.id,
              items: selectedItems,
              fulfillment,
              address,
              notes,
              payment_method: "cash",
            });
            setQuantities({});
            setNotes("");
          }}
        >
          <Text style={styles.primaryButtonText}>{saving ? "Placing order..." : "Place Order"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function TrackingScreen({ orders }: { orders: Order[] }) {
  const steps = ["received", "washing", "drying", "ironing", "ready", "completed"];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {orders.length === 0 ? <Text style={styles.empty}>No active orders.</Text> : null}
      {orders.map((order) => {
        const index = steps.indexOf(order.status === "out_for_delivery" ? "ready" : order.status);
        return (
          <View key={order.id} style={styles.card}>
            <Text style={styles.sectionTitle}>{order.order_number || order.id.slice(0, 8)}</Text>
            <Text style={styles.muted}>{order.shop?.name || "Laundry shop"} · {money(order.final_amount || order.total_price)}</Text>
            <View style={styles.timeline}>
              {steps.map((step, stepIndex) => (
                <View key={step} style={[styles.timelineStep, stepIndex <= index && styles.timelineStepActive]}>
                  <Text style={[styles.timelineText, stepIndex <= index && styles.timelineTextActive]}>{statusLabel(step)}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function HistoryScreen({ orders }: { orders: Order[] }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {orders.length === 0 ? <Text style={styles.empty}>No order history yet.</Text> : null}
      {orders.map((order) => (
        <View key={order.id} style={styles.card}>
          <Text style={styles.sectionTitle}>{order.order_number || order.id.slice(0, 8)}</Text>
          <Text style={styles.muted}>{order.shop?.name || "Laundry shop"} · {new Date(order.created_at).toLocaleDateString()}</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.badge}>{statusLabel(order.status)}</Text>
            <Text style={styles.itemTitle}>{money(order.final_amount || order.total_price)}</Text>
          </View>
          <Text style={styles.muted}>Payment {order.payment_status}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function ProfileScreen({
  profile,
  saving,
  onSave,
}: {
  profile: Profile;
  saving: boolean;
  onSave: (input: { id: string; name: string; phone?: string; address?: string }) => void;
}) {
  const [name, setName] = useState(profile.name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [address, setAddress] = useState(profile.address || "");

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Name" style={styles.input} placeholderTextColor="#64748b" />
        <TextInput value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" style={styles.input} placeholderTextColor="#64748b" />
        <TextInput value={address} onChangeText={setAddress} placeholder="Address" multiline style={[styles.input, styles.textArea]} placeholderTextColor="#64748b" />
        <Pressable disabled={saving} style={[styles.primaryButton, saving && styles.disabled]} onPress={() => onSave({ id: profile.id, name, phone, address })}>
          <Text style={styles.primaryButtonText}>{saving ? "Saving..." : "Save Profile"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  centerScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f1f5f9",
  },
  authBody: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  header: {
    padding: 18,
    backgroundColor: "#ffffff",
    borderBottomColor: "#e2e8f0",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  logoText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
  },
  authTitle: {
    textAlign: "center",
    color: "#0f172a",
    fontSize: 32,
    fontWeight: "900",
  },
  authSubtitle: {
    textAlign: "center",
    color: "#475569",
    marginTop: 8,
    marginBottom: 24,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 16,
    borderColor: "#e2e8f0",
    borderWidth: 1,
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 8,
    textTransform: "capitalize",
  },
  muted: {
    color: "#64748b",
  },
  error: {
    margin: 12,
    color: "#b91c1c",
    backgroundColor: "#fee2e2",
    padding: 10,
    borderRadius: 8,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: "#ffffff",
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  activeTab: {
    backgroundColor: "#2563eb",
  },
  tabText: {
    color: "#334155",
    fontWeight: "700",
    textTransform: "capitalize",
    fontSize: 12,
  },
  activeTabText: {
    color: "#ffffff",
  },
  input: {
    minHeight: 48,
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#0f172a",
    backgroundColor: "#ffffff",
    marginBottom: 12,
  },
  textArea: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  ghostButton: {
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  ghostButtonText: {
    color: "#1d4ed8",
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.5,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 4,
    marginBottom: 14,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    borderRadius: 6,
    paddingVertical: 10,
  },
  segmentActive: {
    backgroundColor: "#ffffff",
  },
  segmentText: {
    color: "#64748b",
    fontWeight: "800",
  },
  segmentTextActive: {
    color: "#0f172a",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  linkText: {
    color: "#2563eb",
    fontWeight: "800",
  },
  listItem: {
    padding: 12,
    borderRadius: 8,
    borderColor: "#e2e8f0",
    borderWidth: 1,
    marginTop: 10,
  },
  selectedItem: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  itemTitle: {
    color: "#0f172a",
    fontWeight: "800",
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    gap: 10,
  },
  serviceInfo: {
    flex: 1,
  },
  quantityInput: {
    width: 72,
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: "#0f172a",
    textAlign: "center",
  },
  twoColumns: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  choice: {
    flex: 1,
    alignItems: "center",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  choiceActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
  },
  choiceText: {
    color: "#334155",
    fontWeight: "800",
  },
  choiceTextActive: {
    color: "#1d4ed8",
  },
  totalBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  empty: {
    color: "#64748b",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 8,
    borderColor: "#e2e8f0",
    borderWidth: 1,
  },
  badge: {
    overflow: "hidden",
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    textTransform: "capitalize",
  },
  timeline: {
    gap: 8,
    marginTop: 14,
  },
  timelineStep: {
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  timelineStepActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  timelineText: {
    color: "#64748b",
    textTransform: "capitalize",
  },
  timelineTextActive: {
    color: "#1d4ed8",
    fontWeight: "800",
  },
});
