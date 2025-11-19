// app/ProductionComponents/ProductionTvView.js
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useProductionAuth } from "../hooks/useProductionAuth";
import {
  Image as ImageIcon,
  PlayCircle,
  Target,
  TrendingUp,
  Activity,
  Zap,
  CheckCircle2,
  ArrowRightCircle,
} from "lucide-react";

/* -------------------------- Shared helpers & UI -------------------------- */

// Shared tone map for KPI + Media tiles
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
      className={`group relative overflow-hidden rounded-2xl border ${toneMap.card} bg-gradient-to-br p-2.5 sm:p-3 ring-1 transition-transform duration-200 hover:-translate-y-0.5 min-h-[90px]`}
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
        {/* <span className="text-[10px] sm:text-xs text-white/70">KPI</span> */}
      </div>

      <div className="mt-2 text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

/* -------- Mini bar chart for variance (H1 → current hour) -------- */

function VarianceMiniBar({ data = [] }) {
  if (!data.length) {
    return (
      <div className="flex h-16 items-center justify-center rounded-lg border border-white/10 bg-slate-900/40 text-[10px] text-white/50">
        No variance data yet
      </div>
    );
  }

  // 🔹 Slightly responsive width based on number of bars
  const baseWidth = 220;
  const width = Math.max(baseWidth, data.length * 18 + 24);
  const height = 72;
  const baseline = height * 0.55;

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value || 0)), 1);
  const barGap = 6;
  const barWidth = Math.max(
    4,
    (width - barGap * (data.length + 1)) / data.length
  );

  const gridLines = 4;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-20 rounded-xl border border-white/10 bg-gradient-to-b from-slate-900/90 via-slate-950 to-black/80"
    >
      <defs>
        {/* 🔹 Positive bars gradient */}
        <linearGradient id="variance-bar-positive" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>

        {/* 🔹 Negative bars gradient */}
        <linearGradient id="variance-bar-negative" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f97373" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>

        {/* 🔹 Soft shadow for bars */}
        <filter id="variance-bar-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="1"
            stdDeviation="1.2"
            floodColor="rgba(15,23,42,0.65)"
          />
        </filter>
      </defs>

      {/* vertical grid lines */}
      {Array.from({ length: gridLines }).map((_, idx) => {
        const x = ((idx + 1) / (gridLines + 1)) * width;
        return (
          <line
            key={`grid-${idx}`}
            x1={x}
            x2={x}
            y1={6}
            y2={height - 6}
            stroke="rgba(148,163,184,0.16)"
            strokeWidth="0.6"
            strokeDasharray="4 4"
          />
        );
      })}

      {/* zero line */}
      <line
        x1="0"
        x2={width}
        y1={baseline}
        y2={baseline}
        stroke="rgba(148,163,184,0.8)"
        strokeWidth="1"
        strokeDasharray="3 3"
      />

      {/* bars per hour */}
      {data.map((d, idx) => {
        const v = d.value || 0;
        const h = (Math.abs(v) / maxAbs) * (height / 2 - 10);
        const x = barGap + idx * (barWidth + barGap);
        const y = v >= 0 ? baseline - h : baseline;
        const fill =
          v >= 0 ? "url(#variance-bar-positive)" : "url(#variance-bar-negative)";

        return (
          <g key={d.hour ?? idx} filter="url(#variance-bar-shadow)">
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx="3"
              ry="3"
              fill={fill}
              opacity="0.95"
              style={{
                transition: "height 220ms ease-out, y 220ms ease-out",
              }}
            >
              {/* 🔹 Native SVG tooltip */}
              <title>
                {`H${d.hour ?? idx + 1}: ${
                  v >= 0 ? "+" : ""
                }${v.toFixed(0)} vs target`}
              </title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

// KPI tile with bar chart inside (for Variance Qty)
function KpiBarTile({
  label,
  value,
  tone = "emerald",
  icon: Icon,
  data = [],
}) {
  const toneMap = TONE_MAP[tone] || TONE_MAP.emerald;
  const lastHour = data.length ? data[data.length - 1].hour : null;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${toneMap.card} bg-gradient-to-br p-2.5 sm:p-3 ring-1 transition-transform duration-200 hover:-translate-y-0.5 min-h-[150px]`}
    >
      {/* subtle corner glow */}
      <div className="pointer-events-none absolute -inset-px rounded-[1.1rem] bg-[radial-gradient(120px_60px_at_0%_0%,rgba(255,255,255,0.12),transparent)]" />

      <div className="relative flex flex-col gap-2">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${toneMap.badge}`}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {label}
          </div>
          {/* <span className="text-[10px] sm:text-xs text-white/70">KPI</span> */}
        </div>

        {/* Value + range info */}
        <div className="flex items-end justify-between gap-2">
          <div className="text-2xl sm:text-3xl font-extrabold tabular-nums text-white">
            {value}
          </div>
          <div className="text-[10px] text-white/60">
            {lastHour ? `H1 → H${lastHour}` : "No hours"}
          </div>
        </div>

        {/* Mini bar chart */}
        <VarianceMiniBar data={data} />
      </div>
    </div>
  );
}

// KPI tile with pie chart inside
function KpiPieTile({
  label,
  tone = "amber",
  icon: Icon,
  valuePercent = 0,
  pieData = [],
}) {
  const toneMap = TONE_MAP[tone] || TONE_MAP.emerald;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${toneMap.card} bg-gradient-to-br p-2.5 sm:p-3 ring-1 transition-transform duration-200 hover:-translate-y-0.5 min-h-[150px]`}
    >
      {/* subtle corner glow */}
      <div className="pointer-events-none absolute -inset-px rounded-[1.1rem] bg-[radial-gradient(130px_60px_at_0%_0%,rgba(255,255,255,0.14),transparent)]" />

      <div className="relative flex flex-col gap-2">
        {/* Header chip + label row */}
        <div className="flex items-center justify-between">
          <div
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${toneMap.badge}`}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {label}
          </div>
          {/* <span className="text-[10px] sm:text-xs text-white/70">KPI</span> */}
        </div>

        {/* Pie only (percentage inside the donut) */}
        <div className="flex items-center justify-center">
          <DefectsPie
            defects={pieData}
            size={130}
            thickness={18}
            centerTitle=""
            centerValue={valuePercent}
            showPercent
          />
        </div>
      </div>
    </div>
  );
}

// Navigation KPI tile to go to another page
function NavKpiTile({
  href,
  label,
  description,
  tone = "sky",
  icon: Icon = ArrowRightCircle,
}) {
  const toneMap = TONE_MAP[tone] || TONE_MAP.sky;

  return (
    <Link href={href} className="group block">
      <div
        className={`relative overflow-hidden rounded-2xl border ${toneMap.card} bg-gradient-to-br px-2.5 py-2 ring-1 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:ring-2 cursor-pointer`}
      >
        <div className="pointer-events-none absolute -inset-px rounded-[1.1rem] bg-[radial-gradient(140px_70px_at_0%_0%,rgba(255,255,255,0.18),transparent)]" />

        <div className="relative flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="inline-flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-900">
              {Icon ? <Icon className="h-3 w-3" /> : null}
              Go to Screen
            </div>
            <div className="text-xs sm:text-sm font-semibold text-white">
              {label}
            </div>
            {description && (
              <p className="text-[10px] sm:text-[11px] text-white/70">
                {description}
              </p>
            )}
          </div>

          <div className="shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-slate-950/40 transition-colors group-hover:bg-white group-hover:text-slate-900">
              <ArrowRightCircle className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Media tile
function MediaTile({ title, icon: Icon, children, tone = "emerald" }) {
  const toneMap = TONE_MAP[tone] || TONE_MAP.emerald;

  return (
    <div
      className={`group relative h-full overflow-hidden rounded-2xl border ${toneMap.card} bg-gradient-to-br p-2.5 sm:p-3 ring-1 shadow-sm transition-transform duration-200 hover:-translate-y-0.5`}
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
        <div className="relative flex-1 grid place-items-center overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br from-slate-900/80 to-slate-900/30">
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
      className="h-full w-full rounded-xl border border-white/10 object-cover"
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

/* ----- normalize for pie (top N + "Others") ----- */
function normalizeDefects(defects = [], maxItems = 3) {
  const cleaned = (defects || [])
    .map((d) => ({
      label: d.label ?? d.name ?? "-",
      value: safeNum(d.value ?? d.count ?? d.qty, 0),
    }))
    .filter((d) => d.value > 0);

  if (!cleaned.length) return [];

  cleaned.sort((a, b) => b.value - a.value);

  if (cleaned.length <= maxItems) return cleaned;

  const top = cleaned.slice(0, maxItems - 1);
  const rest = cleaned.slice(maxItems - 1);
  const othersTotal = rest.reduce((sum, d) => sum + d.value, 0);

  return [
    ...top,
    {
      label: "Others",
      value: othersTotal,
    },
  ];
}

/* ---------------- Donut / Pie component ---------------- */
function DefectsPie({
  defects,
  size = 150,
  thickness = 18,
  centerTitle = "Metric",
  centerValue,
  showPercent = false,
}) {
  const norm = normalizeDefects(defects, 3);
  const total = norm.reduce((a, b) => a + b.value, 0);

  const COLORS = ["#22c55e", "#eab308", "#3b82f6"]; // emerald, amber, sky
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  const EPS = 0.5; // seam trim
  let acc = 0;

  const displayValue =
    typeof centerValue === "number" ? centerValue : total;

  return (
    <div className="relative grid place-items-center sm:scale-100 scale-95">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-[0_0_18px_rgba(15,23,42,0.85)]"
      >
        <defs>
          <radialGradient id="pieGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g transform={`translate(${size / 2} ${size / 2}) rotate(-90)`}>
          {/* base ring */}
          <circle
            r={r}
            fill="none"
            stroke="rgba(148,163,184,0.35)"
            strokeWidth={thickness}
          />

          {/* slices */}
          {total > 0 &&
            norm.map((s, i) => {
              const frac = s.value / total;
              const dash = Math.max(0, c * frac - EPS);
              const gap = Math.max(0, c - dash);
              const dashoffset = c * (1 - acc);
              acc += frac;

              return (
                <circle
                  key={i}
                  r={r}
                  fill="none"
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={dashoffset}
                />
              );
            })}
        </g>

        {/* soft inner glow */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r - thickness}
          fill="url(#pieGlow)"
        />
      </svg>

      {/* center total / % */}
      <div className="pointer-events-none absolute grid place-items-center text-center">
        {centerTitle && (
          <div className="text-[11px] uppercase tracking-wider text-white/60 mb-0.5">
            {centerTitle}
          </div>
        )}
        <div className="text-2xl sm:text-3xl font-extrabold tabular-nums text-white">
          {showPercent
            ? `${displayValue.toFixed(1)}%`
            : displayValue.toFixed(0)}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main component ---------------- */
export default function ProductionTvView({
  hourlyData = [],
  headerData = [],
  registerData = [],
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

  /* ----- LIVE STATE (auto-refresh every 3s) ----- */
  const [liveHeader, setLiveHeader] = useState(null);
  const [liveHourly, setLiveHourly] = useState([]);
  const [liveError, setLiveError] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);

  useEffect(() => {
    if (!ProductionAuth?.id) return;

    let cancelled = false;

    const fetchLiveData = async () => {
      try {
        setLiveLoading(true);
        setLiveError("");

        const today = new Date().toISOString().slice(0, 10);

        // 1) Header
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

        // 2) Hourly
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

    fetchLiveData();
    const intervalId = setInterval(fetchLiveData, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [ProductionAuth?.id]);

  /* ----- active header ----- */
  const activeHeader = useMemo(() => {
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

  /* ----- hourly for user ----- */
  const hourlyForUser = useMemo(() => {
    if (!ProductionAuth || !activeHeader) return [];

    const headerId = activeHeader._id;
    const nameLower = productionName.trim().toLowerCase();
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

  /* ----- media links ----- */
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

  /* ----- derived KPIs ----- */
  const totalWorkingHours = activeHeader?.workingHour ?? 1;
  const manpowerPresent = activeHeader?.manpowerPresent ?? 0;
  const smv = activeHeader?.smv ?? 1;
  const planEfficiencyPercent = activeHeader?.planEfficiency ?? 0;
  const planEffDecimal = planEfficiencyPercent / 100;
  const todayTargetRaw = activeHeader?.todayTarget ?? 0;

  const targetFromCapacity =
    manpowerPresent > 0 && smv > 0
      ? (manpowerPresent * 60 * planEffDecimal) / smv
      : 0;

  const targetFromTodayTarget =
    totalWorkingHours > 0 ? todayTargetRaw / totalWorkingHours : 0;

  const baseTargetPerHourRaw = targetFromCapacity || targetFromTodayTarget || 0;
  const baseTargetPerHour = Math.round(baseTargetPerHourRaw);

  const recordsDecorated = useMemo(() => {
    const recordsSorted = (hourlyForUser || [])
      .map((rec) => ({ ...rec, _hourNum: Number(rec.hour) }))
      .filter((rec) => Number.isFinite(rec._hourNum))
      .sort((a, b) => a._hourNum - b._hourNum);

    let runningAchieved = 0;

    return recordsSorted.map((rec) => {
      const hourN = rec._hourNum;

      const baselineToDatePrev = baseTargetPerHour * (hourN - 1);
      const cumulativeShortfallVsBasePrev = Math.max(
        0,
        baselineToDatePrev - runningAchieved
      );

      const dynTarget = baseTargetPerHour + cumulativeShortfallVsBasePrev;

      const achievedRounded = Math.round(safeNum(rec.achievedQty, 0));
      const perHourVarDynamic = achievedRounded - dynTarget;

      // 🔹 Hourly Efficiency Calculation (fallback if backend not present)
      let calculatedHourlyEff = 0;
      if (manpowerPresent > 0) {
        calculatedHourlyEff =
          (achievedRounded * smv * 100) / (manpowerPresent * 60);
      }

      runningAchieved += achievedRounded;

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
        _calculatedHourlyEff: calculatedHourlyEff,
      };
    });
  }, [hourlyForUser, baseTargetPerHour, manpowerPresent, smv]);

  const dayTarget = safeNum(todayTargetRaw);
  const totalAchieved = useMemo(
    () =>
      recordsDecorated.reduce(
        (sum, rec) => sum + safeNum(rec._achievedRounded ?? rec.achievedQty, 0),
        0
      ),
    [recordsDecorated]
  );

  const currentRecord =
    recordsDecorated.length > 0
      ? recordsDecorated[recordsDecorated.length - 1]
      : null;

  const currentHour = currentRecord?._hourNum || null;

  // 🔹 Net variance vs base (cumulative)
  const currentVariance = safeNum(currentRecord?._netVarVsBaseToDate, 0);

  // 🔹 Use backend Hourly Eff if present, else fallback to our calculated value
  const currentHourlyEff = safeNum(
    currentRecord?.hourlyEfficiency ?? currentRecord?._calculatedHourlyEff,
    0
  );

  // 🔹 Use backend Total / Avg Eff from last record so TV = WorkingHourCard "AVG Eff %"
  const avgEff = useMemo(() => {
    if (!recordsDecorated.length) return 0;

    const last = recordsDecorated[recordsDecorated.length - 1];

    // Prefer backend's running average (same as table "AVG Eff %")
    const backendAvg = Number(last?.totalEfficiency);
    if (Number.isFinite(backendAvg)) {
      return backendAvg;
    }

    // Fallback: compute average from calculated hourly efficiencies
    const sum = recordsDecorated.reduce(
      (acc, rec) => acc + safeNum(rec._calculatedHourlyEff, 0),
      0
    );
    return sum / recordsDecorated.length;
  }, [recordsDecorated]);

  /* ----- variance series for bar chart (H1 → current H) ----- */
  const varianceSeries = useMemo(
    () =>
      recordsDecorated.map((rec) => ({
        hour: rec._hourNum,
        value: safeNum(rec._perHourVarDynamic, 0),
      })),
    [recordsDecorated]
  );

  /* ----- pies data for Hourly Eff & Avg Eff ----- */
  const hourlyEffPieData = useMemo(() => {
    const rawEff = safeNum(currentHourlyEff, 0);
    const visualEff = Math.max(0, Math.min(100, rawEff));
    const visualLoss = 100 - visualEff;

    if (rawEff === 0) {
      return [];
    }

    return [
      { label: "Eff", value: visualEff },
      { label: "Loss", value: visualLoss },
    ];
  }, [currentHourlyEff]);

  const avgEffPieData = useMemo(() => {
    const rawEff = safeNum(avgEff, 0);
    const visualEff = Math.max(0, Math.min(100, rawEff));
    const visualLoss = 100 - visualEff;

    if (rawEff === 0) {
      return [];
    }

    return [
      { label: "Avg Eff", value: visualEff },
      { label: "Loss", value: visualLoss },
    ];
  }, [avgEff]);

  /* ----- Auth guard ----- */
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
        {/* background */}
        <div className="pointer-events-none absolute -inset-4 -z-10 bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(16,185,129,0.15),transparent),radial-gradient(900px_400px_at_100%_0%,rgba(56,189,248,0.15),transparent)]" />

        {/* live status */}
        <div className="mb-2 flex items-center justify-between text-[20px] text-white/70">
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

        {/* main grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 md:gap-4 items-stretch">
          {/* LEFT: media */}
          <section className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 min-h-[360px] sm:min-h-[420px]">
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

            <MediaTile title="Line Video" icon={PlayCircle} tone="emerald">
              {videoSrc ? (
                <VideoPlayer src={videoSrc} />
              ) : (
                <Placeholder title="Video" />
              )}
            </MediaTile>
          </section>

          {/* RIGHT: KPIs */}
          <aside className="flex min-h-[360px] sm:min-h-[420px] flex-col gap-2.5 sm:gap-3">
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

            {/* Variance with bar chart H1 → current H */}
            <KpiBarTile
              label="Variance Qty"
              value={`${
                currentVariance >= 0 ? "+" : ""
              }${formatNumber(currentVariance, 0)}`}
              tone={currentVariance >= 0 ? "emerald" : "red"}
              icon={TrendingUp}
              data={varianceSeries}
            />

            {/* Eff KPI tiles with graph inside */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <KpiPieTile
                label="Hourly Eff"
                tone="amber"
                icon={Zap}
                valuePercent={safeNum(currentHourlyEff, 0)}
                pieData={hourlyEffPieData}
              />
              <KpiPieTile
                label="Avg Eff"
                tone="purple"
                icon={Activity}
                valuePercent={safeNum(avgEff, 0)}
                pieData={avgEffPieData}
              />
            </div>

            {/* Nav KPI tile to Production Home */}
            <NavKpiTile
              href="/ProductionHomePage"
              label="Production Home Page"
              description="Open Production Home Page and see working hour details."
              tone="sky"
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
