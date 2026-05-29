import Link from "next/link";
import Logo from "./Logo";

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center px-8 py-4 bg-white/90 text-slate-950 backdrop-blur-md shadow-sm sticky top-0 z-50">

      <Logo />

      <div className="flex gap-6 font-medium">
        <Link href="/login" className="text-slate-800 hover:text-blue-700 transition">
          Login
        </Link>

        <Link
          href="/register"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow"
        >
          Register
        </Link>
      </div>

    </nav>
  );
}
