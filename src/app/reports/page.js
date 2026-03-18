"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const amountFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const printableMonthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const formatAmount = (value) => amountFormatter.format(Number(value || 0));

const formatPrintableMonthLabel = (monthData) => {
  const monthValue = String(monthData?.value || "").trim();
  if (/^\d{4}-\d{2}$/.test(monthValue)) {
    const [year, month] = monthValue.split("-").map(Number);
    return printableMonthFormatter.format(new Date(Date.UTC(year, month - 1, 1))).toLocaleUpperCase("fr-FR");
  }

  const fallbackLabel = String(monthData?.label || "").trim();
  return (fallbackLabel || "-").toLocaleUpperCase("fr-FR");
};

const PRINT_HEADER_LINES = [
  "ش.ذ.م.م اكامكوم ",
  "سبورت نيوز  يومية وطنية جزائرية",
  "رأس المال: 100.000.00 دج",
  "سجل تجاري رقم: 21 ب 034391- 16/00",
  "ر.ت.الجبائي  :002126034391516",
];

const PRINT_FOOTER_LINES = [
    "ش.ذ.م.م اكاﻣﻜﻮم",
    "سبورت نيوز  يومية وطنية جزائرية",
    "رأس المال: 100.000.00 دج // سجل تجاري رقم: 21  ب 0343915 - 16/00 // ر.ت.الجبائي :002126034391516",
    "العنوان: حي 20 اوت  1955 وادي الرمان محل رقم 87 الطابق الارضي بلدية العاشور    –",
  
];

const PRINT_ROWS_PER_PAGE = 24; // Change this value if you want a different count per printed page.

const REPORT_PRINT_FONT_BASE_PORTRAIT = 12;
const REPORT_PRINT_FONT_HEADER_TEXT_PORTRAIT = 17;
const REPORT_PRINT_FONT_META_PORTRAIT = 18;
const REPORT_PRINT_FONT_MONTH_LINE_PORTRAIT = 22;
const REPORT_PRINT_FONT_TABLE_PORTRAIT = 13.5;
const REPORT_PRINT_FONT_TOTAL_ROW_PORTRAIT = 13.5;
const REPORT_PRINT_FONT_FOOTER_PORTRAIT = 16;

const buildPrintRows = (days = []) =>
  days.flatMap((day) =>
    (day?.tickets || []).map((ticket, index) => ({
      key: `${day.date}-${ticket.number}-${index}`,
      dayKey: day.date,
      date: day.displayDate,
      number: ticket.number,
      surfaceName: ticket.surfaceName,
      amount: ticket.amount,
      dayTotal: day.totalAmount,
    }))
  );

const chunkRows = (rows = [], pageSize = PRINT_ROWS_PER_PAGE) => {
  if (pageSize <= 0) {
    return [rows];
  }

  const pages = [];
  for (let index = 0; index < rows.length; index += pageSize) {
    pages.push(rows.slice(index, index + pageSize));
  }

  return pages.length > 0 ? pages : [[]];
};

const addPageGroupMeta = (rows = []) => {
  const countsByDay = rows.reduce((accumulator, row) => {
    const current = accumulator.get(row.dayKey) || 0;
    accumulator.set(row.dayKey, current + 1);
    return accumulator;
  }, new Map());

  const seenByDay = new Map();
  return rows.map((row) => {
    const seen = seenByDay.get(row.dayKey) || 0;
    seenByDay.set(row.dayKey, seen + 1);

    return {
      ...row,
      showGroupCells: seen === 0,
      groupSize: countsByDay.get(row.dayKey) || 1,
    };
  });
};

export default function ReportsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <main className="min-h-screen w-full flex items-center justify-center p-4">
        <div className="panel p-6 muted">Loading session...</div>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  const username = session?.user?.name || "User";
  const isAdmin = session?.user?.isAdmin || false;
  return <ReportsContent key={username} username={username} isAdmin={isAdmin} />;
}

function ReportsContent({ username, isAdmin }) {
  const router = useRouter();
  const profileMenuRef = useRef(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [monthOptions, setMonthOptions] = useState([]);
  const [wilayaOptions, setWilayaOptions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedWilayaId, setSelectedWilayaId] = useState("");
  const [report, setReport] = useState(null);
  const [surfaces, setSurfaces] = useState([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editingRowKey, setEditingRowKey] = useState("");
  const [editingNumber, setEditingNumber] = useState("");
  const [editingSurfaceId, setEditingSurfaceId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadFilters = async () => {
      setIsLoadingFilters(true);
      setError("");

      try {
        const response = await fetch("/api/reports", { cache: "no-store" });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load report filters.");
        }

        if (!isMounted) {
          return;
        }

        const months = Array.isArray(result?.filters?.months) ? result.filters.months : [];
        const wilayas = Array.isArray(result?.filters?.wilayas) ? result.filters.wilayas : [];

        setMonthOptions(months);
        setWilayaOptions(wilayas);
        setSelectedMonth((current) => current || months[0]?.value || "");
        setSelectedWilayaId((current) => current || String(wilayas[0]?.id || ""));
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setMonthOptions([]);
        setWilayaOptions([]);
        setSelectedMonth("");
        setSelectedWilayaId("");
        setError(loadError.message || "Failed to load report filters.");
      } finally {
        if (isMounted) {
          setIsLoadingFilters(false);
        }
      }
    };

    loadFilters();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSurfaces = async () => {
      try {
        const response = await fetch("/api/surfaces", { cache: "no-store" });
        const result = await response.json();

        if (!response.ok || !isMounted) {
          return;
        }

        setSurfaces(Array.isArray(result.data) ? result.data : []);
      } catch {
        if (isMounted) {
          setSurfaces([]);
        }
      }
    };

    loadSurfaces();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStatusMessage("");
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  useEffect(() => {
    if (!isProfileOpen) {
      return;
    }

    const handleOutsideClick = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isProfileOpen]);

  const loadReport = async (month, wilayaId) => {
    try {
      const query = new URLSearchParams({ month, wilayaId });

      const response = await fetch(`/api/reports?${query.toString()}`, { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load report.");
      }

      setReport(result.report || null);
      return true;
    } catch (loadError) {
      setReport(null);
      setError(loadError.message || "Failed to load report.");
      return false;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setStatusMessage("");
    setHasSubmitted(true);

    if (!selectedMonth || !selectedWilayaId) {
      setError("Select both a month and a wilaya.");
      setReport(null);
      return;
    }

    setIsSubmitting(true);
    await loadReport(selectedMonth, selectedWilayaId);
    setIsSubmitting(false);
  };

  const getRowKey = (day, ticket, index) => `${day.date}-${ticket.number}-${index}`;

  const startEdit = (day, ticket, index) => {
    setEditingRowKey(getRowKey(day, ticket, index));
    setEditingNumber(String(ticket.number || ""));
    setEditingSurfaceId(String(ticket.surfaceId || ""));
    setError("");
    setStatusMessage("");
  };

  const cancelEdit = () => {
    setEditingRowKey("");
    setEditingNumber("");
    setEditingSurfaceId("");
  };

  const saveEdit = async (day, ticket) => {
    setError("");
    setStatusMessage("");

    const normalizedNumber = editingNumber.trim();
    if (!/^\d+$/.test(normalizedNumber) || BigInt(normalizedNumber) <= 0n) {
      setError("Enter a valid positive ticket number.");
      return;
    }

    if (!editingSurfaceId) {
      setError("Select a valid surface.");
      return;
    }

    setIsSavingEdit(true);

    try {
      const response = await fetch("/api/reports/entry", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldDate: day.date,
          oldNumber: String(ticket.number),
          newNumber: normalizedNumber,
          newSurface: editingSurfaceId,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update ticket.");
      }

      cancelEdit();
      setStatusMessage("Modification saved successfully.");
      await loadReport(selectedMonth, selectedWilayaId);
    } catch (saveError) {
      setError(saveError.message || "Failed to update ticket.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const selectedWilaya = wilayaOptions.find((wilaya) => String(wilaya.id) === selectedWilayaId) || null;
  const selectedWilayaLabel = selectedWilaya ? `${selectedWilaya.id} - ${selectedWilaya.name}` : "-";
  const printPages = report ? chunkRows(buildPrintRows(report.days), PRINT_ROWS_PER_PAGE) : [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="report-app-root min-h-screen w-full bg-transparent">
      {isSidebarOpen ? (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          className="print-hide fixed inset-0 z-20 bg-slate-900/45 md:hidden"
          aria-label="Close menu overlay"
        />
      ) : null}

      <div className="flex min-h-screen">
        <aside
          className={`report-app-sidebar print-hide fixed inset-y-0 left-0 z-30 w-[245px] bg-slate-900 p-5 text-white transition-transform duration-300 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div>
              <p className="text-xs tracking-[0.25em] text-blue-200">DASHBOARD</p>
            </div>

            <nav className="mt-4 space-y-1">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="flex w-full cursor-pointer items-center rounded-xl px-3 py-2 text-left text-sm font-semibold text-blue-100 transition hover:bg-white/10"
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => router.push("/surfaces")}
                className="flex w-full cursor-pointer items-center rounded-xl px-3 py-2 text-left text-sm font-semibold text-blue-100 transition hover:bg-white/10"
              >
                Surfaces
              </button>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center rounded-xl bg-white/95 px-3 py-2 text-left text-sm font-semibold text-slate-900"
              >
                Reports
              </button>
              <button
                type="button"
                onClick={() => router.push("/summary")}
                className="flex w-full cursor-pointer items-center rounded-xl px-3 py-2 text-left text-sm font-semibold text-blue-100 transition hover:bg-white/10"
              >
                Summary
              </button>
              <button
                type="button"
                onClick={() => router.push("/invoice")}
                className="flex w-full cursor-pointer items-center rounded-xl px-3 py-2 text-left text-sm font-semibold text-blue-100 transition hover:bg-white/10"
              >
                Invoice
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => router.push("/accounts")}
                  className="flex w-full cursor-pointer items-center rounded-xl px-3 py-2 text-left text-sm font-semibold text-blue-100 transition hover:bg-white/10"
                >
                  Accounts
                </button>
              ) : null}
            </nav>
          </div>
        </aside>

        <section className={`report-app-shell flex min-h-screen flex-1 flex-col ${isSidebarOpen ? "md:pl-[245px]" : ""}`}>
          <header className="report-app-header print-hide flex items-center gap-3 bg-slate-900 px-4 py-3 text-white sm:px-5">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="cursor-pointer rounded-lg border border-white/25 px-3 py-1.5 text-lg leading-none transition hover:bg-white/12"
              aria-label="Open menu"
            >
              ☰
            </button>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-xs text-blue-200">Welcome</p>
                <p className="text-sm font-semibold">{username}</p>
              </div>

              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen((prev) => !prev)}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-slate-800 font-semibold"
                  aria-label="Open profile menu"
                  aria-expanded={isProfileOpen}
                  aria-controls="profile-menu"
                >
                  {username.charAt(0).toUpperCase()}
                </button>

                {isProfileOpen ? (
                  <div
                    id="profile-menu"
                    className="absolute right-0 top-11 z-40 w-64 rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-xl"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Profile</p>
                    <p className="mt-2 text-sm text-slate-500">Username</p>
                    <p className="text-base font-semibold">{username}</p>

                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="mt-4 w-full cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <section className="report-app-content flex-1 overflow-auto p-4 sm:p-6">
            <div className="report-panel panel p-5 sm:p-7">
              <h1 className="title">Wilaya Monthly Report</h1>
              <p className="muted mt-2">Select an available month and wilaya to generate the ticket amount summary.</p>

              <form onSubmit={handleSubmit} className="report-controls mt-6 grid grid-cols-1 gap-3 md:grid-cols-5">
                <div>
                  <label htmlFor="report-month" className="label">
                    Month
                  </label>
                  <select
                    id="report-month"
                    className="field cursor-pointer"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    disabled={isLoadingFilters || monthOptions.length === 0}
                  >
                    <option value="">Select a month</option>
                    {monthOptions.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="report-wilaya" className="label">
                    Wilaya
                  </label>
                  <select
                    id="report-wilaya"
                    className="field cursor-pointer"
                    value={selectedWilayaId}
                    onChange={(event) => setSelectedWilayaId(event.target.value)}
                    disabled={isLoadingFilters || wilayaOptions.length === 0}
                  >
                    <option value="">Select a wilaya</option>
                    {wilayaOptions.map((wilaya) => (
                      <option key={wilaya.id} value={String(wilaya.id)}>
                        {wilaya.id} - {wilaya.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button type="submit" className="btn btn-primary w-full" disabled={isLoadingFilters || isSubmitting}>
                    {isSubmitting ? "Loading..." : "Generate"}
                  </button>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    className="btn btn-ghost w-full"
                    onClick={handlePrint}
                    disabled={!report || isLoadingFilters || isSubmitting}
                  >
                    Print
                  </button>
                </div>
              </form>

              {statusMessage ? <p className="status-success mt-4">{statusMessage}</p> : null}
              {error ? <p className="status-error mt-4">{error}</p> : null}

              {report ? (
                <div className="report-screen-shell mt-6 space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="muted text-sm">Month</p>
                      <p className="mt-1 font-semibold text-slate-800">{report.month?.label || "-"}</p>
                    </article>
                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="muted text-sm">Wilaya</p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {selectedWilayaLabel}
                      </p>
                    </article>
                    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="muted text-sm">Total General</p>
                      <p className="mt-1 font-semibold text-slate-800">{formatAmount(report.totalGeneral)}</p>
                    </article>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full bg-white">
                      <thead>
                        <tr className="bg-slate-50 text-left text-sm text-slate-600">
                          <th className="px-4 py-3 font-semibold">DATE</th>
                          <th className="px-4 py-3 font-semibold">N°BC</th>
                          <th className="px-4 py-3 font-semibold">SURFACE</th>
                          <th className="px-4 py-3 font-semibold">MONTANT</th>
                          <th className="px-4 py-3 font-semibold">MONTANT TOTAL</th>
                          <th className="px-4 py-3 font-semibold">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.days.length === 0 ? (
                          <tr>
                            <td className="px-4 py-6 text-sm muted" colSpan={6}>
                              No tickets found for the selected month and wilaya.
                            </td>
                          </tr>
                        ) : (
                          report.days.map((day) =>
                            day.tickets.map((ticket, index) => {
                              const rowKey = getRowKey(day, ticket, index);
                              const isEditing = editingRowKey === rowKey;
                              const selectedSurface = surfaces.find((surface) => String(surface.id) === editingSurfaceId);
                              const shownAmount = isEditing
                                ? Number(selectedSurface?.price ?? ticket.amount)
                                : Number(ticket.amount || 0);

                              return (
                                <tr key={rowKey} className="border-t border-slate-100 text-sm text-slate-700">
                                  {index === 0 ? (
                                    <td className="px-4 py-3 font-semibold align-top" rowSpan={day.tickets.length}>
                                      {day.displayDate}
                                    </td>
                                  ) : null}
                                  <td className="px-4 py-3">
                                    {isEditing ? (
                                      <input
                                        className="field min-w-[130px]"
                                        value={editingNumber}
                                        onChange={(event) => setEditingNumber(event.target.value)}
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                      />
                                    ) : (
                                      ticket.number
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {isEditing ? (
                                      <select
                                        className="field min-w-[130px] cursor-pointer"
                                        value={editingSurfaceId}
                                        onChange={(event) => setEditingSurfaceId(event.target.value)}
                                      >
                                        <option value="">Select surface</option>
                                        {surfaces.map((surfaceOption) => (
                                          <option key={surfaceOption.id} value={String(surfaceOption.id)}>
                                            {surfaceOption.name}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      ticket.surfaceName
                                    )}
                                  </td>
                                  <td className="px-4 py-3">{formatAmount(shownAmount)}</td>
                                  {index === 0 ? (
                                    <td className="px-4 py-3 font-semibold align-top" rowSpan={day.tickets.length}>
                                      {formatAmount(day.totalAmount)}
                                    </td>
                                  ) : null}
                                  <td className="px-4 py-3">
                                    {isEditing ? (
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => saveEdit(day, ticket)}
                                          disabled={isSavingEdit}
                                          className="btn btn-primary px-3 py-1 text-xs"
                                        >
                                          {isSavingEdit ? "Saving..." : "Save"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={cancelEdit}
                                          disabled={isSavingEdit}
                                          className="btn btn-ghost px-3 py-1 text-xs"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : isAdmin ? (
                                      <button
                                        type="button"
                                        onClick={() => startEdit(day, ticket, index)}
                                        disabled={Boolean(editingRowKey)}
                                        className="btn btn-ghost px-3 py-1 text-xs"
                                      >
                                        Edit
                                      </button>
                                    ) : (
                                      <p className="text-xs text-slate-500">No actions</p>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 bg-slate-50 text-sm text-slate-900">
                          <td className="px-4 py-3 text-center font-bold tracking-[0.16em]" colSpan={5}>
                            TOTAL GENERAL
                          </td>
                          <td className="px-4 py-3 font-bold">{formatAmount(report.totalGeneral)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : null}

              {report ? (
                <section className="report-print-sheet" aria-hidden="true">
                  {printPages.map((pageRows, pageIndex) => {
                    const isFirstPage = pageIndex === 0;
                    const isLastPage = pageIndex === printPages.length - 1;
                    const groupedRows = addPageGroupMeta(pageRows);

                    return (
                      <article
                        key={`print-page-${pageIndex}`}
                        className={`report-print-page ${isLastPage ? "" : "report-print-page-break"}`}
                      >
                        <div className="report-print-content">
                          <header className="report-print-header">
                            <div className="report-print-logo-wrap">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src="/assets/image1.png"
                                alt="Sport News logo"
                                className="report-print-logo"
                                loading="eager"
                                decoding="sync"
                              />
                            </div>
                            <div className="report-print-header-right">
                              <div className="report-print-header-text">
                                {PRINT_HEADER_LINES.map((line) => (
                                  <p key={line}>{line}</p>
                                ))}
                              </div>
                            </div>
                          </header>

                          {isFirstPage ? (
                            <section className="report-print-meta">
                              <p>
                                <span>Le nom du journal :</span>
                                <strong>SPORT NEWS</strong>
                              </p>
                              <p>
                                <span>Email :</span>
                                <strong>sportnews.dz24@gmail.com</strong>
                              </p>
                              <p>
                                <span>Téléphone :</span>
                                <strong>0660 62 63 68/ 0781 28 11 29</strong>
                              </p>
                              <p>
                                <span>ANEP :</span>
                                <strong>{selectedWilayaLabel}</strong>
                              </p>
                              <div className="report-print-meta-break" />
                              <p className="report-print-month-line">
                                <span>Relevé mois de:</span>
                                <strong>{formatPrintableMonthLabel(report.month)}</strong>
                              </p>
                            </section>
                          ) : null}

                          <table className="report-print-table">
                            <thead>
                              <tr>
                                <th>DATE</th>
                                <th>N°BC</th>
                                <th>SURFACE</th>
                                <th>MONTANT</th>
                                <th>MONTANT TOTAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupedRows.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="report-print-empty">
                                    No tickets found for the selected month and wilaya.
                                  </td>
                                </tr>
                              ) : (
                                groupedRows.map((row) => (
                                  <tr key={`print-${row.key}`} className="report-print-row">
                                    {row.showGroupCells ? <td rowSpan={row.groupSize}>{row.date}</td> : null}
                                    <td>{row.number}</td>
                                    <td>{row.surfaceName}</td>
                                    <td>{formatAmount(row.amount)}</td>
                                    {row.showGroupCells ? <td rowSpan={row.groupSize}>{formatAmount(row.dayTotal)}</td> : null}
                                  </tr>
                                ))
                              )}
                            </tbody>
                            {isLastPage ? (
                              <tfoot>
                                <tr>
                                  <td colSpan={4}>TOTAL GENERAL</td>
                                  <td>{formatAmount(report.totalGeneral)}</td>
                                </tr>
                              </tfoot>
                            ) : null}
                          </table>
                        </div>
                      </article>
                    );
                  })}

                  <footer className="report-print-footer">
                    {PRINT_FOOTER_LINES.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </footer>
                </section>
              ) : null}

              {!report && !error && hasSubmitted ? (
                <p className="muted mt-6 text-sm">No report data is available for the current selection.</p>
              ) : null}
            </div>
          </section>
        </section>
      </div>

      <style jsx global>{`
        .report-print-sheet {
          display: none;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          .report-app-sidebar,
          .report-app-header,
          .report-controls,
          .report-screen-shell,
          .status-error,
          .print-hide {
            display: none !important;
          }

          .report-app-root,
          .report-app-shell,
          .report-app-content {
            background: #fff !important;
            overflow: visible !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .report-panel {
            box-shadow: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .report-panel > .title,
          .report-panel > .muted {
            display: none !important;
          }

          .report-print-sheet {
            display: block !important;
            font-family: "Times New Roman", serif;
            font-size: ${REPORT_PRINT_FONT_BASE_PORTRAIT}px; /* ← BASE font size for the whole printed document */
            color: #000;
          }

          .report-print-content {
            padding-bottom: 40mm;
          }

          .report-print-page-break {
            break-after: page;
            page-break-after: always;
          }

          .report-print-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 7mm;
          }

          .report-print-logo-wrap {
            width: 34mm;
          }

          .report-print-logo {
            width: 100%;
            height: auto;
            object-fit: contain;
          }

          .report-print-header-right {
            max-width: 120mm;
          }

          .report-print-header-text {
            direction: rtl;
            text-align: right;
            line-height: 1.4;
            font-size: ${REPORT_PRINT_FONT_HEADER_TEXT_PORTRAIT}px; /* ← Arabic company block (top-right header text) */

            font-family: Calibri, "Segoe UI", Arial, sans-serif;
          }

          .report-print-meta {
            margin-bottom: 4mm;
            line-height: 1.45;
            font-size: ${REPORT_PRINT_FONT_META_PORTRAIT}px; /* ← Journal info lines (Le nom du journal, Email …) */
          }

          .report-print-meta p {
            display: flex;
            gap: 6px;
          }

          .report-print-meta span {
            min-width: 145px;
          }

          .report-print-meta-break {
            height: 4mm;
          }

          .report-print-month-line {
            display: block !important;
            text-align: center;
            font-weight: 700;
            font-size: ${REPORT_PRINT_FONT_MONTH_LINE_PORTRAIT}px; /* ← "Relevé mois de: Month Year" centered title */
            margin: 0;
          }

          .report-print-month-line span {
            min-width: 0;
            font-weight: 700;
            margin-right: 6px;
          }

          .report-print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: ${REPORT_PRINT_FONT_TABLE_PORTRAIT}px; /* ← Table body / header / footer rows */
          }

          .report-print-table thead {
            display: table-header-group;
          }

          .report-print-table tfoot {
            display: table-row-group;
            font-weight: 700;
            font-size: ${REPORT_PRINT_FONT_TOTAL_ROW_PORTRAIT}px; /* ← TOTAL GENERAL row */
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .report-print-table th,
          .report-print-table td {
            border: 1px solid #000;
            padding: 1.15mm 1mm;
            line-height: 1;
            vertical-align: middle;
            text-align: center; /* ← all cells centered (DATE, N°BC, SURFACE, amounts) */
          }

          .report-print-table th {
            text-align: center;
          }

          .report-print-table tfoot td {
            text-align: center;
            letter-spacing: 0.08em;
          }

          .report-print-empty {
            text-align: center !important;
            padding: 5mm 0 !important;
          }

          .report-print-row {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .report-print-footer {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            border-top: 1px solid #000;
            padding: 2mm 4mm 0;
            background: #fff;
            text-align: center;
            direction: rtl;
            font-size: ${REPORT_PRINT_FONT_FOOTER_PORTRAIT}px; /* ← footer Arabic/French lines at the bottom of every page */
            line-height: 1.25;
            z-index: 2;

            font-family: Calibri, "Segoe UI", Arial, sans-serif;
          }

          .report-print-footer p {
            margin: 0;
          }
        }
      `}</style>
    </main>
  );
}