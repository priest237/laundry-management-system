"use client";

import { useState } from "react";

export default function ForgotPassword() {

  const [email,setEmail]=useState("");

  const handleReset=(e:any)=>{
    e.preventDefault();
    alert("Password reset link sent (Demo)");
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 px-4">

      <form
        onSubmit={handleReset}
        className="bg-white p-8 rounded-xl shadow-md w-full max-w-md"
      >

        <h1 className="text-2xl font-bold text-center mb-6">
          Reset Password
        </h1>

        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          className="w-full p-3 border rounded mb-6"
          required
        />

        <button className="w-full bg-blue-600 text-white py-3 rounded-lg">
          Send Reset Link
        </button>

      </form>

    </div>
  );
}