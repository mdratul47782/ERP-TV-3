"use client";

import { useEffect, useState } from "react";
import { useProductionAuth } from "../hooks/useProductionAuth";

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

/* ------------------------------------------------------------------ */
/* 🔹 Helpers to match by ProductionAuth                              */
/* ------------------------------------------------------------------ */

// Match a record's productionUser with the logged-in ProductionAuth
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

// Pick the header for a given date + production user
function pickHeaderForDateAndUser(rawHeader, auth, date) {
  if (!rawHeader || !auth || !date) return null;

  const headersArray = Array.isArray(rawHeader) ? rawHeader : [rawHeader];

  const dateStr = date.slice(0, 10);

  return (
    headersArray.find((hdr) => {
      const hdrDate = (hdr.productionDate || "").slice(0, 10);
      if (hdrDate !== dateStr) return false;
      return sameProductionUser(hdr.productionUser, auth);
    }) || null
  );
}

// Filter hourly records for a given header + production user
function filterHourlyByHeaderAndUser(allHourly, auth, headerId) {
  if (!Array.isArray(allHourly) || !auth || !headerId) return [];
  const headerIdStr = String(headerId);

  return allHourly.filter((rec) => {
    const headerMatch = rec.headerId && String(rec.headerId) === headerIdStr;
    const userMatch = sameProductionUser(rec.productionUser, auth);
    return headerMatch && userMatch;
  });
}

/* ------------------------------------------------------------------ */
/* 🔹 Component                                                        */
/* ------------------------------------------------------------------ */

export default function WorkingHourCard({
  header: initialHeader,
  hourlyData = [],
}) {
  const { ProductionAuth, loading: productionLoading } = useProductionAuth();

  // 🔹 Normalize initial header (server-provided) – array or single object
  const initialHeaderNormalized = Array.isArray(initialHeader)
    ? initialHeader[0]
    : initialHeader || null;

  // 🔹 Selected date: prefer header.productionDate, else today
  const [selectedDate, setSelectedDate] = useState(() => {
    if (initialHeaderNormalized?.productionDate) {
      // e.g. "2025-11-18" or full ISO string
      return initialHeaderNormalized.productionDate.slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });

  // 🔹 Header state: will be overwritten by API + ProductionAuth matching
  const [header, setHeader] = useState(initialHeaderNormalized);
  const h = header;

  const [selectedHour, setSelectedHour] = useState(1);
  const [achievedInput, setAchievedInput] = useState("");
  const [hourlyRecords, setHourlyRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [latestDynamicFromServer, setLatestDynamicFromServer] = useState(null);
  const [headerLoading, setHeaderLoading] = useState(false);

  // here is all hourly data
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("✅ WorkingHourCard: hourlyData (full)", hourlyData);
    try {
      if (Array.isArray(hourlyData) && hourlyData.length > 0) {
        //eslint-disable-next-line no-console
        console.table(hourlyData);
      }
    } catch {}
  }, [hourlyData]);

  //─────────────────────────────────────────────────────────────────────────────
  // 🔹 Auto-refresh header data for selected date every 3s (per production user)
  //    Now: header is matched by ProductionAuth AND selectedDate
  //─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ProductionAuth?.id || !selectedDate) return;

    let cancelled = false;

    const fetchHeaderData = async () => {
      try {
        setHeaderLoading(true);

        const params = new URLSearchParams({
          productionUserId: ProductionAuth.id,
          date: selectedDate, // 🔹 key: use selected date, not always today
        });

        const res = await fetch(
          `/api/production-headers?${params.toString()}`,
          { cache: "no-store" }
        );
        const json = await res.json();

        if (cancelled) return;

        if (res.ok && json.success && json.data) {
          // 🔹 There might be multiple headers: pick the one for this user + date
          const matchedFromApi = pickHeaderForDateAndUser(
            json.data,
            ProductionAuth,
            selectedDate
          );
          setHeader(matchedFromApi || null);
        } else {
          // 🔹 Fallback: try any header from props for this date + user
          const fallbackHeader = pickHeaderForDateAndUser(
            initialHeader,
            ProductionAuth,
            selectedDate
          );
          setHeader(fallbackHeader || null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to refresh header data:", err);
        setHeader(null);
      } finally {
        if (!cancelled) setHeaderLoading(false);
      }
    };

    fetchHeaderData();
    const intervalId = setInterval(fetchHeaderData, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [ProductionAuth?.id, selectedDate, initialHeader]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 🔹 Load existing hourly records for this header + production user
  //    Now: always filtered by ProductionAuth + headerId
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchRecords = async () => {
      // If header or auth not ready, just clear & optionally use local hourlyData
      if (!h?._id || !ProductionAuth?.id) {
        const local = filterHourlyByHeaderAndUser(
          hourlyData,
          ProductionAuth,
          h?._id
        );
        setHourlyRecords(local);
        if (local.length > 0) {
          const lastLocal = local[local.length - 1];
          setLatestDynamicFromServer(lastLocal.dynamicTarget ?? null);
        } else {
          setLatestDynamicFromServer(null);
        }
        return;
      }

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

        const allRecords = json.data || [];

        // 🔹 Only keep records for this header + logged-in ProductionAuth
        const filtered = filterHourlyByHeaderAndUser(
          allRecords,
          ProductionAuth,
          h._id
        );

        setHourlyRecords(filtered);

        if (filtered.length > 0) {
          const last = filtered[filtered.length - 1];
          setLatestDynamicFromServer(last.dynamicTarget ?? null);
        } else {
          setLatestDynamicFromServer(null);
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load hourly records");

        // 🔹 Fallback to local hourlyData (if provided)
        const local = filterHourlyByHeaderAndUser(
          hourlyData,
          ProductionAuth,
          h?._id
        );
        setHourlyRecords(local);
        if (local.length > 0) {
          const lastLocal = local[local.length - 1];
          setLatestDynamicFromServer(lastLocal.dynamicTarget ?? null);
        } else {
          setLatestDynamicFromServer(null);
        }
      } finally {
        setLoadingRecords(false);
      }
    };

    fetchRecords();
  }, [h?._id, ProductionAuth?.id, hourlyData]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 🔹 Derived inputs (safe if header is null) – NO CHANGE IN CALCULATION
  // ─────────────────────────────────────────────────────────────────────────────
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

  // 🔹 Base target per hour (capacity first, else even split) → ROUND integer
  const targetFromCapacity =
    manpowerPresent > 0 && smv > 0
      ? (manpowerPresent * 60 * planEffDecimal) / smv
      : 0;

  const targetFromTodayTarget =
    totalWorkingHours > 0 ? todayTarget / totalWorkingHours : 0;

  const baseTargetPerHourRaw = targetFromCapacity || targetFromTodayTarget || 0;
  const baseTargetPerHour = Math.round(baseTargetPerHourRaw); // e.g., 12.75 → 13

  // 🔹 Achieved qty for this hour – ROUND before all calculations
  const achievedThisHour = Math.round(Number(achievedInput) || 0);

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

  // ─────────────────────────────────────────────────────────────────────────────
  // 🔹 DECORATION using GARMENTS RULE – ***UNCHANGED***
  // ─────────────────────────────────────────────────────────────────────────────
  const recordsSorted = hourlyRecords
    .map((rec) => ({ ...rec, _hourNum: Number(rec.hour) }))
    .filter((rec) => Number.isFinite(rec._hourNum))
    .sort((a, b) => a._hourNum - b._hourNum);

  let runningAchieved = 0; // Σ achieved (rounded) up to current row

  const recordsDecorated = recordsSorted.map((rec) => {
    const hourN = rec._hourNum;

    // Cumulative baseline & achieved BEFORE this hour (h-1)
    const baselineToDatePrev = baseTargetPerHour * (hourN - 1);
    const cumulativeShortfallVsBasePrev = Math.max(
      0,
      baselineToDatePrev - runningAchieved
    );

    // Dynamic target for THIS hour
    const dynTarget = baseTargetPerHour + cumulativeShortfallVsBasePrev;

    // Rounded achieved for this hour
    const achievedRounded = Math.round(toNum(rec.achievedQty, 0));

    // Δ vs dynamic (this row)
    const perHourVarDynamic = achievedRounded - dynTarget;

    // Advance cumulative achieved (AFTER this hour)
    runningAchieved += achievedRounded;

    // Net variance vs BASE to date (this hour)
    const baselineToDate = baseTargetPerHour * hourN;
    const netVarVsBaseToDate = runningAchieved - baselineToDate;

    return {
      ...rec,
      _hourNum: hourN,
      _dynTargetRounded: Math.round(dynTarget),
      _achievedRounded: achievedRounded,
      _perHourVarDynamic: perHourVarDynamic,
      _netVarVsBaseToDate: netVarVsBaseToDate,
      _baselineToDatePrev: baselineToDatePrev,
      _cumulativeShortfallVsBasePrev: cumulativeShortfallVsBasePrev,
    };
  });

  // 🔹 Previous (posted) records strictly before the selected hour
  const previousDecorated = recordsDecorated.filter(
    (rec) => rec._hourNum < selectedHourInt
  );

  // 🔹 Compute CURRENT hour dynamic = base + shortfall vs BASE up to (h-1)
  const achievedToDatePrev = previousDecorated.reduce(
    (sum, rec) => sum + (rec._achievedRounded ?? 0),
    0
  );
  const baselineToDatePrevForSelected =
    baseTargetPerHour * (selectedHourInt - 1);
  const cumulativeShortfallVsBasePrevForSelected = Math.max(
    0,
    baselineToDatePrevForSelected - achievedToDatePrev
  );

  const dynamicTargetThisHour = Math.round(
    baseTargetPerHour + cumulativeShortfallVsBasePrevForSelected
  );

  // 🔹 Informational: Δ vs dynamic of the immediate previous row
  const previousRecord =
    previousDecorated.length > 0
      ? previousDecorated[previousDecorated.length - 1]
      : null;
  const previousVariance = previousRecord
    ? previousRecord._perHourVarDynamic
    : 0;

  // 🔹 Informational: cumulative Δ vs dynamic (previous rows) — not used for target
  const cumulativeVarianceDynamicPrev = previousDecorated.reduce(
    (sum, rec) => sum + (rec._perHourVarDynamic ?? 0),
    0
  );

  // 🔹 Net variance vs BASE to date for the selected hour (remains correct)
  const achievedToDatePosted = recordsDecorated
    .filter((rec) => rec._hourNum <= selectedHourInt)
    .reduce((sum, rec) => sum + (rec._achievedRounded ?? 0), 0);
  const baselineToDateSelected = baseTargetPerHour * selectedHourInt;
  const netVarVsBaseToDateSelected =
    achievedToDatePosted - baselineToDateSelected;

  // ─────────────────────────────────────────────────────────────────────────────
  // 🔹 Auth match (now checks ID OR name)
  // ─────────────────────────────────────────────────────────────────────────────
  const headerProdUser = h?.productionUser || {};
  const headerProdName =
    headerProdUser.Production_user_name || headerProdUser.user_name || "";
  const authProdName =
    ProductionAuth?.Production_user_name || ProductionAuth?.user_name || "";

  const headerProdId = headerProdUser.id || headerProdUser._id;
  const authProdId = ProductionAuth?.id || ProductionAuth?._id;

  const idMatched =
    headerProdId && authProdId && String(headerProdId) === String(authProdId);
  const nameMatched =
    headerProdName &&
    authProdName &&
    headerProdName.toLowerCase() === authProdName.toLowerCase();

  const isMatched = idMatched || nameMatched;

  // ─────────────────────────────────────────────────────────────────────────────
  // 🔹 Rendering guards
  // ─────────────────────────────────────────────────────────────────────────────
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

  if (h && !isMatched) {
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 🔹 Save: send rounded achieved and the dynamic target used for this hour
  //    + prevent duplicate save for the same hour  (UNCHANGED)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      setError("");
      setMessage("");

      if (!h?._id) {
        throw new Error("Missing headerId for this date");
      }

      const hourNum = Number(selectedHour);

      // 🔹 Block duplicate entry for the same hour (for this header + user)
      const existingRecord = hourlyRecords.find(
        (rec) => Number(rec.hour) === hourNum
      );
      if (existingRecord) {
        setError(`You already saved data for hour ${hourNum}. `);
        return;
      }

      if (!Number.isFinite(achievedThisHour) || achievedThisHour < 0) {
        throw new Error("Please enter a valid achieved qty for this hour");
      }

      setSaving(true);

      const payload = {
        headerId: h._id,
        hour: hourNum,
        achievedQty: achievedThisHour, // 🔹 rounded
        dynamicTarget: dynamicTargetThisHour, // 🔹 base + cumulative shortfall vs base
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

      // 🔹 Reload list
      const params = new URLSearchParams({
        headerId: h._id,
        productionUserId: ProductionAuth.id,
      });
      const resList = await fetch(
        `/api/hourly-productions?${params.toString()}`
      );
      const jsonList = await resList.json();
      if (resList.ok && jsonList.success) {
        const allRecords = jsonList.data || [];

        const filtered = filterHourlyByHeaderAndUser(
          allRecords,
          ProductionAuth,
          h._id
        );

        setHourlyRecords(filtered);
        if (filtered.length > 0) {
          const last = filtered[filtered.length - 1];
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 🔹 UI (unchanged, except date change reset + new filtering already handled)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-gray-300 bg-white shadow-sm p-3 space-y-3 w-7x1">
      {/* Header with date selector */}
      <div className="border-b pb-2 flex items-center justify-between text-xs gap-2">
        <div className="font-semibold tracking-wide uppercase">
          Working Hour
        </div>
        <div className="text-[11px] text-slate-600 space-y-0.5 text-right">
          {/* 🔹 Date-wise filter */}
          <div className="flex items-center justify-end gap-1">
            <span className="font-medium">Date:</span>
            <input
              type="date"
              className="rounded border px-2 py-0.5 text-[11px]"
              value={selectedDate}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedDate(value);
                setSelectedHour(1);
                setAchievedInput("");
                setMessage("");
                setError("");
                setHourlyRecords([]);
                setLatestDynamicFromServer(null);
              }}
            />
          </div>

          {h && (
            <>
              <div>
                <span className="font-medium">Production User:</span>{" "}
                {h?.productionUser?.Production_user_name ?? ""}
              </div>
              <div>
                <span className="font-medium">Planned Working Hours:</span>{" "}
                {totalWorkingHours}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      {(headerLoading || error || message) && (
        <div className="text-[11px] space-y-1">
          {headerLoading && (
            <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
              Loading header for {selectedDate}...
            </div>
          )}
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

      {/* If no header for this date */}
      {!h && !headerLoading && (
        <div className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-3 border border-amber-200">
          No production header found for {selectedDate}. Please create/save a
          header first for this date.
        </div>
      )}

      {/* Only show metrics + inputs when header exists */}
      {h && (
        <>
          {/* Live summary */}
          <div className="text-[11px] text-slate-700 bg-slate-50 rounded-lg p-3 space-y-1.5 border border-slate-200">
            <div className="flex justify-between items-center pb-1 border-b border-slate-300">
              <span className="font-semibold text-slate-800">Live Data</span>
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
                <span className="font-medium text-slate-600">
                  Plan Efficiency:
                </span>{" "}
                <span className="font-semibold text-slate-900">
                  {planEfficiencyPercent}%
                </span>
              </div>
              <div>
                <span className="font-medium text-slate-600">Day Target:</span>{" "}
                <span className="font-semibold text-slate-900">
                  {todayTarget}
                </span>
              </div>

              <div>
                <span className="font-medium text-slate-600">
                  Base Target / Hour:
                </span>{" "}
                <span className="font-semibold text-slate-900">
                  {formatNumber(baseTargetPerHour, 0)}
                </span>
              </div>

              <div>
                <span className="font-medium text-slate-600">
                  Carry (shortfall vs base up to previous hour):
                </span>{" "}
                <span className="font-semibold text-amber-700">
                  {formatNumber(cumulativeShortfallVsBasePrevForSelected, 0)}
                </span>
              </div>

              <div className="col-span-2">
                <span className="font-medium text-slate-600">
                  Dynamic target this hour:
                </span>{" "}
                <span className="font-semibold text-blue-700">
                  {formatNumber(dynamicTargetThisHour, 0)}
                </span>
              </div>

              {/* Net variance vs base (to date) */}
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
                  {formatNumber(netVarVsBaseToDateSelected, 0)}
                </span>
              </div>

              {/* Cumulative variance vs dynamic (previous hours) */}
              <div className="col-span-2">
                <span className="font-medium text-slate-600">
                  Cumulative variance (prev vs dynamic):
                </span>{" "}
                <span
                  className={`font-semibold ${
                    cumulativeVarianceDynamicPrev >= 0
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {formatNumber(cumulativeVarianceDynamicPrev, 0)}
                </span>
              </div>
            </div>

            {latestDynamicFromServer !== null && (
              <div className="pt-1 border-t border-slate-200">
                <span className="font-medium text-slate-600">
                  Last Saved Dynamic Target (server):
                </span>{" "}
                <span className="font-semibold text-slate-900">
                  {formatNumber(latestDynamicFromServer, 0)}
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
                  {formatNumber(previousVariance, 0)}
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
                  <th className="px-2 py-2 text-left">
                    Achieved Qty (this hour)
                  </th>
                  <th className="px-2 py-2 text-left">Hourly Efficiency %</th>
                  <th className="px-2 py-2 text-left">Achieve Efficiency</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-2 py-2 align-top">
                    {/* 🔹 Wider select for hour */}
                    <select
                      className="w-32 sm:w-40 rounded border px-2 py-1 text-xs"
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
                      {formatNumber(baseTargetPerHour, 0)}
                    </div>
                    <p className="mt-1 text-[10px] text-gray-500 leading-tight">
                      (Manpower × 60 × Plan % ÷ SMV)
                    </p>
                  </td>

                  <td className="px-2 py-2 align-top">
                    <div className="rounded border bg-amber-50 px-2 py-1">
                      {formatNumber(dynamicTargetThisHour, 0)}
                    </div>
                    <p className="mt-1 text-[10px] text-amber-700 leading-tight">
                      Base + cumulative shortfall vs base
                    </p>
                  </td>

                  <td className="px-2 py-2 align-top">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="w-full rounded border px-2 py-1 text-xs"
                      value={achievedInput}
                      onChange={(e) => setAchievedInput(e.target.value)}
                      placeholder="Output this hour (integer)"
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
                      (Total Hourly Output so far × SMV) ÷ (Manpower × 60 ×
                      Working Hour) * 100
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
              className="rounded bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-800 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Hour"}
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
                No hourly records saved yet for this header on {selectedDate}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-t">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-2 py-1 text-left">Hour</th>
                      <th className="px-2 py-1 text-left">Target</th>
                      <th className="px-2 py-1 text-left">Achieved</th>
                      <th className="px-2 py-1 text-left">
                        Δ Var (hour vs dynamic)
                      </th>
                      <th className="px-2 py-1 text-left">
                        Net Var vs Base (to date)
                      </th>
                      <th className="px-2 py-1 text-left">Hourly Eff %</th>
                      <th className="px-2 py-1 text-left">Achieve Eff</th>
                      <th className="px-2 py-1 text-left">AVG Eff %</th>
                      <th className="px-2 py-1 text-left">Updated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordsDecorated.map((rec) => (
                      <tr key={rec._id} className="border-b">
                        <td className="px-2 py-1">{rec._hourNum}</td>
                        <td className="px-2 py-1">
                          {formatNumber(rec._dynTargetRounded, 0)}
                        </td>
                        <td className="px-2 py-1">{rec._achievedRounded}</td>
                        <td
                          className={`px-2 py-1 ${
                            (rec._perHourVarDynamic ?? 0) >= 0
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {formatNumber(rec._perHourVarDynamic ?? 0, 0)}
                        </td>
                        <td
                          className={`px-2 py-1 ${
                            (rec._netVarVsBaseToDate ?? 0) >= 0
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {formatNumber(rec._netVarVsBaseToDate ?? 0, 0)}
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
        </>
      )}
    </div>
  );
}
