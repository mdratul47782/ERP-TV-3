"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";

// 🔹 Pretty number formatter
function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(digits);
}

// 🔹 Safe numeric
function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
// 🔹 Color palette for bars
const BAR_COLORS = [
  "#6366F1", // indigo
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#22C55E", // green
];
// 🔹 Match a record's productionUser with the logged-in ProductionAuth
function sameProductionUser(recordUser, auth) {
  if (!recordUser || !auth) return false;

  const recId = recordUser.id || recordUser._id;
  const authId = auth.id || auth._id;

  const recName = (
    recordUser.Production_user_name ||
    recordUser.user_name ||
    ""
  )
    .trim()
    .toLowerCase();

  const authName = (auth.Production_user_name || auth.user_name || "")
    .trim()
    .toLowerCase();

  const idMatch = recId && authId && String(recId) === String(authId);
  const nameMatch = recName && authName && recName === authName;

  return idMatch || nameMatch;
}

/* ------------------------------------------------------------------ */
/* 🔹 MonthlyEfficiencyChart – last 30 days final AVG Eff % per day   */
/* ------------------------------------------------------------------ */

function MonthlyEfficiencyChart({ allHourly = [], auth }) {
  // 🔹 For each date:
  //   -> find last hourly record (max hour / latest updatedAt)
  //   -> use rec.totalEfficiency from that record
  const chartData = useMemo(() => {
    if (!Array.isArray(allHourly) || !auth) return [];

    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 29); // last 30 days

    const startKey = start.toISOString().slice(0, 10);
    const endKey = today.toISOString().slice(0, 10);

    // Map<dateKey, { hour: number, updatedAt: number, eff: number }>
    const buckets = new Map();

    for (const rec of allHourly) {
      // 1) Only this production user
      if (!sameProductionUser(rec.productionUser, auth)) continue;

      // 2) Determine date key
      const srcDate =
        rec.productionDate ||
        rec.date ||
        rec.createdAt ||
        rec.updatedAt;

      if (!srcDate) continue;

      const dayKey = new Date(srcDate).toISOString().slice(0, 10);

      // keep within last 30 days
      if (dayKey < startKey || dayKey > endKey) continue;

      // 3) Take "AVG Eff %" from DB – you store it as totalEfficiency
      const eff = toNum(rec.totalEfficiency, NaN);
      if (!Number.isFinite(eff)) continue;

      const hourNum = Number(rec.hour) || 0;
      const updatedMs = rec.updatedAt ? new Date(rec.updatedAt).getTime() : 0;

      const existing = buckets.get(dayKey);

      // If no record for this day yet, or this hour is later, or same hour but newer update, replace it
      if (
        !existing ||
        hourNum > existing.hour ||
        (hourNum === existing.hour && updatedMs > existing.updatedAt)
      ) {
        buckets.set(dayKey, { hour: hourNum, updatedAt: updatedMs, eff });
      }
    }

    // Convert to sorted array for Recharts
    const rows = Array.from(buckets.entries())
      .sort(([d1], [d2]) => d1.localeCompare(d2))
      .map(([dayKey, { eff }]) => ({
        date: dayKey,
        label: dayKey.slice(5), // show "MM-DD"
        avgEfficiency: eff, // 🔹 this is your final daily AVG Eff %
      }));

    return rows;
  }, [allHourly, auth]);

  if (!auth) return null;

  if (!chartData.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
        No efficiency history found for the last 30 days for this production
        user.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="font-semibold text-slate-800">
          Last 30 days – Final Avg Efficiency %
        </div>
        <div className="text-[10px] text-slate-500">
          Uses last hour&apos;s AVG Eff % per day (same as table)
        </div>
      </div>

            <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 16, right: 16, bottom: 8, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              unit="%"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value) => `${formatNumber(value)} %`}
              labelFormatter={(label, payload) =>
                payload?.[0]?.payload?.date
                  ? `Date: ${payload[0].payload.date}`
                  : `Date: ${label}`
              }
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar
              dataKey="avgEfficiency"
              name="Final Avg Eff %"
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.date}
                  fill={BAR_COLORS[index % BAR_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}

export default MonthlyEfficiencyChart;
