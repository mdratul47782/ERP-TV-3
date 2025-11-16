// app/ProductionComponents/WorkingHourWrapper.jsx
"use client";

import { Suspense } from "react";
import WorkingHourCard from "./WorkingHourCard";

export default function WorkingHourWrapper({ initialHeader }) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <WorkingHourCard header={initialHeader} />
    </Suspense>
  );
}

function LoadingSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-300 bg-white shadow-sm p-4 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded w-4/6"></div>
      </div>
    </div>
  );
}