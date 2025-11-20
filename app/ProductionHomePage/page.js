// app/ProductionHomePage/page.js
import Link from "next/link";
import { dbConnect } from "@/services/mongo";
import { ProductionHeaderModel } from "@/models/ProductionHeader-model";
import { HourlyProductionModel } from "@/models/HourlyProduction-model";
import ProductionInputForm from "@/app/ProductionComponents/HourlyProductionInput";
import WorkingHourWrapper from "@/app/ProductionComponents/WorkingHourWrapper";

// 🔹 Generic safe serializer for any Mongoose result
function safeJson(docs) {
  return JSON.parse(JSON.stringify(docs ?? []));
}

// Optional: uncomment if you want zero caching on this page
// export const revalidate = 0;

export default async function ProductionHomePage() {
  // 🔹 Ensure DB is connected for both header + hourly queries
  await dbConnect();

  // 🔹 Get the latest header
  const docs = await ProductionHeaderModel.find()
    .sort({ createdAt: -1 })
    .limit(1)
    .lean();

  const headerDoc = docs[0] || null;
  const header = headerDoc ? JSON.parse(JSON.stringify(headerDoc)) : null;

  // 🔹 Load all hourly production docs and serialize for client use
  const hourlyDocs = await HourlyProductionModel.find({}).lean();
  const hourlyData = safeJson(hourlyDocs);

  return (
    <main className="min-h-screen bg-slate-50 py-6">
      <div className="mx-auto max-w-7xl px-3 space-y-4">
        {/* Page header */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
              Production Dashboard
            </h1>
            <p className="text-sm text-slate-600">
              Set today&apos;s production header and track hourly performance.
            </p>
          </div>

          {/* 🔹 Navigate to /ProductionHourlyView (TV view) */}
          <Link
            href="/ProductionHourlyView"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-100 hover:border-slate-400 transition-colors"
          >
            View Hourly Summary (TV)
          </Link>
        </header>

        {/* 🔹 Main layout: LEFT = Production Header Input, RIGHT = Working hour + chart */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] items-start">
          {/* LEFT: Production input form */}
          <div className="w-full">
            {/* Optional: sticky on large screens to keep form visible */}
            <div className="lg:sticky lg:top-4">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3 sm:p-4">
                <h2 className="text-sm font-semibold text-slate-900 mb-2">
                  Production Header Input
                </h2>
                <p className="text-[11px] text-slate-500 mb-3">
                  Update today&apos;s production header (manpower, SMV, plan
                  efficiency, etc.). Changes will reflect on the right panel.
                </p>
                <ProductionInputForm />
              </div>
            </div>
          </div>

          {/* RIGHT: Working hour + chart (inside WorkingHourCard) */}
          <div className="space-y-4">
            <WorkingHourWrapper initialHeader={header} hourlyData={hourlyData} />
          </div>
        </section>
      </div>
    </main>
  );
}
