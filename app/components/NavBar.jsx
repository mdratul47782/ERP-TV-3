"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/hooks/useAuth";
import { useProductionAuth } from "../hooks/useProductionAuth";
import Image from "next/image";

export default function NavBar() {
  const pathname = usePathname() || "/";
  const { auth } = useAuth();
  const { ProductionAuth } = useProductionAuth();

  // 🔹 Device hover detection (keeps your original behavior)
  const [isHoverDevice, setIsHoverDevice] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // 🔹 Hamburger open/close
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: hover)");
    const updateHover = () => {
      setIsHoverDevice(mq.matches);
      setIsVisible(!mq.matches ? true : false);
    };
    updateHover();
    mq.addEventListener("change", updateHover);
    return () => mq.removeEventListener("change", updateHover);
  }, []);

  // 🔹 Close menu whenever route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // 🔹 ESC to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const PATHS = {
    // Quality pages
    home: "/",
    login: "/login",
    daily: auth?.id
      ? `/DailyInProcessedEndLineInspectionReport/${auth.id}`
      : "/login",
    hourlyDashboard: "/HourlyDashboard",
    summary: "/QualitySummary",
    // Production pages
    productionHome: "/ProductionHomePage",
    productionLogin: "/ProductionLogin",
    productionRegister: "/ProductionRegister",
    productionHourlyView: "/ProductionHourlyView",
    // You listed: /ProductionHourlyView (production Summary)
    productionSummary: "/ProductionHourlyView",
  };

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname.toLowerCase().startsWith(href.toLowerCase());
  };

  // 🔹 Small, fixed-height top bar (no size increase)
  const navTranslateClass = !isHoverDevice
    ? "translate-y-0"
    : isVisible
    ? "translate-y-0"
    : "-translate-y-full";

  // 🔹 Icon button (hamburger)
  const IconButton = ({ open }) => (
    <span className="inline-block w-6 h-6 relative" aria-hidden="true">
      <span
        className={`absolute left-0 right-0 h-[2px] top-1 transition-transform ${
          open ? "translate-y-2 rotate-45" : ""
        } bg-slate-900 dark:bg-white`}
      />
      <span
        className={`absolute left-0 right-0 h-[2px] top-3 transition-opacity ${
          open ? "opacity-0" : "opacity-100"
        } bg-slate-900 dark:bg-white`}
      />
      <span
        className={`absolute left-0 right-0 h-[2px] top-5 transition-transform ${
          open ? "-translate-y-2 -rotate-45" : ""
        } bg-slate-900 dark:bg-white`}
      />
    </span>
  );

  // 🔹 Shared link styles
  const itemClass = (active) =>
    `w-full text-left px-3 py-2 rounded-md text-sm font-semibold transition
     focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400
     ${
       active
         ? "bg-emerald-600 text-white"
         : "text-slate-800 hover:bg-black/5 dark:text-gray-200 dark:hover:bg-white/10"
     }`;

  const subtleLabel =
    "px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300";

  const chipClass =
    "rounded-md border border-black/10 bg-black/[0.03] px-2 py-1 text-xs text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white";

  // ✅ Determine who to show on the chip:
  // 1) If a Production user is logged in, show Production_user_name
  //    (supports both object and array shapes).
  // 2) Else if Quality auth is logged in, show auth.user_name.
  // 3) Else show "Guest".
  const prodUserObj = Array.isArray(ProductionAuth)
    ? ProductionAuth[0]
    : ProductionAuth;
  const prodUserName = prodUserObj?.Production_user_name;
  const qualityUserName = auth?.user_name;
  const displayName = prodUserName || qualityUserName || "Guest";

  // 🔐 Quality login state only controls the Quality login/logout button
  const isLoggedIn = auth !== null && auth !== undefined;

  const authButtonClass = (active) =>
    `w-full text-left px-3 py-2 rounded-md text-sm font-semibold transition
     focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
     ${
       isLoggedIn
         ? active
           ? "bg-red-700 text-white"
           : "bg-red-600 text-white hover:bg-red-700"
         : active
         ? "bg-indigo-700 text-white"
         : "bg-indigo-600 text-white hover:bg-indigo-700"
     }`;

  // Hover handlers only for hover devices (desktop)
  const hoverHandlers = isHoverDevice
    ? {
        onMouseEnter: () => setIsVisible(true),
        onMouseLeave: () => setIsVisible(false),
      }
    : {};

  return (
    <>
      {/* Thin hover strip to reveal nav on desktops */}
      {isHoverDevice && (
        <div
          className="fixed top-0 left-0 right-0 h-2 z-[40]"
          onMouseEnter={() => setIsVisible(true)}
        />
      )}

      {/* 🔹 Top bar (fixed height) */}
      <nav
        role="navigation"
        aria-label="Primary"
        {...hoverHandlers}
        className={`
          fixed top-0 left-0 right-0 z-50
          transform transition-transform duration-300
          ${navTranslateClass}
          border-b border-slate-200/60 bg-white/70 backdrop-blur
          dark:border-white/10 dark:bg-black/70
          shadow-[inset_0_-1px_0_rgba(0,0,0,0.04)] dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]
        `}
      >
        <div className="mx-auto max-w-7xl px-3 md:px-4">
          <div className="flex min-h-14 items-center justify-between gap-3 py-1">
            {/* Brand */}
            <Link
              href={PATHS.home}
              className="group flex items-center gap-2 rounded-md p-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              aria-label="HKD Home"
            >
              <Image
                src="/ChatGPT Image Nov 14, 2025, 08_47_05 PM.png"
                alt="HKD Outdoor Innovations Ltd. Logo"
                width={30}
                height={30}
                className="rounded-md bg-amber-50"
                priority
              />
              <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white md:text-lg">
                HKD
              </span>
            </Link>

            {/* 🔹 Right side: user chip (compact) + hamburger */}
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-slate-600 dark:text-gray-300">
                  person
                </span>
                <span className={chipClass}>{displayName}</span>
              </div>

              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={isOpen}
                aria-controls="main-menu"
                onClick={() => setIsOpen((v) => !v)}
                className="inline-flex items-center justify-center rounded-md p-2
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400
                           hover:bg-black/5 dark:hover:bg-white/10"
              >
                <IconButton open={isOpen} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 🔹 Overlay + Slide-down panel (does NOT change navbar height) */}
      <div
        className={`fixed inset-0 z-[60] transition ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!isOpen}
        onClick={() => setIsOpen(false)}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/30 transition-opacity ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Panel */}
        <div
          id="main-menu"
          role="menu"
          aria-label="Main"
          className={`absolute left-1/2 top-0 w-[min(720px,92vw)] -translate-x-1/2 rounded-b-2xl
                      border border-slate-200/60 bg-white/90 backdrop-blur shadow-xl
                      dark:border-white/10 dark:bg-black/80
                      transition-transform duration-300 ${
                        isOpen ? "translate-y-0" : "-translate-y-full"
                      }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header row inside panel */}
          <div className="flex items-center justify-between px-3 md:px-4 py-3 border-b border-black/5 dark:border-white/10">
            <div className="flex items-center gap-2 md:hidden">
              <span className="material-symbols-outlined text-base text-slate-600 dark:text-gray-300">
                person
              </span>
              <span className={chipClass}>{displayName}</span>
            </div>
            <button
              className="ml-auto rounded-md p-2 hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              onClick={() => setIsOpen(false)}
              aria-label="Close menu"
            >
              {/* X icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Menu content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 md:p-4">
            {/* QUALITY */}
            <div>
              <div className={subtleLabel}>Quality</div>
              <div className="flex flex-col gap-1">
                <Link
                  href={PATHS.home}
                  className={itemClass(isActive(PATHS.home))}
                >
                  Home
                </Link>

                <Link
                  href={PATHS.daily}
                  className={`${itemClass(
                    isActive("/DailyInProcessedEndLineInspectionReport")
                  )} ${auth?.id ? "" : "opacity-60"}`}
                  title={auth?.id ? "" : "Login required"}
                >
                  Inspection Report
                </Link>

                <Link
                  href={PATHS.hourlyDashboard}
                  className={itemClass(isActive(PATHS.hourlyDashboard))}
                >
                  Hourly Inspection Dashboard
                </Link>

                <Link
                  href={PATHS.summary}
                  className={itemClass(isActive(PATHS.summary))}
                >
                  Quality Summary
                </Link>

                {/* Quality Login/Logout */}
                <Link
                  href={PATHS.login}
                  className={authButtonClass(isActive(PATHS.login))}
                >
                  {isLoggedIn ? "Logout" : "Login"}
                </Link>
              </div>
            </div>

            {/* PRODUCTION */}
            <div>
              <div className={subtleLabel}>Production</div>
              <div className="flex flex-col gap-1">
                <Link
                  href={PATHS.productionHome}
                  className={itemClass(isActive(PATHS.productionHome))}
                >
                  Home
                </Link>
                {/* <Link
                  href={PATHS.productionHourlyView}
                  className={itemClass(isActive(PATHS.productionHourlyView))}
                >
                  Hourly View
                </Link> */}
                <Link
                  href={PATHS.productionSummary}
                  className={itemClass(isActive(PATHS.productionSummary))}
                >
                  Summary
                </Link>
                <Link
                  href={PATHS.productionLogin}
                  className={itemClass(isActive(PATHS.productionLogin))}
                >
                  Login
                </Link>
                <Link
                  href={PATHS.productionRegister}
                  className={itemClass(isActive(PATHS.productionRegister))}
                >
                  Register
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
