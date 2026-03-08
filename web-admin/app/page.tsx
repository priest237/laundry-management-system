import Navbar from "./components/Navbar";

export default function Home() {

  return (
    <div className="bg-slate-50 min-h-screen">

      <Navbar />

      <div className="absolute w-96 h-96 bg-blue-400/20 blur-3xl rounded-full -top-20 -left-20 animate-pulse"></div>
<div className="absolute w-96 h-96 bg-indigo-400/20 blur-3xl rounded-full bottom-0 right-0 animate-pulse"></div>

      <section className="flex flex-col md:flex-row items-center justify-between px-8 py-20 max-w-7xl mx-auto">

        <div className="max-w-xl">

         <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
  Smart Laundry
  <br />
  Management
  <span className="text-blue-600"> Made Simple</span>
</h1>

<p className="text-slate-600 mb-8 text-lg">
  WASHWARE helps laundromats track orders,
  manage customers, and streamline laundry operations
  with a modern digital system.
</p>

          <div className="flex flex-wrap gap-4">

  <a
    href="/login"
    className="bg-blue-600 text-white px-8 py-3 rounded-lg shadow hover:bg-blue-700 hover:scale-105 transition"
  >
    Login
  </a>

  <a
    href="/register"
    className="border border-blue-600 text-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 hover:scale-105 transition"
  >
    Create Account
  </a>

</div>

        </div>

        <img
          src="https://images.unsplash.com/photo-1604335399105-a0c585fd81a1"
          className="rounded-xl shadow-lg mt-10 md:mt-0 w-full md:w-1/2"
        />

      </section>

      <section className="bg-white py-20">

        <h2 className="text-3xl font-bold text-center mb-12">
          Features
        </h2>

        <div className="p-6 bg-white rounded-xl shadow hover:shadow-xl transition hover:-translate-y-1">

          <div className="p-6 bg-white rounded-xl shadow hover:shadow-xl transition hover:-translate-y-1">
            <h3 className="text-xl font-semibold text-blue-600 mb-2">
              Order Management
            </h3>
            <p className="text-slate-600">
              Track laundry orders from drop-off to delivery.
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl shadow hover:shadow-xl transition hover:-translate-y-1">
            <h3 className="text-xl font-semibold text-blue-600 mb-2">
              Customer Records
            </h3>
            <p className="text-slate-600">
              Maintain a database of customers and their laundry history.
            </p>
          </div>

          <div className="p-6 bg-white rounded-xl shadow hover:shadow-xl transition hover:-translate-y-1">
            <h3 className="text-xl font-semibold text-blue-600 mb-2">
              Status Tracking
            </h3>
            <p className="text-slate-600">
              Update washing, drying, and delivery status.
            </p>
          </div>

        </div>

      </section>

    </div>
  );
}