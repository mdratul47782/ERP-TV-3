// app/ProductionHomePage/page.js
import { dbConnect } from "@/services/mongo";
import { ProductionHeaderModel } from "@/models/ProductionHeader-model";
import ProductionInputForm from "@/app/ProductionComponents/HourlyProductionInput";
import WorkingHourWrapper from "@/app/ProductionComponents/WorkingHourWrapper";

export default async function ProductionHomePage() {
  await dbConnect();

  const docs = await ProductionHeaderModel.find()
    .sort({ createdAt: -1 })
    .limit(1)
    .lean();

  const headerDoc = docs[0] || null;
  const header = headerDoc ? JSON.parse(JSON.stringify(headerDoc)) : null;

  return (
    <main className="min-h-screen bg-slate-50 py-6">
      <div className="mx-auto max-w-7xl px-3 space-y-2">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-900">
            Production Dashboard
          </h1>
          <p className="text-sm text-slate-600">
            Set today&apos;s production header and track hourly performance.
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)]">
          <ProductionInputForm />
          <WorkingHourWrapper initialHeader={header} />
        </section>
      </div>
    </main>
  );
}