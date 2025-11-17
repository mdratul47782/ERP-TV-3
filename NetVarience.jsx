"use client";

import { useEffect, useState } from "react";
import { useProductionAuth } from "../hooks/useProductionAuth";

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

export default function WorkingHourCard({ header: initialHeader }) {
  // 🔹 Normalize header: allow array or single object
  const [header, setHeader] = useState(
    Array.isArray(initialHeader) ? initialHeader[0] : initialHeader || null
  );
  const h = header;

  const { ProductionAuth, loading: productionLoading } = useProductionAuth();

  const [selectedHour, setSelectedHour] = useState(1);
  const [achievedInput, setAchievedInput] = useState("");
  const [hourlyRecords, setHourlyRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [latestDynamicFromServer, setLatestDynamicFromServer] = useState(null);

  // 🔹 Auto-refresh header data every 3 seconds
  useEffect(() => {
    if (!ProductionAuth?.id) return;

    const fetchHeaderData = async () => {
      try {
        const todayDate = new Intl.DateTimeFormat("en-CA").format(new Date());
        const params = new URLSearchParams({
          productionUserId: ProductionAuth.id,
          date: todayDate,
        });

        const res = await fetch(
          `/api/production-headers?${params.toString()}`,
          { cache: "no-store" }
        );
        const json = await res.json();

        if (res.ok && json.success && json.data) {
          setHeader(json.data);
        } else {
          setHeader(null);
        }
      } catch (err) {
        console.error("Failed to refresh header data:", err);
      }
    };

    fetchHeaderData();
    const intervalId = setInterval(fetchHeaderData, 3000);
    return () => clearInterval(intervalId);
  }, [ProductionAuth?.id]);

  // 🔹 Load existing hourly records for this header + production user
  useEffect(() => {
    const fetchRecords = async () => {
      if (!h?._id || !ProductionAuth?.id) return;
      try {
        setLoadingRecords(true);
        setError("");
        setMessage("");

        const params = new URLSearchParams({
          headerId: h._id,
          productionUserId: ProductionAuth.id,
        });

        const res = await fetch(`/api/hourly-productions?${params.toString()}`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load hourly records");
        }

        const records = json.data || [];
        setHourlyRecords(records);

        if (records.length > 0) {
          const last = records[records.length - 1];
          setLatestDynamicFromServer(last.dynamicTarget ?? null);
        } else {
          setLatestDynamicFromServer(null);
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load hourly records");
      } finally {
        setLoadingRecords(false);
      }
    };

    fetchRecords();
  }, [h?._id, ProductionAuth?.id]);

  // 🔹 Derived inputs (safe if header is null)
  const totalWorkingHours = h?.workingHour ?? 1;
  const manpowerPresent = h?.manpowerPresent ?? 0;
  const smv = h?.smv ?? 1;
  const planEfficiencyPercent = h?.planEfficiency ?? 0;
  const planEffDecimal = planEfficiencyPercent / 100;
  const todayTarget = h?.todayTarget ?? 0;

  const hours = Array.from(
    { length: Math.max(1, totalWorkingHours) },
    (_, i) => i + 1
  );

  // 🔹 Base target per hour (capacity first, else even split of day target)
  const targetFromCapacity =
    manpowerPresent > 0 && smv > 0
      ? (manpowerPresent * 60 * planEffDecimal) / smv
      : 0;

  const targetFromTodayTarget =
    totalWorkingHours > 0 ? todayTarget / totalWorkingHours : 0;

  const baseTargetPerHour = targetFromCapacity || targetFromTodayTarget || 0;

  const achievedThisHour = Number(achievedInput) || 0;

  // 🔹 Efficiencies (for the current input only)
  const hourlyEfficiency =
    manpowerPresent > 0 && smv > 0
      ? (achievedThisHour * smv * 100) / (manpowerPresent * 60)
      : 0;

  const achieveEfficiency =
    manpowerPresent > 0 && smv > 0
      ? (achievedThisHour * smv * selectedHour) / (manpowerPresent * 60)
      : 0;

  const selectedHourInt = Number(selectedHour) || 1;

  // 🔹 Find the record for the selected hour (if already saved)
  const recordForSelectedHour = hourlyRecords.find((rec) => {
    const recHour = Number(rec.hour);
    return Number.isFinite(recHour) && recHour === selectedHourInt;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 🔹 NEW: Decorate records with:
  //   - _perHourVarDynamic: (Achieved − DynamicTarget) for that hour
  //   - _netVarVsBaseToDate: cumulative variance vs BASE target up to that hour
  //     → This is the “(5 − 2) = 3” running logic you asked for.
  // ─────────────────────────────────────────────────────────────────────────────
  const recordsSorted = hourlyRecords
    .map((rec) => ({ ...rec, _hourNum: Number(rec.hour) }))
    .filter((rec) => Number.isFinite(rec._hourNum))
    .sort((a, b) => a._hourNum - b._hourNum);

  let runningAchieved = 0;
  let runningVarDynamic = 0;

  const recordsDecorated = recordsSorted.map((rec) => {
    const dynTarget = toNum(
      rec.dynamicTarget ?? baseTargetPerHour,
      baseTargetPerHour
    );
    const achieved = toNum(rec.achievedQty, 0);

    const perHourVarDynamic = achieved - dynTarget; // vs DYNAMIC target (existing logic)
    runningVarDynamic += perHourVarDynamic;

    runningAchieved += achieved; // cumulative achieved
    const baselineToDate = baseTargetPerHour * rec._hourNum;
    const netVarVsBaseToDate = runningAchieved - baselineToDate; // ← NEW running variance vs BASE

    return {
      ...rec,
      _perHourVarDynamic: perHourVarDynamic,
      _runningVarDynamic: runningVarDynamic,
      _achievedCume: runningAchieved,
      _netVarVsBaseToDate: netVarVsBaseToDate,
    };
  });

  // 🔹 Previous (already posted) records up to the hour BEFORE the selected hour
  const previousDecorated = recordsDecorated.filter(
    (rec) => rec._hourNum < selectedHourInt
  );

  // 🔹 Sum of previous per-hour variance VS DYNAMIC target (for dynamic target calc)
  const cumulativeVarianceDynamicPrev = previousDecorated.reduce(
    (sum, rec) => sum + toNum(rec._perHourVarDynamic, 0),
    0
  );

  // 🔹 Only carry FORWARD the shortfall (negative)
  const cumulativeShortfall =
    cumulativeVarianceDynamicPrev < 0 ? -cumulativeVarianceDynamicPrev : 0;

  // 🔹 Dynamic target for the current hour (unchanged business rule)
  const dynamicTargetThisHour = recordForSelectedHour
    ? Number(recordForSelectedHour.dynamicTarget ?? baseTargetPerHour)
    : baseTargetPerHour + cumulativeShortfall;

  // 🔹 Last hour's per-hour variance (vs DYNAMIC)
  const previousRecord = previousDecorated.length
    ? previousDecorated[previousDecorated.length - 1]
    : null;

  const previousVariance = previousRecord
    ? toNum(previousRecord._perHourVarDynamic, 0)
    : 0;

  // 🔹 Net variance vs BASE target to date (for the selected hour)
  const achievedToDatePosted = recordsDecorated
    .filter((rec) => rec._hourNum <= selectedHourInt)
    .reduce((sum, rec) => sum + toNum(rec.achievedQty, 0), 0);

  const baselineToDateSelected = baseTargetPerHour * selectedHourInt;
  const netVarVsBaseToDateSelected =
    achievedToDatePosted - baselineToDateSelected;

  const headerProdName = h?.productionUser?.Production_user_name ?? "";
  const authProdName = ProductionAuth?.Production_user_name ?? "";
  const isMatched =
    headerProdName &&
    authProdName &&
    headerProdName.toLowerCase() === authProdName.toLowerCase();

  // 🔹 NOW conditional rendering

  if (productionLoading) {
    return (
      <div className="rounded-2xl border border-gray-300 bg-white shadow-sm p-4 text-xs">
        Loading production user...
      </div>
    );
  }

  if (!ProductionAuth) {
    return (
      <div className="rounded-2xl border border-yellow-300 bg-yellow-50 shadow-sm p-4 text-xs">
        No production user logged in. Please sign in to see working hour
        details.
      </div>
    );
  }

  if (!h) {
    return (
      <div className="rounded-2xl border border-gray-300 bg-white shadow-sm p-4 text-xs">
        No production header found. Please save a header first.
      </div>
    );
  }

  if (!isMatched) {
    return (
      <div className="rounded-2xl border border-rose-300 bg-rose-50 shadow-sm p-4 text-xs space-y-1.5">
        <div className="font-semibold text-rose-700">
          Header does not belong to the logged-in production user.
        </div>
        <div className="text-slate-700">
          <span className="font-medium">Header production user:</span>{" "}
          {headerProdName || "N/A"}
        </div>
        <div className="text-slate-700">
          <span className="font-medium">Logged-in production user:</span>{" "}
          {authProdName || "N/A"}
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (!h._id) {
        throw new Error("Missing headerId");
      }

      if (!Number.isFinite(achievedThisHour) || achievedThisHour < 0) {
        throw new Error("Please enter a valid achieved qty for this hour");
      }

      const payload = {
        headerId: h._id,
        hour: Number(selectedHour),
        achievedQty: achievedThisHour,
        productionUser: {
          id: ProductionAuth.id,
          Production_user_name: ProductionAuth.Production_user_name,
          phone: ProductionAuth.phone,
          bio: ProductionAuth.bio,
        },
      };

      const res = await fetch("/api/hourly-productions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json?.errors?.join(", ") ||
            json?.message ||
            "Failed to save hourly production record"
        );
      }

      // 🔹 Refresh list after save
      const params = new URLSearchParams({
        headerId: h._id,
        productionUserId: ProductionAuth.id,
      });
      const resList = await fetch(
        `/api/hourly-productions?${params.toString()}`
      );
      const jsonList = await resList.json();
      if (resList.ok && jsonList.success) {
        const records = jsonList.data || [];
        setHourlyRecords(records);
        if (records.length > 0) {
          const last = records[records.length - 1];
          setLatestDynamicFromServer(last.dynamicTarget ?? null);
        } else {
          setLatestDynamicFromServer(null);
        }
      }

      setAchievedInput("");
      setMessage("Hourly record saved successfully.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save hourly record");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    console.log(
      "Edit clicked – wire this to PATCH /api/hourly-productions/:id"
    );
  };

  const handleDelete = () => {
    console.log(
      "Delete clicked – you can call DELETE /api/hourly-productions/:id"
    );
  };

  return (
    <div className="rounded-2xl border border-gray-300 bg-white shadow-sm p-4 space-y-3">
      {/* Header */}
      <div className="border-b pb-2 flex items-center justify-between text-xs">
        <div className="font-semibold tracking-wide uppercase">
          Working Hour
        </div>
        <div className="text-[11px] text-slate-600 space-y-0.5 text-right">
          <div>
            <span className="font-medium">Production User:</span>{" "}
            {headerProdName}
          </div>
          <div>
            <span className="font-medium">Planned Working Hours:</span>{" "}
            {totalWorkingHours}
          </div>
        </div>
      </div>

      {/* Messages */}
      {(error || message) && (
        <div className="text-[11px]">
          {error && (
            <div className="mb-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-red-700">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
              {message}
            </div>
          )}
        </div>
      )}

      {/* Live summary */}
      <div className="text-[11px] text-slate-700 bg-slate-50 rounded-lg p-3 space-y-1.5 border border-slate-200">
        <div className="flex justify-between items-center pb-1 border-b border-slate-300">
          <span className="font-semibold text-slate-800">Live Data</span>
          <span className="text-[10px] text-emerald-600 animate-pulse">
            ● Auto-refresh every 3s
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <span className="font-medium text-slate-600">
              Present Manpower:
            </span>{" "}
            <span className="font-semibold text-slate-900">
              {manpowerPresent}
            </span>
          </div>
          <div>
            <span className="font-medium text-slate-600">SMV:</span>{" "}
            <span className="font-semibold text-slate-900">{smv}</span>
          </div>
          <div>
            <span className="font-medium text-slate-600">Plan Efficiency:</span>{" "}
            <span className="font-semibold text-slate-900">
              {planEfficiencyPercent}%
            </span>
          </div>
          <div>
            <span className="font-medium text-slate-600">Day Target:</span>{" "}
            <span className="font-semibold text-slate-900">{todayTarget}</span>
          </div>
          <div>
            <span className="font-medium text-slate-600">
              Base Target / Hour:
            </span>{" "}
            <span className="font-semibold text-slate-900">
              {formatNumber(baseTargetPerHour)}
            </span>
          </div>

          {/* 🔹 Dynamic-target shortfall carryover (unchanged) */}
          <div>
            <span className="font-medium text-slate-600">
              Cumulative Shortfall (prev vs dynamic):
            </span>{" "}
            <span className="font-semibold text-amber-700">
              {formatNumber(cumulativeShortfall)}
            </span>
          </div>
          <div className="col-span-2">
            <span className="font-medium text-slate-600">
              Dynamic target this hour:
            </span>{" "}
            <span className="font-semibold text-blue-700">
              {formatNumber(dynamicTargetThisHour)}
            </span>
          </div>

          {/* 🔹 NEW: Net variance vs BASE to date (this is your “5 − 2 = 3” number) */}
          <div className="col-span-2">
            <span className="font-medium text-slate-600">
              Net variance vs base (to date):
            </span>{" "}
            <span
              className={`font-semibold ${
                netVarVsBaseToDateSelected >= 0
                  ? "text-green-700"
                  : "text-red-700"
              }`}
            >
              {formatNumber(netVarVsBaseToDateSelected)}
            </span>
          </div>

          {/* 🔹 Also show cumulative variance vs dynamic (previous posted only) */}
          <div className="col-span-2">
            <span className="font-medium text-slate-600">
              Cumulative variance (all prev vs dynamic):
            </span>{" "}
            <span
              className={`font-semibold ${
                cumulativeVarianceDynamicPrev >= 0
                  ? "text-green-700"
                  : "text-red-700"
              }`}
            >
              {formatNumber(cumulativeVarianceDynamicPrev)}
            </span>
          </div>
        </div>

        {latestDynamicFromServer !== null && (
          <div className="pt-1 border-t border-slate-200">
            <span className="font-medium text-slate-600">
              Last Saved Dynamic Target:
            </span>{" "}
            <span className="font-semibold text-slate-900">
              {formatNumber(latestDynamicFromServer)}
            </span>
          </div>
        )}
        {previousRecord && (
          <div>
            <span className="font-medium text-slate-600">
              Last hour variance (Δ vs dynamic):
            </span>{" "}
            <span
              className={`font-semibold ${
                previousVariance >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {formatNumber(previousVariance)}
            </span>
          </div>
        )}
      </div>

      {/* Main input row */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-2 text-left">Hour</th>
              <th className="px-2 py-2 text-left">Base Target / hr</th>
              <th className="px-2 py-2 text-left">
                Dynamic Target (this hour)
              </th>
              <th className="px-2 py-2 text-left">Achieved Qty (this hour)</th>
              <th className="px-2 py-2 text-left">Hourly Efficiency %</th>
              <th className="px-2 py-2 text-left">Achieve Efficiency</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="px-2 py-2 align-top">
                <select
                  className="w-full rounded border px-2 py-1 text-xs"
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(Number(e.target.value))}
                >
                  {hours.map((hVal) => (
                    <option key={hVal} value={hVal}>
                      {hVal} hour{hVal > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-gray-500">
                  Current hour (1 ~ {totalWorkingHours})
                </p>
              </td>

              <td className="px-2 py-2 align-top">
                <div className="rounded border bg-gray-50 px-2 py-1">
                  {formatNumber(baseTargetPerHour)}
                </div>
                <p className="mt-1 text-[10px] text-gray-500 leading-tight">
                  (Manpower × 60 × Plan % ÷ SMV)
                </p>
              </td>

              <td className="px-2 py-2 align-top">
                <div className="rounded border bg-amber-50 px-2 py-1">
                  {formatNumber(dynamicTargetThisHour)}
                </div>
                <p className="mt-1 text-[10px] text-amber-700 leading-tight">
                  Base + cumulative shortfall
                </p>
              </td>

              <td className="px-2 py-2 align-top">
                <input
                  type="number"
                  min="0"
                  className="w-full rounded border px-2 py-1 text-xs"
                  value={achievedInput}
                  onChange={(e) => setAchievedInput(e.target.value)}
                  placeholder="Output this hour"
                />
                <p className="mt-1 text-[10px] text-gray-500">
                  Actual pieces this hour
                </p>
              </td>

              <td className="px-2 py-2 align-top">
                <div className="rounded border bg-gray-50 px-2 py-1">
                  {formatNumber(hourlyEfficiency)}
                </div>
                <p className="mt-1 text-[10px] text-gray-500 leading-tight">
                  Output × SMV ÷ (Manpower × 60) × 100
                </p>
              </td>

              <td className="px-2 py-2 align-top">
                <div className="rounded border bg-gray-50 px-2 py-1">
                  {formatNumber(achieveEfficiency)}
                </div>
                <p className="mt-1 text-[10px] text-gray-500 leading-tight">
                  Hourly Output × SMV ÷ (Manpower × 60) × Working Hour
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 text-xs">
        <button
          type="button"
          onClick={handleSave}
          className="rounded bg-gray-900 px-3 py-1 font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Hour"}
        </button>
        <button
          type="button"
          onClick={handleEdit}
          className="rounded border border-gray-400 px-3 py-1 font-medium text-gray-700 hover:bg-gray-100"
        >
          Edit (wire later)
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded border border-red-400 px-3 py-1 font-medium text-red-600 hover:bg-red-50"
        >
          Delete (wire later)
        </button>
      </div>

      {/* Posted hourly data */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-2">
          <h3 className="font-semibold">Posted hourly records</h3>
          {loadingRecords && (
            <span className="text-[10px] text-slate-500">
              Loading hourly records...
            </span>
          )}
        </div>

        {recordsDecorated.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            No hourly records saved yet for this header.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-t">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-2 py-1 text-left">Hour</th>
                  <th className="px-2 py-1 text-left">Dynamic Target</th>
                  <th className="px-2 py-1 text-left">Achieved</th>
                  {/* 🔹 Keep per-hour variance vs dynamic */}
                  <th className="px-2 py-1 text-left">
                    Δ Var (hour vs dynamic)
                  </th>
                  {/* 🔹 NEW running variance vs base */}
                  <th className="px-2 py-1 text-left">
                    Net Var vs Base (to date)
                  </th>
                  <th className="px-2 py-1 text-left">Hourly Eff %</th>
                  <th className="px-2 py-1 text-left">Achieve Eff</th>
                  <th className="px-2 py-1 text-left">Total Eff %</th>
                  <th className="px-2 py-1 text-left">Updated At</th>
                </tr>
              </thead>
              <tbody>
                {recordsDecorated.map((rec) => (
                  <tr key={rec._id} className="border-b">
                    <td className="px-2 py-1">{rec.hour}</td>
                    <td className="px-2 py-1">
                      {formatNumber(rec.dynamicTarget ?? baseTargetPerHour)}
                    </td>
                    <td className="px-2 py-1">{rec.achievedQty}</td>
                    <td
                      className={`px-2 py-1 ${
                        rec._perHourVarDynamic >= 0
                          ? "text-green-700"
                          : "text-red-700"
                      }`}
                    >
                      {formatNumber(rec._perHourVarDynamic)}
                    </td>
                    <td
                      className={`px-2 py-1 ${
                        rec._netVarVsBaseToDate >= 0
                          ? "text-green-700"
                          : "text-red-700"
                      }`}
                    >
                      {formatNumber(rec._netVarVsBaseToDate)}
                    </td>
                    <td className="px-2 py-1">
                      {formatNumber(rec.hourlyEfficiency)}
                    </td>
                    <td className="px-2 py-1">
                      {formatNumber(rec.achieveEfficiency)}
                    </td>
                    <td className="px-2 py-1">
                      {formatNumber(rec.totalEfficiency)}
                    </td>
                    <td className="px-2 py-1">
                      {rec.updatedAt
                        ? new Date(rec.updatedAt).toLocaleTimeString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
