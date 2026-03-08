
"use client";

import { Shirt, Package, Users, DollarSign } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* SIDEBAR */}
      <div className="w-64 bg-slate-900 text-white p-6 shadow-xl">

        <h1 className="text-2xl font-bold mb-10 text-center">
          WASHWARE
        </h1>

        <nav className="space-y-6">

          <a className="flex items-center gap-3 hover:text-cyan-400 cursor-pointer">
            <Shirt size={20}/>
            Orders
          </a>

          <a className="flex items-center gap-3 hover:text-cyan-400 cursor-pointer">
            <Users size={20}/>
            Customers
          </a>

          <a className="flex items-center gap-3 hover:text-cyan-400 cursor-pointer">
            <Package size={20}/>
            Laundry Items
          </a>

          <a className="flex items-center gap-3 hover:text-cyan-400 cursor-pointer">
            <DollarSign size={20}/>
            Payments
          </a>

        </nav>
      </div>


      {/* MAIN CONTENT */}
      <div className="flex-1 p-10">

        <h2 className="text-3xl font-bold mb-8 text-gray-800">
          Laundry Dashboard
        </h2>

        {/* STAT CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center gap-4">
              <Shirt className="text-blue-500" size={32}/>
              <div>
                <p className="text-gray-500 text-sm">Orders</p>
                <h3 className="text-2xl font-bold">128</h3>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center gap-4">
              <Users className="text-green-500" size={32}/>
              <div>
                <p className="text-gray-500 text-sm">Customers</p>
                <h3 className="text-2xl font-bold">64</h3>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center gap-4">
              <Package className="text-purple-500" size={32}/>
              <div>
                <p className="text-gray-500 text-sm">Laundry Items</p>
                <h3 className="text-2xl font-bold">312</h3>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex items-center gap-4">
              <DollarSign className="text-yellow-500" size={32}/>
              <div>
                <p className="text-gray-500 text-sm">Revenue</p>
                <h3 className="text-2xl font-bold">250,000 CFA</h3>
              </div>
            </div>
          </div>

        </div>


        {/* RECENT ORDERS */}
        <div className="mt-12 bg-white p-6 rounded-xl shadow-md">

          <h3 className="text-xl font-semibold mb-4">
            Recent Laundry Orders
          </h3>

          <table className="w-full text-left">

            <thead>
              <tr className="border-b">
                <th className="py-2">Customer</th>
                <th>Item</th>
                <th>Status</th>
                <th>Price</th>
              </tr>
            </thead>

            <tbody className="text-gray-600">

              <tr className="border-b">
                <td className="py-3">John</td>
                <td>Shirts</td>
                <td className="text-yellow-500">Washing</td>
                <td>5,000 CFA</td>
              </tr>

              <tr className="border-b">
                <td className="py-3">Grace</td>
                <td>Blanket</td>
                <td className="text-green-500">Completed</td>
                <td>8,000 CFA</td>
              </tr>

              <tr>
                <td className="py-3">Michael</td>
                <td>Trousers</td>
                <td className="text-blue-500">Ready</td>
                <td>4,000 CFA</td>
              </tr>

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}