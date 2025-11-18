// app/components/ProductionInputForm.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ProductionSignInOut from "../components/auth/ProductionSignInOut";
import { useProductionAuth } from "../hooks/useProductionAuth";
import { useAuth } from "../hooks/useAuth";

export default function ProductionInputForm() {
  const { ProductionAuth, loading: productionLoading } = useProductionAuth();
  const { auth, loading: authLoading } = useAuth();

  // 🔹 Detect user timezone + compute today's YYYY-MM-DD (local to user)
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );
  const computeTodayKey = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date()); // YYYY-MM-DD

  const [todayKey, setTodayKey] = useState(computeTodayKey);
  const lastTickRef = useRef(Date.now());

  // 🔹 Main form state
  const [form, setForm] = useState({
    operatorTo: "",
    manpowerPresent: "",
    manpowerAbsent: "",
    workingHour: "",
    planQuantity: "",
    planEfficiency: "",
    todayTarget: "",
    achieve: "",
    smv: "",
  });

  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [headerId, setHeaderId] = useState(null);

  // 🔹 Map header doc → form state
  const fillFormFromHeader = (header) => {
    if (!header) return;
    setForm({
      operatorTo: header.operatorTo?.toString() ?? "",
      manpowerPresent: header.manpowerPresent?.toString() ?? "",
      manpowerAbsent: header.manpowerAbsent?.toString() ?? "",
      workingHour: header.workingHour?.toString() ?? "",
      planQuantity: header.planQuantity?.toString() ?? "",
      planEfficiency: header.planEfficiency?.toString() ?? "",
      todayTarget: header.todayTarget?.toString() ?? "",
      achieve: header.achieve?.toString() ?? "",
      smv: header.smv?.toString() ?? "",
    });
  };

  // 🔹 Reset form
  const resetForm = () =>
    setForm({
      operatorTo: "",
      manpowerPresent: "",
      manpowerAbsent: "",
      workingHour: "",
      planQuantity: "",
      planEfficiency: "",
      todayTarget: "",
      achieve: "",
      smv: "",
    });

  // 🔹 Auto-clear at midnight (user's local timezone)
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      // avoid too-frequent cpu wakeups; check at most once/minute
      if (now - lastTickRef.current < 60_000) return;
      lastTickRef.current = now;

      const current = computeTodayKey();
      if (current !== todayKey) {
        console.log(`📅 New day detected: ${todayKey} → ${current}`);
        setTodayKey(current); // triggers data refetch below
        setHeaderId(null);
        resetForm(); // clear inputs for the new day
        setError("");
        setSuccess("");
      }
    };

    const id = setInterval(tick, 20_000); // check every 20 seconds
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey, timeZone]);

  // 🔹 Load "today's" header for this production user (in user's local TZ)
  useEffect(() => {
    if (productionLoading) return;
    if (!ProductionAuth?.id) {
      // No user logged in, ensure form is blank
      setHeaderId(null);
      resetForm();
      return;
    }

    const fetchToday = async () => {
      try {
        setLoadingExisting(true);
        setError("");
        setSuccess("");

        const url = new URL("/api/production-headers", window.location.origin);
        url.searchParams.set("productionUserId", ProductionAuth.id);
        url.searchParams.set("date", todayKey);

        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();

        if (res.ok && json.success && json.data) {
          // Found existing data for today (treat as "already submitted")
          fillFormFromHeader(json.data);
          setHeaderId(json.data._id);
        } else {
          // No data for today - blank form
          setHeaderId(null);
          resetForm();
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load today's production header");
        setHeaderId(null);
        resetForm();
      } finally {
        setLoadingExisting(false);
      }
    };

    fetchToday();
  }, [productionLoading, ProductionAuth?.id, todayKey]);

  // 🔹 Handle input change + auto Manpower Absent
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => {
      const next = { ...prev, [name]: value };

      // Auto-calc Manpower Absent when Total Man Power / Present change
      if (name === "operatorTo" || name === "manpowerPresent") {
        const total = Number(next.operatorTo);
        const present = Number(next.manpowerPresent);

        if (
          next.operatorTo !== "" &&
          next.manpowerPresent !== "" &&
          Number.isFinite(total) &&
          Number.isFinite(present)
        ) {
          const diff = total - present;
          next.manpowerAbsent = diff >= 0 ? diff.toString() : "0";
        } else {
          next.manpowerAbsent = "";
        }
      }

      return next;
    });
  };

  // 🔹 Snapshots (no password)
  const buildProductionUserSnapshot = () => {
    if (!ProductionAuth) return null;
    return {
      id: ProductionAuth.id,
      Production_user_name: ProductionAuth.Production_user_name,
      phone: ProductionAuth.phone,
      bio: ProductionAuth.bio,
    };
  };

  const buildQualityUserSnapshot = () => {
    if (!auth) return null;
    return {
      id: auth.id,
      user_name: auth.user_name,
      phone: auth.phone,
      bio: auth.bio,
    };
  };

  // 🔹 Auto-computed TODAY TARGET
  const computedTodayTarget = useMemo(() => {
    const manpower = Number(form.manpowerPresent);
    const hours = Number(form.workingHour);
    const smv = Number(form.smv);
    const effPct = Number(form.planEfficiency);

    if (!Number.isFinite(manpower) || manpower <= 0) return "";
    if (!Number.isFinite(hours) || hours <= 0) return "";
    if (!Number.isFinite(smv) || smv <= 0) return "";
    if (!Number.isFinite(effPct) || effPct <= 0) return "";

    const totalWorkingTimeMinutes = manpower * hours * 60; // minutes
    const eff = effPct / 100;

    const target = (totalWorkingTimeMinutes / smv) * eff;

    if (!Number.isFinite(target) || target <= 0) return "";
    return Math.round(target);
  }, [
    form.manpowerPresent,
    form.workingHour,
    form.smv,
    form.planEfficiency,
  ]);

  // 🔹 Save / Update (single submission per date)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!ProductionAuth?.id) {
      setError("Production user not authenticated.");
      return;
    }

    // If already submitted for today, block submitting again
    if (headerId) {
      setError("Today's production header is already submitted. You cannot submit again today.");
      return;
    }

    // Confirm box before first submit for current date
    const confirmed = window.confirm(
      "Are you sure you want to submit today's production header? You won't be able to edit it again today."
    );
    if (!confirmed) return;

    setSaving(true);

    try {
      const computedTargetNumber = Number(computedTodayTarget);
      const finalTodayTarget =
        Number.isFinite(computedTargetNumber) && computedTargetNumber > 0
          ? computedTargetNumber
          : Number(form.todayTarget) || 0;

      const payload = {
        ...form,
        todayTarget: finalTodayTarget,
        productionUser: buildProductionUserSnapshot(),
        qualityUser: buildQualityUserSnapshot(),
        productionDate: todayKey, // always bind to today's date on first submit
      };

      const endpoint = "/api/production-headers";
      const method = "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const msg =
          json?.errors?.join(", ") ||
          json?.message ||
          "Failed to save production header";
        throw new Error(msg);
      }

      const saved = json.data;
      fillFormFromHeader(saved);
      setHeaderId(saved._id); // 🔹 this locks the form for today

      setSuccess("Production header submitted successfully for today.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  // 🔹 Delete header (today's one if loaded)
  const handleDelete = async () => {
    if (!headerId) return;
    setError("");
    setSuccess("");
    setDeleting(true);

    try {
      const res = await fetch(`/api/production-headers/${headerId}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const msg =
          json?.message || "Failed to delete production header record";
        throw new Error(msg);
      }

      resetForm();
      setHeaderId(null);
      setSuccess("Production header deleted successfully. You can submit again for today.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong while deleting.");
    } finally {
      setDeleting(false);
    }
  };

  const busy =
    saving || deleting || loadingExisting || productionLoading || authLoading;

  const isExisting = Boolean(headerId);
  const hasSubmittedToday = isExisting; // clearer alias

  return (
    <div className="space-y-3">
      {/* Auth widget */}
      <ProductionSignInOut />

      {/* Card */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm p-3 md:p-4 space-y-3"
      >
        {/* Title */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm md:text-base font-semibold text-slate-900">
            Production Header ({todayKey})
          </h2>
          <p className="text-[11px] text-slate-500">
            Daily production & manpower summary.
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
            {error}
          </div>
        )}
        {success && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5">
            {success}
          </div>
        )}

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field
            label="Total Man Power"
            name="operatorTo"
            value={form.operatorTo}
            onChange={handleChange}
            placeholder="32"
            type="number"
          />
          <Field
            label="Manpower Present"
            name="manpowerPresent"
            value={form.manpowerPresent}
            onChange={handleChange}
            placeholder="30"
            type="number"
          />
          {/* Auto-calculated from Total - Present */}
          <Field
            label="Manpower Absent (auto)"
            name="manpowerAbsent"
            value={form.manpowerAbsent}
            placeholder="Auto = Total - Present"
            type="number"
            readOnly
          />
          <Field
            label="Working Hour"
            name="workingHour"
            value={form.workingHour}
            onChange={handleChange}
            placeholder="8"
            type="number"
          />
          <Field
            label="Plan Quantity"
            name="planQuantity"
            value={form.planQuantity}
            onChange={handleChange}
            placeholder="2000"
            type="number"
          />
          <Field
            label="Plan Efficiency (%)"
            name="planEfficiency"
            value={form.planEfficiency}
            onChange={handleChange}
            placeholder="90"
            type="number"
          />
          <Field
            label="SMV (minutes)"
            name="smv"
            value={form.smv}
            onChange={handleChange}
            placeholder="1.2"
            type="number"
          />

          {/* Today Target = auto-calculated, read-only */}
          <Field
            label="Today Target (auto)"
            name="todayTarget"
            value={
              computedTodayTarget === ""
                ? form.todayTarget
                : computedTodayTarget.toString()
            }
            onChange={() => {}}
            placeholder="Auto from manpower, hour, SMV, efficiency"
            type="number"
            readOnly
          />

          <Field
            label="Achieve (optional)"
            name="achieve"
            value={form.achieve}
            onChange={handleChange}
            placeholder="700"
            type="number"
          />
        </div>

        {/* Footer buttons */}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={resetForm}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
            disabled={busy}
          >
            Clear
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60"
            disabled={busy || !isExisting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>

          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-70"
            disabled={busy || hasSubmittedToday}
          >
            {hasSubmittedToday
              ? "Already Submitted"
              : saving
              ? "Saving..."
              : "Save Header"}
          </button>
        </div>
      </form>
    </div>
  );
}

// 🔹 Compact reusable field
function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={name}
        className="text-[11px] font-medium uppercase tracking-wide text-slate-600"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        value={value}
        onChange={readOnly ? undefined : onChange}
        type={type}
        readOnly={readOnly}
        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900
                   focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500
                   disabled:bg-slate-50"
        placeholder={placeholder}
      />
    </div>
  );
}
