"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Lock, Loader2 } from "lucide-react";


export default function LoginPage() {

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");

  return (

    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">

      {/* floating bubbles */}
      <div className="absolute w-72 h-72 bg-blue-500/20 blur-3xl rounded-full top-10 left-10 animate-pulse"></div>
      <div className="absolute w-72 h-72 bg-indigo-500/20 blur-3xl rounded-full bottom-20 right-20 animate-pulse"></div>
      <div className="absolute w-60 h-60 bg-sky-400/20 blur-3xl rounded-full bottom-40 left-40 animate-pulse"></div>

      {/* main container */}
      <div className="flex w-[850px] h-[520px] rounded-3xl overflow-hidden shadow-2xl border border-white/20 backdrop-blur-xl bg-white/10">

        {/* left section */}
        <div className="w-1/2 flex flex-col justify-center items-center text-white p-10 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-900 relative">

         

          <h1 className="text-4xl font-bold tracking-wide mb-4">
            WASHWARE
          </h1>

          <p className="text-slate-300 text-center max-w-xs">
            Smart laundry management system designed for modern laundromats.
          </p>

        </div>

        {/* right section */}
        <div className="w-1/2 flex items-center justify-center bg-white/70 backdrop-blur-md">

          <div className="w-[320px]">

            <h2 className="text-2xl font-bold mb-8 text-slate-800">
              Login to your account
            </h2>

            <form className="space-y-6">

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
                Login
              </button>

            </form>

            <p className="text-sm text-gray-500 mt-6 text-center">
              Don’t have an account?
              <Link href="/register" className="text-blue-600 ml-1">
                Register
              </Link>
            </p>

          </div>

        </div>

      </div>

    </div>

  );
}