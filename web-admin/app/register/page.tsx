"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Lock, User, Loader2 } from "lucide-react";

export default function RegisterPage() {

  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");

  return (

    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">

      {/* floating bubbles */}
      <div className="absolute w-72 h-72 bg-blue-500/20 blur-3xl rounded-full top-10 left-10 animate-pulse"></div>
      <div className="absolute w-72 h-72 bg-indigo-500/20 blur-3xl rounded-full bottom-20 right-20 animate-pulse"></div>
      <div className="absolute w-60 h-60 bg-sky-400/20 blur-3xl rounded-full bottom-40 left-40 animate-pulse"></div>

      {/* container */}
      <div className="flex w-[850px] h-[520px] rounded-3xl overflow-hidden shadow-2xl border border-white/20 backdrop-blur-xl bg-white/10">

        {/* left section */}
        <div className="w-1/2 flex flex-col justify-center items-center text-white p-10 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-900">

          <Loader2 size={60} className="animate-spin mb-6 text-blue-400" />

          <h1 className="text-4xl font-bold mb-4">
            WASHWARE
          </h1>

          <p className="text-slate-300 text-center max-w-xs">
            Create your account and start managing laundry orders easily.
          </p>

        </div>

        {/* right section */}
        <div className="w-1/2 flex items-center justify-center bg-white/70 backdrop-blur-md">

          <div className="w-[320px]">

            <h2 className="text-2xl font-bold mb-8 text-slate-800">
              Create Account
            </h2>

            <form className="space-y-6">

              <div className="relative">

                <User
                  size={18}
                  className="absolute left-3 top-4 text-gray-400"
                />

                <input
                  type="text"
                  placeholder="Full name"
                  className="w-full pl-10 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  value={name}
                  onChange={(e)=>setName(e.target.value)}
                />

              </div>

              <div className="relative">

                <Mail
                  size={18}
                  className="absolute left-3 top-4 text-gray-400"
                />

                <input
                  type="email"
                  placeholder="Email address"
                  className="w-full pl-10 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  value={email}
                  onChange={(e)=>setEmail(e.target.value)}
                />

              </div>

              <div className="relative">

                <Lock
                  size={18}
                  className="absolute left-3 top-4 text-gray-400"
                />

                <input
                  type="password"
                  placeholder="Password"
                  className="w-full pl-10 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  value={password}
                  onChange={(e)=>setPassword(e.target.value)}
                />

              </div>

              <button className="w-full py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-md">
                Create Account
              </button>

            </form>

            <p className="text-sm text-gray-500 mt-6 text-center">
              Already have an account?
              <Link href="/login" className="text-blue-600 ml-1">
                Login
              </Link>
            </p>

          </div>

        </div>

      </div>

    </div>

  );
}