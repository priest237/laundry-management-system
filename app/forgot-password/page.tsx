"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ForgotPassword() {

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      if (!email) {
        throw new Error("Please enter your email");
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      setSuccess(true);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden px-4">

      {/* floating bubbles */}
      <div className="absolute w-72 h-72 bg-blue-500/20 blur-3xl rounded-full top-10 left-10 animate-pulse"></div>
      <div className="absolute w-72 h-72 bg-indigo-500/20 blur-3xl rounded-full bottom-20 right-20 animate-pulse"></div>

      <form
        onSubmit={handleReset}
        className="bg-white/10 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-white/20 w-full max-w-md relative z-10"
      >

        <h1 className="text-3xl font-bold text-center mb-2 text-white">
          Reset Password
        </h1>

        <p className="text-slate-300 text-center mb-8 text-sm">
          Enter your email to receive a password reset link
        </p>

        {error && (
          <div className="p-3 rounded-lg bg-red-100 text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-green-100 text-green-700 text-sm mb-4">
            Password reset link sent! Check your email.
          </div>
        )}

        <div className="relative mb-6">
          <Mail
            size={18}
            className="absolute left-3 top-4 text-gray-400"
          />
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            required
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-blue-400 hover:underline text-sm">
            Back to Login
          </Link>
        </div>

      </form>

    </div>
  );
}