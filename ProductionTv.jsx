// app/ProductionComponents/ProductionTvView.js
"use client";

import { useMemo } from "react";

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

export default function ProductionTvView({
  initialHeader,
  hourlyData = [],
  allHeaders = [],
  users = [],
}) {
  const header = initialHeader || null;

  // ─────────────────────────────────────────────────────────────
  // 🔹 Sort hourly records by hour
  // ─────────────────────────────────────────────────────────────
  const recordsSorted = useMemo(() => {
    return (hourlyData || [])
      .map((rec) => ({
        ...rec,
        _hourNum: Number(rec.hour) || 0,
      }))
      .filter((rec) => Number.isFinite(rec._hourNum))
      .sort((a, b) => a._hourNum - b._hourNum);
  }, [hourlyData]);

  // Latest hour for KPI ribbon
  const lastRecord =
    recordsSorted.length > 0
      ? recordsSorted[recordsSorted.length - 1]
      : null;

  // ─────────────────────────────────────────────────────────────
  // 🔹 Header-derived metrics
  // ─────────────────────────────────────────────────────────────
  const totalWorkingHours = header?.workingHour ?? 0;
  const manpowerPresent = header?.manpowerPresent ?? 0;
  const smv = header?.smv ?? 0;
  const planEffPercent = header?.planEfficiency ?? 0;
  const todayTarget = header?.todayTarget ?? 0;
  const prodUserName =
    header?.productionUser?.Production_user_name ?? "Unknown";

  const planEffDecimal = planEffPercent / 100;

  // Base target per hour (capacity first, else day target split)
  const targetFromCapacity =
    manpowerPresent > 0 && smv > 0
      ? (manpowerPresent * 60 * planEffDecimal) / smv
      : 0;

  const targetFromTodayTarget =
    totalWorkingHours > 0 ? todayTarget / totalWorkingHours : 0;

  const baseTargetPerHourRaw = targetFromCapacity || targetFromTodayTarget || 0;
  const baseTargetPerHour = Math.round(baseTargetPerHourRaw);

  // Date display (if header has date field)
  let headerDateLabel = "-";
  if (header?.date) {
    const d = new Date(header.date);
    headerDateLabel = isNaN(d.getTime())
      ? String(header.date)
      : d.toLocaleDateString();
  }

  // ─────────────────────────────────────────────────────────────
  // 🔹 Aggregate summary for the day
  // ─────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    if (!recordsSorted.length) {
      return {
        totalAchieved: 0,
        totalTarget: 0,
        avgHourlyEff: 0,
        avgTotalEff: 0,
      };
    }

    let totalAchieved = 0;
    let totalTarget = 0;
    let sumHourlyEff = 0;
    let sumTotalEff = 0;

    recordsSorted.forEach((rec) => {
      totalAchieved += toNum(rec.achievedQty, 0);
      totalTarget += toNum(rec.dynamicTarget, 0);
      sumHourlyEff += toNum(rec.hourlyEfficiency, 0);
      sumTotalEff += toNum(rec.totalEfficiency, 0);
    });

    const n = recordsSorted.length || 1;

    return {
      totalAchieved,
      totalTarget,
      avgHourlyEff: sumHourlyEff / n,
      avgTotalEff: sumTotalEff / n,
    };
  }, [recordsSorted]);

  // ─────────────────────────────────────────────────────────────
  // 🔹 Guards
  // ─────────────────────────────────────────────────────────────
  if (!header) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-50 flex items-center justify-center">
        <div className="rounded-2xl border border-slate-700 bg-slate-800 px-6 py-4 text-sm">
          No production header found for TV view.
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 🔹 UI – TV layout
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 px-4 py-4">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* HEADER BAR */}
        <header className="rounded-2xl border border-slate-700 bg-slate-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">
              Production TV Dashboard
            </div>
            <div className="text-sm font-semibold">
              Operator:{" "}
              <span className="text-emerald-300">{prodUserName}</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Date: {headerDateLabel}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-[11px]">
            <div>
              <div className="text-slate-400">Working Hours</div>
              <div className="font-semibold text-slate-100">
                {totalWorkingHours}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Present Manpower</div>
              <div className="font-semibold text-slate-100">
                {manpowerPresent}
              </div>
            </div>
            <div>
              <div className="text-slate-400">SMV</div>
              <div className="font-semibold text-slate-100">{smv}</div>
            </div>
            <div>
              <div className="text-slate-400">Plan Eff%</div>
              <div className="font-semibold text-slate-100">
                {formatNumber(planEffPercent, 0)}%
              </div>
            </div>
            <div>
              <div className="text-slate-400">Day Target</div>
              <div className="font-semibold text-slate-100">
                {todayTarget}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Base Target / Hour</div>
              <div className="font-semibold text-slate-100">
                {formatNumber(baseTargetPerHour, 0)}
              </div>
            </div>
          </div>

          {/* Small info from allHeaders & users so all props are used */}
          <div className="text-[10px] text-right text-slate-400">
            Headers loaded:{" "}
            <span className="text-slate-100 font-semibold">
              {allHeaders.length}
            </span>
            <br />
            Users:{" "}
            <span className="text-slate-100 font-semibold">
              {users.length}
            </span>
          </div>
        </header>

        {/* LATEST HOUR KPI RIBBON */}
        {lastRecord && (
          <section className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-4 shadow-inner space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-200 mb-1">
              <span className="font-semibold tracking-wide uppercase">
                Latest Hour Summary (Hour {lastRecord._hourNum})
              </span>
              <span className="text-slate-400">
                Live overview of last posted hour
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              {/* TARGET QTY */}
              <div className="flex flex-col justify-between rounded-xl bg-emerald-500 px-3 py-2 shadow-lg">
                <div className="text-[11px] font-semibold tracking-wide text-black">
                  TARGET QTY
                </div>
                <div className="text-3xl font-extrabold text-black leading-tight">
                  {formatNumber(toNum(lastRecord.dynamicTarget, 0), 0)}
                </div>
              </div>

              {/* ACHIEVE QTY */}
              <div className="flex flex-col justify-between rounded-xl bg-sky-600 px-3 py-2 shadow-lg">
                <div className="text-[11px] font-semibold tracking-wide text-white">
                  ACHIEVE QTY
                </div>
                <div className="text-3xl font-extrabold text-white leading-tight">
                  {formatNumber(toNum(lastRecord.achievedQty, 0), 0)}
                </div>
              </div>

              {/* VARIANCE QTY */}
              <div
                className={`flex flex-col justify-between rounded-xl px-3 py-2 shadow-lg ${
                  toNum(lastRecord.achievedQty, 0) -
                    toNum(lastRecord.dynamicTarget, 0) >=
                  0
                    ? "bg-emerald-600"
                    : "bg-red-600"
                }`}
              >
                <div className="text-[11px] font-semibold tracking-wide text-white">
                  VARIANCE QTY
                </div>
                <div className="text-3xl font-extrabold text-white leading-tight">
                  {formatNumber(
                    toNum(lastRecord.achievedQty, 0) -
                      toNum(lastRecord.dynamicTarget, 0),
                    0
                  )}
                </div>
              </div>

              {/* HOURLY EFFICIENCY */}
              <div className="flex flex-col justify-between rounded-xl bg-gradient-to-br from-orange-500 to-red-600 px-3 py-2 shadow-lg">
                <div className="text-[11px] font-semibold tracking-wide text-white">
                  HOURLY EFFICIENCY %
                </div>
                <div className="text-3xl font-extrabold text-white leading-tight">
                  {formatNumber(toNum(lastRecord.hourlyEfficiency, 0), 1)}
                </div>
              </div>

              {/* ACHIEVE EFFICIENCY */}
              <div className="flex flex-col justify-between rounded-xl bg-red-600 px-3 py-2 shadow-lg">
                <div className="text-[11px] font-semibold tracking-wide text-white">
                  ACHIEVE EFFICIENCY
                </div>
                <div className="text-3xl font-extrabold text-white leading-tight">
                  {formatNumber(toNum(lastRecord.achieveEfficiency, 0), 2)}
                </div>
              </div>
            </div>

            {/* Formula Hints */}
            <div className="grid md:grid-cols-2 gap-2 mt-2 text-[10px] text-slate-300">
              <p>
                <span className="font-semibold">Hourly Efficiency:</span>{" "}
                Hourly Output × SMV ÷ (Manpower × 60) × 100
              </p>
              <p>
                <span className="font-semibold">Achieve Efficiency:</span>{" "}
                Hourly Output × SMV ÷ (Manpower × 60) × Working Hour
              </p>
            </div>
          </section>
        )}

        {/* DAILY SUMMARY STRIP */}
        {recordsSorted.length > 0 && (
          <section className="rounded-2xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-[11px] text-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-slate-400 text-[10px] uppercase tracking-wide">
                Day Summary
              </div>
              <div className="text-sm font-semibold">
                Total Hours Reported:{" "}
                <span className="text-emerald-300">
                  {recordsSorted.length}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div>
                <div className="text-slate-400">Total Target</div>
                <div className="font-semibold">
                  {formatNumber(summary.totalTarget, 0)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Total Achieved</div>
                <div className="font-semibold">
                  {formatNumber(summary.totalAchieved, 0)}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Δ Variance (Achieved - Target)</div>
                <div
                  className={`font-semibold ${
                    summary.totalAchieved - summary.totalTarget >= 0
                      ? "text-emerald-300"
                      : "text-rose-300"
                  }`}
                >
                  {formatNumber(
                    summary.totalAchieved - summary.totalTarget,
                    0
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Avg Hourly Eff %</div>
                <div className="font-semibold">
                  {formatNumber(summary.avgHourlyEff, 1)}%
                </div>
              </div>
              <div>
                <div className="text-slate-400">Avg Total Eff %</div>
                <div className="font-semibold">
                  {formatNumber(summary.avgTotalEff, 1)}%
                </div>
              </div>
            </div>
          </section>
        )}

        {/* FULL HOURLY TABLE */}
        {recordsSorted.length > 0 && (
          <section className="rounded-2xl border border-slate-700 bg-slate-900/80 overflow-x-auto">
            <table className="min-w-full text-[11px] sm:text-xs">
              <thead className="bg-slate-900/90">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-200">
                    Hour
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-200">
                    Target Qty
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-200">
                    Achieved Qty
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-200">
                    Variance Qty (Δ vs target)
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-200">
                    Hourly Eff %
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-200">
                    Achieve Eff
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-200">
                    Total Eff %
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-200">
                    Updated At
                  </th>
                </tr>
              </thead>
              <tbody>
                {recordsSorted.map((rec, idx) => {
                  const variance =
                    toNum(rec.achievedQty, 0) -
                    toNum(rec.dynamicTarget, 0);

                  return (
                    <tr
                      key={rec._id || idx}
                      className={
                        idx % 2 === 0
                          ? "bg-slate-900/40"
                          : "bg-slate-900/20"
                      }
                    >
                      <td className="px-3 py-2 text-slate-100 font-semibold">
                        {rec._hourNum}
                      </td>
                      <td className="px-3 py-2 text-slate-100">
                        {formatNumber(toNum(rec.dynamicTarget, 0), 0)}
                      </td>
                      <td className="px-3 py-2 text-slate-100">
                        {formatNumber(toNum(rec.achievedQty, 0), 0)}
                      </td>
                      <td
                        className={`px-3 py-2 font-semibold ${
                          variance >= 0
                            ? "text-emerald-300"
                            : "text-rose-300"
                        }`}
                      >
                        {formatNumber(variance, 0)}
                      </td>
                      <td className="px-3 py-2 text-slate-100">
                        {formatNumber(toNum(rec.hourlyEfficiency, 0), 1)}%
                      </td>
                      <td className="px-3 py-2 text-slate-100">
                        {formatNumber(toNum(rec.achieveEfficiency, 0), 2)}
                      </td>
                      <td className="px-3 py-2 text-slate-100">
                        {formatNumber(toNum(rec.totalEfficiency, 0), 1)}%
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {rec.updatedAt
                          ? new Date(rec.updatedAt).toLocaleTimeString()
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* No hourly data */}
        {recordsSorted.length === 0 && (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/80 px-4 py-4 text-[11px] text-slate-200">
            No hourly production records found for this header.
          </div>
        )}
      </div>
    </div>
  );
}
