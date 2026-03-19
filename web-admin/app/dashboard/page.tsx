"use client";

import { useState, useEffect } from "react";
import { 
  ShoppingCart, 
  Clock, 
  CheckCircle, 
  DollarSign,
  Menu,
  X,
  Search,
  Bell,
  Sun,
  Moon,
  User,
  LogOut,
  Settings,
  TrendingUp,
  Package,
  Users,
  FileText,
  ChevronRight,
  Activity,
  AlertCircle
} from "lucide-react";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ProtectedRoute } from "@/lib/protected-route";

interface Order {
  id: string;
  customer: string;
  service: string;
  status: "pending" | "washing" | "drying" | "completed";
  amount: string;
  machineId?: string;
}

interface Machine {
  id: string;
  name: string;
  status: "available" | "in-use" | "maintenance";
  progress?: number;
  currentOrder?: string;
}

function DashboardContent() {
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [highlightedMachine, setHighlightedMachine] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Stats data
  const [stats, setStats] = useState({
    totalOrders: 128,
    pendingOrders: 24,
    completedOrders: 104,
    revenue: "250,000 CFA"
  });

  // Orders data
  const [orders, setOrders] = useState<Order[]>([
    { id: "#ORD-001", customer: "John Doe", service: "Washing + Drying", status: "washing", amount: "5,000 CFA", machineId: "WM-001" },
    { id: "#ORD-002", customer: "Grace Smith", service: "Dry Cleaning", status: "completed", amount: "8,000 CFA" },
    { id: "#ORD-003", customer: "Michael Johnson", service: "Washing Only", status: "pending", amount: "4,000 CFA" },
    { id: "#ORD-004", customer: "Sarah Williams", service: "Full Service", status: "drying", amount: "12,000 CFA", machineId: "WM-003" },
    { id: "#ORD-005", customer: "David Brown", service: "Ironing", status: "pending", amount: "3,000 CFA" },
  ]);

  // Machines data
  const [machines, setMachines] = useState<Machine[]>([
    { id: "WM-001", name: "Washing Machine 1", status: "in-use", progress: 65, currentOrder: "#ORD-001" },
    { id: "WM-002", name: "Washing Machine 2", status: "available" },
    { id: "WM-003", name: "Washing Machine 3", status: "in-use", progress: 40, currentOrder: "#ORD-004" },
    { id: "DR-001", name: "Dryer 1", status: "maintenance" },
    { id: "DR-002", name: "Dryer 2", status: "available" },
    { id: "DR-003", name: "Dryer 3", status: "in-use", progress: 80, currentOrder: "#ORD-001" },
  ]);

  // Chart data
  const ordersChartData = [
    { day: "Mon", orders: 12 },
    { day: "Tue", orders: 19 },
    { day: "Wed", orders: 15 },
    { day: "Thu", orders: 25 },
    { day: "Fri", orders: 22 },
    { day: "Sat", orders: 30 },
    { day: "Sun", orders: 18 },
  ];

  const machineStatusData = [
    { name: "Available", value: machines.filter(m => m.status === "available").length, color: "#10b981" },
    { name: "In Use", value: machines.filter(m => m.status === "in-use").length, color: "#3b82f6" },
    { name: "Maintenance", value: machines.filter(m => m.status === "maintenance").length, color: "#f59e0b" },
  ];

  // Notifications
  const notifications = [
    { id: 1, text: "New order received from John Doe", time: "2 min ago", read: false },
    { id: 2, text: "Machine WM-001 completed cycle", time: "5 min ago", read: false },
    { id: 3, text: "Payment received for order #ORD-002", time: "10 min ago", read: true },
  ];

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMachines(prev => prev.map(machine => {
        if (machine.status === "in-use" && machine.progress !== undefined) {
          const newProgress = Math.min(100, machine.progress + Math.random() * 5);
          if (newProgress >= 100) {
            return { ...machine, status: "available", progress: undefined, currentOrder: undefined };
          }
          return { ...machine, progress: newProgress };
        }
        return machine;
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Handle order click
  const handleOrderClick = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order?.machineId) {
      setHighlightedMachine(order.machineId);
      setToastMessage(`Order ${orderId} assigned to ${order.machineId}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
    setSelectedOrder(orderId);
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      washing: "bg-blue-100 text-blue-800 border-blue-200",
      drying: "bg-purple-100 text-purple-800 border-purple-200",
      completed: "bg-green-100 text-green-800 border-green-200",
      "in-use": "bg-blue-100 text-blue-800 border-blue-200",
      available: "bg-green-100 text-green-800 border-green-200",
      maintenance: "bg-orange-100 text-orange-800 border-orange-200",
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[status as keyof typeof styles]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ")}
      </span>
    );
  };

  const sidebarItems = [
    { icon: TrendingUp, label: "Dashboard", active: true },
    { icon: ShoppingCart, label: "Orders" },
    { icon: Package, label: "Machines" },
    { icon: Users, label: "Customers" },
    { icon: FileText, label: "Reports" },
    { icon: Settings, label: "Settings" },
  ];

  return (
    <div className={`min-h-screen ${darkMode ? "bg-slate-900" : "bg-slate-50"}`}>
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 animate-pulse">
          <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <CheckCircle size={20} />
            {toastMessage}
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full ${darkMode ? "bg-slate-800" : "bg-white"} shadow-xl z-40 transition-all duration-300 ${sidebarOpen ? "w-64" : "w-20"} lg:w-64 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-10">
            <h1 className={`text-2xl font-bold ${sidebarOpen ? "block" : "hidden"} ${darkMode ? "text-white" : "text-slate-900"}`}>
              WASHWARE
            </h1>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-slate-500 hover:text-slate-700"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          <nav className="space-y-2">
            {sidebarItems.map((item, index) => (
              <a
                key={index}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  item.active
                    ? "bg-blue-600 text-white shadow-md"
                    : darkMode
                    ? "text-slate-300 hover:bg-slate-700 hover:text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <item.icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "lg:ml-20"}`}>
        {/* Header */}
        <header className={`${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"} border-b sticky top-0 z-30 shadow-sm`}>
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4 flex-1">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-slate-500 hover:text-slate-700"
              >
                <Menu size={24} />
              </button>
              
              <div className="relative max-w-md flex-1">
                <Search
                  size={18}
                  className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${darkMode ? "text-slate-400" : "text-slate-500"}`}
                />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg border ${darkMode ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400" : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-500"} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg ${darkMode ? "hover:bg-slate-700 text-yellow-400" : "hover:bg-slate-100 text-slate-600"} transition`}
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className={`p-2 rounded-lg ${darkMode ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-100 text-slate-600"} transition relative`}
                >
                  <Bell size={20} />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>

                {notificationsOpen && (
                  <div className={`absolute right-0 mt-2 w-80 rounded-lg shadow-xl ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"} border`}>
                    <div className="p-4 border-b border-slate-200">
                      <h3 className={`font-semibold ${darkMode ? "text-white" : "text-slate-900"}`}>Notifications</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map(notif => (
                        <div key={notif.id} className={`p-4 border-b ${darkMode ? "border-slate-700 hover:bg-slate-700" : "border-slate-100 hover:bg-slate-50"} transition`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-2 ${notif.read ? "bg-slate-300" : "bg-blue-600"}`}></div>
                            <div className="flex-1">
                              <p className={`text-sm ${darkMode ? "text-white" : "text-slate-900"}`}>{notif.text}</p>
                              <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"} mt-1`}>{notif.time}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`flex items-center gap-2 p-2 rounded-lg ${darkMode ? "hover:bg-slate-700" : "hover:bg-slate-100"} transition`}
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <User size={16} className="text-white" />
                  </div>
                  <ChevronRight size={16} className={`${darkMode ? "text-slate-400" : "text-slate-500"}`} />
                </button>

                {userMenuOpen && (
                  <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-xl ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"} border`}>
                    <a className={`flex items-center gap-3 px-4 py-3 ${darkMode ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-50 text-slate-700"} transition`}>
                      <User size={16} />
                      Profile
                    </a>
                    <a className={`flex items-center gap-3 px-4 py-3 ${darkMode ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-50 text-slate-700"} transition`}>
                      <Settings size={16} />
                      Settings
                    </a>
                    <hr className={`${darkMode ? "border-slate-700" : "border-slate-200"}`} />
                    <a className={`flex items-center gap-3 px-4 py-3 ${darkMode ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-50 text-slate-700"} transition`}>
                      <LogOut size={16} />
                      Logout
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-6">
          <h2 className={`text-3xl font-bold mb-8 ${darkMode ? "text-white" : "text-slate-900"}`}>
            Laundry Dashboard
          </h2>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className={`${darkMode ? "bg-slate-800" : "bg-white"} p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-1`}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <ShoppingCart className="text-blue-600" size={24} />
                </div>
                <div>
                  <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Total Orders</p>
                  <h3 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>{stats.totalOrders}</h3>
                </div>
              </div>
            </div>

            <div className={`${darkMode ? "bg-slate-800" : "bg-white"} p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-1`}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock className="text-yellow-600" size={24} />
                </div>
                <div>
                  <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Pending Orders</p>
                  <h3 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>{stats.pendingOrders}</h3>
                </div>
              </div>
            </div>

            <div className={`${darkMode ? "bg-slate-800" : "bg-white"} p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-1`}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="text-green-600" size={24} />
                </div>
                <div>
                  <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Completed</p>
                  <h3 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>{stats.completedOrders}</h3>
                </div>
              </div>
            </div>

            <div className={`${darkMode ? "bg-slate-800" : "bg-white"} p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-1`}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <DollarSign className="text-purple-600" size={24} />
                </div>
                <div>
                  <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Revenue</p>
                  <h3 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>{stats.revenue}</h3>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className={`${darkMode ? "bg-slate-800" : "bg-white"} p-6 rounded-xl shadow-md`}>
              <h3 className={`text-lg font-semibold mb-4 ${darkMode ? "text-white" : "text-slate-900"}`}>
                Orders Over Last 7 Days
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={ordersChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#475569" : "#e2e8f0"} />
                  <XAxis dataKey="day" stroke={darkMode ? "#94a3b8" : "#64748b"} />
                  <YAxis stroke={darkMode ? "#94a3b8" : "#64748b"} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: darkMode ? "#1e293b" : "#ffffff",
                      border: `1px solid ${darkMode ? "#475569" : "#e2e8f0"}`,
                      borderRadius: "8px"
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="orders" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className={`${darkMode ? "bg-slate-800" : "bg-white"} p-6 rounded-xl shadow-md`}>
              <h3 className={`text-lg font-semibold mb-4 ${darkMode ? "text-white" : "text-slate-900"}`}>
                Machine Status
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={machineStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {machineStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-4">
                {machineStatusData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className={`text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                      {item.name}: {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Orders Table */}
          <div className={`${darkMode ? "bg-slate-800" : "bg-white"} p-6 rounded-xl shadow-md mb-8`}>
            <h3 className={`text-lg font-semibold mb-4 ${darkMode ? "text-white" : "text-slate-900"}`}>
              Recent Orders
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
                    <th className={`text-left py-3 px-4 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Order ID</th>
                    <th className={`text-left py-3 px-4 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Customer</th>
                    <th className={`text-left py-3 px-4 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Service</th>
                    <th className={`text-left py-3 px-4 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Status</th>
                    <th className={`text-left py-3 px-4 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => (
                    <tr
                      key={index}
                      className={`border-b ${darkMode ? "border-slate-700 hover:bg-slate-700" : "border-slate-100 hover:bg-slate-50"} transition cursor-pointer ${selectedOrder === order.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
                      onClick={() => handleOrderClick(order.id)}
                    >
                      <td className={`py-3 px-4 ${darkMode ? "text-white" : "text-slate-900"}`}>{order.id}</td>
                      <td className={`py-3 px-4 ${darkMode ? "text-white" : "text-slate-900"}`}>{order.customer}</td>
                      <td className={`py-3 px-4 ${darkMode ? "text-white" : "text-slate-900"}`}>{order.service}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className={`py-3 px-4 ${darkMode ? "text-white" : "text-slate-900"}`}>{order.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Machine Status Grid */}
          <div className={`${darkMode ? "bg-slate-800" : "bg-white"} p-6 rounded-xl shadow-md`}>
            <h3 className={`text-lg font-semibold mb-4 ${darkMode ? "text-white" : "text-slate-900"}`}>
              Machine Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {machines.map((machine, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${darkMode ? "border-slate-700" : "border-slate-200"} ${highlightedMachine === machine.id ? "ring-2 ring-blue-500 ring-opacity-50" : ""} transition-all duration-200 hover:shadow-md`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className={`font-medium ${darkMode ? "text-white" : "text-slate-900"}`}>{machine.name}</h4>
                    <StatusBadge status={machine.status} />
                  </div>
                  {machine.status === "in-use" && machine.progress !== undefined && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={darkMode ? "text-slate-400" : "text-slate-600"}>Progress</span>
                        <span className={darkMode ? "text-slate-400" : "text-slate-600"}>{Math.round(machine.progress)}%</span>
                      </div>
                      <div className={`w-full ${darkMode ? "bg-slate-700" : "bg-slate-200"} rounded-full h-2`}>
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${machine.progress}%` }}
                        ></div>
                      </div>
                      {machine.currentOrder && (
                        <p className={`text-xs mt-2 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                          Order: {machine.currentOrder}
                        </p>
                      )}
                    </div>
                  )}
                  {machine.status === "maintenance" && (
                    <div className="flex items-center gap-2 text-orange-600">
                      <AlertCircle size={16} />
                      <span className="text-sm">Under maintenance</span>
                    </div>
                  )}
                  {machine.status === "available" && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle size={16} />
                      <span className="text-sm">Ready to use</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
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
