"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Phone } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Logo from "@/app/components/Logo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithEmail, signInWithPhone, verifyPhoneOTP } = useAuth();

  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState(searchParams.get('message') || "");

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      if (!email || !password) {
        throw new Error("Please fill in all fields");
      }

      const { error: loginError } = await signInWithEmail(email, password);

      if (loginError) throw new Error(loginError);

      // Redirect to dashboard on successful login
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      if (!phone) {
        throw new Error("Please enter your phone number");
      }

      if (!otpSent) {
        // Send OTP
        const { error: otpError } = await signInWithPhone(phone);
        if (otpError) throw new Error(otpError);
        setOtpSent(true);
      } else {
        // Verify OTP
        if (!otp) {
          throw new Error("Please enter the OTP");
        }

        const { error: verifyError } = await verifyPhoneOTP(phone, otp);
        if (verifyError) throw new Error(verifyError);

        // Redirect to dashboard on successful login
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* floating bubbles */}
      <div className="absolute w-72 h-72 bg-blue-500/20 blur-3xl rounded-full top-10 left-10 animate-pulse"></div>
      <div className="absolute w-72 h-72 bg-indigo-500/20 blur-3xl rounded-full bottom-20 right-20 animate-pulse"></div>
      <div className="absolute w-60 h-60 bg-sky-400/20 blur-3xl rounded-full bottom-40 left-40 animate-pulse"></div>

      {/* main container */}
      <div className="flex w-[900px] h-[580px] rounded-3xl overflow-hidden shadow-2xl border border-white/20 backdrop-blur-xl bg-white/10">
        {/* left section */}
        <div className="w-1/2 flex flex-col justify-center items-center text-white p-10 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-900 relative">
          <div className="mb-6">
            <Logo />
          </div>
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

            {/* Auth Method Toggle */}
            <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('email');
                  setOtpSent(false);
                  setOtp("");
                  setError("");
                  setSuccessMessage("");
                }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
                  authMethod === 'email'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('phone');
                  setOtpSent(false);
                  setOtp("");
                  setError("");
                  setSuccessMessage("");
                }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
                  authMethod === 'phone'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Phone
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-100 text-red-700 text-sm mb-4">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-lg bg-green-100 text-green-700 text-sm mb-4">
                {successMessage}
              </div>
            )}

            {authMethod === 'email' ? (
              <form className="space-y-6" onSubmit={handleEmailLogin}>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-4 text-gray-400" />
                  <input
                    type="email"
                    placeholder="Email address"
                    className="w-full pl-10 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-4 text-gray-400" />
                  <input
                    type="password"
                    placeholder="Password"
                    className="w-full pl-10 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>
            ) : (
              <form className="space-y-6" onSubmit={handlePhoneLogin}>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-4 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="Phone number (e.g., +1234567890)"
                    className="w-full pl-10 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading || otpSent}
                  />
                </div>

                {otpSent && (
                  <div className="relative">
                    <Lock size={18} className="absolute left-3 top-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      className="w-full pl-10 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                      disabled={loading}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? (otpSent ? "Verifying..." : "Sending OTP...")
                    : (otpSent ? "Verify & Login" : "Send OTP")
                  }
                </button>

                {otpSent && (
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp("");
                      setError("");
                    }}
                    className="w-full py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                  >
                    Change Phone Number
                  </button>
                )}
              </form>
            )}

            <p className="text-sm text-gray-500 mt-6 text-center">
              Don&apos;t have an account?
              <Link href="/register" className="text-blue-600 ml-1">
                Register
              </Link>
            </p>

            {authMethod === 'email' && (
              <p className="text-sm text-gray-500 mt-4 text-center">
                <Link href="/forgot-password" className="text-blue-600 hover:underline">
                  Forgot your password?
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
