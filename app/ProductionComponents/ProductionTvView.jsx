// app/ProductionComponents/ProductionTvView.js
"use client";

import { useMemo, useState, useEffect } from "react";
import { useProductionAuth } from "../hooks/useProductionAuth";
import {
  Image as ImageIcon,
  PlayCircle,
  Target,
  TrendingUp,
  Activity,
  Zap,
  CheckCircle2,
} from "lucide-react";

/* -------------------------- Shared helpers & UI -------------------------- */

// Shared tone map for KPI + Media tiles (aligned with MediaAndKpisTemplate)
const TONE_MAP = {
  emerald: {
    card:
      "from-emerald-500/15 to-emerald-500/5 border-emerald-400/30 ring-emerald-400/40 text-emerald-100",
    badge: "bg-emerald-500/90 text-emerald-950",
  },
  sky: {
    card:
      "from-sky-500/15 to-sky-500/5 border-sky-400/30 ring-sky-400/40 text-sky-100",
    badge: "bg-sky-400/90 text-sky-950",
  },
  red: {
    card:
      "from-red-500/15 to-red-500/5 border-red-400/30 ring-red-400/40 text-red-100",
    badge: "bg-red-500/90 text-red-50",
  },
  amber: {
    card:
      "from-amber-500/15 to-amber-500/5 border-amber-400/30 ring-amber-400/40 text-amber-100",
    badge: "bg-amber-400/90 text-amber-950",
  },
  purple: {
    card:
      "from-purple-500/15 to-purple-500/5 border-purple-400/30 ring-purple-400/40 text-purple-100",
    badge: "bg-purple-400/90 text-purple-950",
  },
};

const Placeholder = ({ title }) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center">
    <div className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wider text-white/80">
      No {title.toLowerCase()}
    </div>
    <div className="text-xs text-white/60">
      Add {title.toLowerCase()} in Media Links Editor
    </div>
  </div>
);

function KpiTile({ label, value, tone = "emerald", icon: Icon }) {
  const toneMap = TONE_MAP[tone] || TONE_MAP.emerald;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${toneMap.card} bg-gradient-to-br p-2.5 sm:p-3 ring-1 transition-transform duration-200 hover:translate-y-0.5 min-h-[84px]`}
    >
      {/* subtle corner glow */}
      <div className="pointer-events-none absolute -inset-px rounded-[1.1rem] bg-[radial-gradient(120px_60px_at_0%_0%,rgba(255,255,255,0.12),transparent)]" />

      <div className="relative flex items-center justify-between">
        <div
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${toneMap.badge}`}
        >
          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
          {label}
        </div>
        <span className="text-[10px] sm:text-xs text-white/70">KPI</span>
      </div>

      <div className="mt-2 text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

// Media tile styled like in MediaAndKpisTemplate
function MediaTile({ title, icon: Icon, children, tone = "emerald" }) {
  const toneMap = TONE_MAP[tone] || TONE_MAP.emerald;

  return (
    <div
      className={`group relative h-full overflow-hidden rounded-2xl border ${toneMap.card} bg-gradient-to-br p-2.5 sm:p-3 ring-1 shadow-sm transition-transform duration-200 hover:translate-y-0.5`}
    >
      {/* subtle corner glow */}
      <div className="pointer-events-none absolute -inset-px rounded-[1.1rem] bg-[radial-gradient(140px_70px_at_0%_0%,rgba(255,255,255,0.18),transparent)]" />

      <div className="relative flex h-full flex-col gap-1">
        {/* header chip */}
        <div
          className={`inline-flex items-center gap-1 self-start rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${toneMap.badge}`}
        >
          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
          {title}
        </div>

        {/* content area */}
        <div className="relative flex-1 grid place-items-center overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br from-slate-900/80 to-slate-900/30 min-h-[170px] sm:min-h-[220px] md:min-h-[260px] lg:min-h-[300px]">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Small resilient video player ---------------- */
function VideoPlayer({ src }) {
  const [error, setError] = useState(false);

  if (error || !src) {
    return <Placeholder title="Video" />;
  }

  return (
    <video
      key={src}
      className="h-full w-full rounded-xl border border-white/10"
      autoPlay
      loop
      muted
      playsInline
      controls
      onError={() => setError(true)}
    >
      <source src={src} />
      Your browser does not support the video tag.
    </video>
  );
}

/* ---------------- Helpers ---------------- */
function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatNumber(v, digits = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(digits);
}

function toLocalDateLabel(d = new Date()) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ---------------- Main component ---------------- */
export default function ProductionTvView({
  hourlyData = [],
  headerData = [],
  registerData = [], // accepted, not shown
  users = [],
  mediaLinks = [],
}) {
  const { ProductionAuth } = useProductionAuth();
  const [imgError, setImgError] = useState(false);

  const todayLabel = useMemo(() => toLocalDateLabel(), []);

  const productionName =
    ProductionAuth?.Production_user_name ||
    ProductionAuth?.user_name ||
    "Production User";
  const productionId = ProductionAuth?.id || ProductionAuth?._id || null;

  /* ---------------- LIVE STATE (auto-refresh every 3s) ---------------- */

  // 🔹 Use props as initial snapshot; then keep a live copy
  const [liveHeader, setLiveHeader] = useState(null);
  const [liveHourly, setLiveHourly] = useState([]);
  const [liveError, setLiveError] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);

  useEffect(() => {
    // Nothing to do until we know which user
    if (!ProductionAuth?.id) return;

    let cancelled = false;

    const fetchLiveData = async () => {
      try {
        setLiveLoading(true);
        setLiveError("");

        const today = new Date().toISOString().slice(0, 10);

        // 🔹 1) Get today's header for this production user
        const headerParams = new URLSearchParams({
          productionUserId: ProductionAuth.id,
          date: today,
        });

        const headerRes = await fetch(
          `/api/production-headers?${headerParams.toString()}`,
          { cache: "no-store" }
        );
        const headerJson = await headerRes.json();

        if (!headerRes.ok || !headerJson.success) {
          throw new Error(
            headerJson.message || "Failed to load TV header data"
          );
        }

        const headerFromApi = Array.isArray(headerJson.data)
          ? headerJson.data[0]
          : headerJson.data;

        if (!headerFromApi) {
          if (!cancelled) {
            setLiveHeader(null);
            setLiveHourly([]);
          }
          return;
        }

        if (!cancelled) {
          setLiveHeader(headerFromApi);
        }

        // 🔹 2) Get hourly records for that header + user
        const hourlyParams = new URLSearchParams({
          headerId: headerFromApi._id,
          productionUserId: ProductionAuth.id,
        });

        const hourlyRes = await fetch(
          `/api/hourly-productions?${hourlyParams.toString()}`,
          { cache: "no-store" }
        );
        const hourlyJson = await hourlyRes.json();

        if (!hourlyRes.ok || !hourlyJson.success) {
          throw new Error(
            hourlyJson.message || "Failed to load TV hourly data"
          );
        }

        if (!cancelled) {
          setLiveHourly(hourlyJson.data || []);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setLiveError(err.message || "Failed to refresh TV data");
        }
      } finally {
        if (!cancelled) {
          setLiveLoading(false);
        }
      }
    };

    // Initial fetch
    fetchLiveData();

    // 🔁 Poll every 3 seconds
    const intervalId = setInterval(fetchLiveData, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [ProductionAuth?.id]);

  /* ---------------- Header for this production user ---------------- */

  const activeHeader = useMemo(() => {
    // 🔹 Prefer live header (today, from API)
    if (liveHeader) return liveHeader;

    if (!ProductionAuth) return null;
    const nameLower = productionName.trim().toLowerCase();

    const matches = (headerData || []).filter((h) => {
      const headerProd = h?.productionUser || {};
      const headerId = headerProd.id || headerProd._id;
      const headerName =
        headerProd.Production_user_name || headerProd.user_name;

      const idMatch =
        productionId && headerId && String(headerId) === String(productionId);

      const nameMatch =
        headerName && headerName.trim().toLowerCase() === nameLower;

      return idMatch || nameMatch;
    });

    if (!matches.length) return null;

    return matches
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime()
      )[0];
  }, [liveHeader, ProductionAuth, headerData, productionId, productionName]);

  /* ---------------- Hourly records for this header + production user ---------------- */

  const hourlyForUser = useMemo(() => {
    if (!ProductionAuth || !activeHeader) return [];

    const headerId = activeHeader._id;
    const nameLower = productionName.trim().toLowerCase();

    // 🔹 Prefer live hourly data from polling; fallback to props
    const source = liveHourly.length ? liveHourly : hourlyData;

    const filtered = (source || []).filter((r) => {
      const matchHeader =
        r.headerId && String(r.headerId) === String(headerId);

      const prod = r.productionUser || {};
      const rId = prod.id || prod._id;
      const rName = prod.Production_user_name || prod.user_name;

      const idMatch =
        productionId && rId && String(rId) === String(productionId);
      const nameMatch =
        rName && rName.trim().toLowerCase() === nameLower;

      return matchHeader && (idMatch || nameMatch);
    });

    return filtered
      .slice()
      .sort((a, b) => safeNum(a.hour, 0) - safeNum(b.hour, 0));
  }, [
    liveHourly,
    hourlyData,
    activeHeader,
    ProductionAuth,
    productionId,
    productionName,
  ]);

  /* ---------------- Media (image + video) for this user ---------------- */

  const latestMedia = useMemo(() => {
    if (!ProductionAuth) return null;
    const nameLower = productionName.trim().toLowerCase();

    const filtered = (mediaLinks || []).filter((m) => {
      const u = m.user || {};
      const uId = u.id || u._id;
      const uName = u.user_name;

      const idMatch =
        productionId && uId && String(uId) === String(productionId);
      const nameMatch =
        uName && uName.trim().toLowerCase() === nameLower;

      return idMatch || nameMatch;
    });

    if (!filtered.length) return null;

    return filtered
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime()
      )[0];
  }, [mediaLinks, ProductionAuth, productionId, productionName]);

  /* ---------------- Derived numbers & decoration (same logic as WorkingHourCard) ---------------- */

  // Header-derived values
  const totalWorkingHours = activeHeader?.workingHour ?? 1;
  const manpowerPresent = activeHeader?.manpowerPresent ?? 0;
  const smv = activeHeader?.smv ?? 1;
  const planEfficiencyPercent = activeHeader?.planEfficiency ?? 0;
  const planEffDecimal = planEfficiencyPercent / 100;
  const todayTargetRaw = activeHeader?.todayTarget ?? 0;

  // Base target per hour (same formula as WorkingHourCard)
  const targetFromCapacity =
    manpowerPresent > 0 && smv > 0
      ? (manpowerPresent * 60 * planEffDecimal) / smv
      : 0;

  const targetFromTodayTarget =
    totalWorkingHours > 0 ? todayTargetRaw / totalWorkingHours : 0;

  const baseTargetPerHourRaw = targetFromCapacity || targetFromTodayTarget || 0;
  const baseTargetPerHour = Math.round(baseTargetPerHourRaw);

  // Decorate hourly records exactly like WorkingHourCard.jsx
  const recordsDecorated = useMemo(() => {
    const recordsSorted = (hourlyForUser || [])
      .map((rec) => ({ ...rec, _hourNum: Number(rec.hour) }))
      .filter((rec) => Number.isFinite(rec._hourNum))
      .sort((a, b) => a._hourNum - b._hourNum);

    let runningAchieved = 0;

    return recordsSorted.map((rec) => {
      const hourN = rec._hourNum;

      // Baseline vs base (k-1)
      const baselineToDatePrev = baseTargetPerHour * (hourN - 1);
      const cumulativeShortfallVsBasePrev = Math.max(
        0,
        baselineToDatePrev - runningAchieved
      );

      // Dynamic target for this hour = base + shortfall vs base up to (h-1)
      const dynTarget = baseTargetPerHour + cumulativeShortfallVsBasePrev;

      // Rounded achieved for this hour
      const achievedRounded = Math.round(safeNum(rec.achievedQty, 0));

      // Per-hour variance vs dynamic
      const perHourVarDynamic = achievedRounded - dynTarget;

      // Update cumulative achieved
      runningAchieved += achievedRounded;

      // Net variance vs base to date (this hour)
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
  }, [hourlyForUser, baseTargetPerHour]);

  // Target Qty for the day (from header)
  const dayTarget = safeNum(todayTargetRaw);

  // Achieve Qty: sum of rounded achieved
  const totalAchieved = useMemo(
    () =>
      recordsDecorated.reduce(
        (sum, rec) => sum + safeNum(rec._achievedRounded ?? rec.achievedQty, 0),
        0
      ),
    [recordsDecorated]
  );

  // Current hour = last decorated record
  const currentRecord =
    recordsDecorated.length > 0
      ? recordsDecorated[recordsDecorated.length - 1]
      : null;

  const currentHour = currentRecord?._hourNum || null;

  // Variance Qty for current hour: Δ Var (hour vs dynamic)
  const currentVariance = safeNum(currentRecord?._perHourVarDynamic, 0);

  // Hourly Efficiency: from the record
  const currentHourlyEff = safeNum(currentRecord?.hourlyEfficiency, 0);

  // Avg Efficiency: average efficiency across hours
  const avgEff = useMemo(() => {
    if (!recordsDecorated.length) return 0;

    const sum = recordsDecorated.reduce((acc, rec) => {
      const eff =
        rec.achieveEfficiency ??
        rec.hourlyEfficiency ??
        rec.totalEfficiency ??
        0;
      return acc + safeNum(eff, 0);
    }, 0);

    return sum / recordsDecorated.length;
  }, [recordsDecorated]);

  // 🔒 Auth guard
  if (!ProductionAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-6 py-4 text-red-200 max-w-md text-center">
          <div className="text-lg font-semibold mb-2">
            Authentication Required
          </div>
          <div className="text-sm text-red-300/80">
            Please log in as a production user to view the production TV board.
          </div>
        </div>
      </div>
    );
  }

  const imageSrc = latestMedia?.imageSrc || "";
  const videoSrc = latestMedia?.videoSrc || "";

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="relative mx-auto max-w-7xl p-2 sm:p-3 md:p-4 text-white">
        {/* Ambient gradient background */}
        <div className="pointer-events-none absolute -inset-4 -z-10 bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(900px_400px_at_100%_0%,rgba(56,189,248,0.15),transparent)]" />

        {/* Optional live status banner */}
        <div className="mb-2 flex items-center justify-between text-[11px] text-white/70">
          <span>
            {todayLabel}
            {currentHour && (
              <span className="ml-3 text-sky-400">
                • Current Hour: H{currentHour}
              </span>
            )}
          </span>
          <span>
            {liveLoading
              ? "Live updating… (3s)"
              : liveError
              ? `Live error: ${liveError}`
              : "Live • 3s refresh"}
          </span>
        </div>

        {/* Main Grid: Media + KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 md:gap-4">
          {/* LEFT: Media (Image + Video) */}
          <section className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {/* IMAGE */}
            <MediaTile title="Line Image" icon={ImageIcon} tone="sky">
              {imageSrc && !imgError ? (
                <img
                  src={imageSrc}
                  alt="Line Image"
                  className="h-full w-full object-contain select-none"
                  onError={() => setImgError(true)}
                  draggable={false}
                />
              ) : (
                <Placeholder title="Image" />
              )}
            </MediaTile>

            {/* VIDEO */}
            <MediaTile title="Line Video" icon={PlayCircle} tone="emerald">
              {videoSrc ? (
                <VideoPlayer src={videoSrc} />
              ) : (
                <Placeholder title="Video" />
              )}
            </MediaTile>
          </section>

          {/* RIGHT: KPIs (uses live data) */}
          <aside className="flex min-h-0 flex-col gap-2.5 sm:gap-3">
            {/* Target + Achieve */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <KpiTile
                label="Target Qty"
                value={formatNumber(dayTarget, 0)}
                tone="emerald"
                icon={Target}
              />
              <KpiTile
                label="Achieve Qty"
                value={formatNumber(totalAchieved, 0)}
                tone="sky"
                icon={CheckCircle2}
              />
            </div>

            {/* Variance: Δ Var (hour vs dynamic) for latest hour */}
            <KpiTile
              label="Variance Qty"
              value={`${currentVariance >= 0 ? "+" : ""}${formatNumber(
                currentVariance,
                0
              )}`}
              tone={currentVariance >= 0 ? "emerald" : "red"}
              icon={TrendingUp}
            />

            {/* Hourly Eff + Avg Eff */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <KpiTile
                label="Hourly Eff"
                value={`${formatNumber(currentHourlyEff, 1)}%`}
                tone="amber"
                icon={Zap}
              />
              <KpiTile
                label="Avg Eff"
                value={`${formatNumber(avgEff, 1)}%`}
                tone="purple"
                icon={Activity}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
