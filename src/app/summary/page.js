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

const SUMMARY_WILAYA_PORTRAIT_LIMIT = 6;
const SUMMARY_LINES_LIMIT_PORTRAIT = 27;
const SUMMARY_LINES_LIMIT_LANDSCAPE = 17;

const SUMMARY_PRINT_FONT_HEADER_RIGHT_PORTRAIT = 15;
const SUMMARY_PRINT_FONT_HEADER_RIGHT_LANDSCAPE = 15;

const SUMMARY_PRINT_FONT_TITLE_PORTRAIT = 18;
const SUMMARY_PRINT_FONT_TITLE_LANDSCAPE = 18;

const SUMMARY_PRINT_FONT_META_PORTRAIT = 16;
const SUMMARY_PRINT_FONT_META_LANDSCAPE = 14;

const SUMMARY_PRINT_FONT_MONTH_LINE_PORTRAIT = 12;
const SUMMARY_PRINT_FONT_MONTH_LINE_LANDSCAPE = 12;

const SUMMARY_PRINT_FONT_TABLE_PORTRAIT = 13;
const SUMMARY_PRINT_FONT_TABLE_LANDSCAPE = 13;

const SUMMARY_PRINT_FONT_CALCULATIONS_PORTRAIT = 13;
const SUMMARY_PRINT_FONT_CALCULATIONS_LANDSCAPE = 13;

const SUMMARY_PRINT_FONT_FOOTER_PORTRAIT = 14;
const SUMMARY_PRINT_FONT_FOOTER_LANDSCAPE = 12;

const chunkSummaryRows = (rows = [], pageSize = SUMMARY_LINES_LIMIT_PORTRAIT) => {
  if (pageSize <= 0) {
    return [rows];
  }

  const pages = [];
  for (let index = 0; index < rows.length; index += pageSize) {
    pages.push(rows.slice(index, index + pageSize));
  }

  return pages.length > 0 ? pages : [[]];
};

export default function SummaryPage() {
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
  return <SummaryContent key={username} username={username} isAdmin={isAdmin} />;
}

function SummaryContent({ username, isAdmin }) {
  const router = useRouter();
  const profileMenuRef = useRef(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [monthOptions, setMonthOptions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [summary, setSummary] = useState(null);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadFilters = async () => {
      setIsLoadingFilters(true);
      setError("");

      try {
        const response = await fetch("/api/summary", { cache: "no-store" });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load summary filters.");
        }

        if (!isMounted) {
          return;
        }

        const months = Array.isArray(result?.filters?.months) ? result.filters.months : [];
        setMonthOptions(months);
        setSelectedMonth((current) => current || months[0]?.value || "");
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setMonthOptions([]);
        setSelectedMonth("");
        setError(loadError.message || "Failed to load summary filters.");
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setHasSubmitted(true);

    if (!selectedMonth) {
      setError("Select a month.");
      setSummary(null);
      return;
    }

    setIsSubmitting(true);

    try {
      const query = new URLSearchParams({ month: selectedMonth });
      const response = await fetch(`/api/summary?${query.toString()}`, { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load summary.");
      }

      setSummary(result.summary || null);
    } catch (loadError) {
      setSummary(null);
      setError(loadError.message || "Failed to load summary.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const printIsPortrait = (summary?.wilayas?.length || 0) <= SUMMARY_WILAYA_PORTRAIT_LIMIT;
  const printLinesLimit = printIsPortrait ? SUMMARY_LINES_LIMIT_PORTRAIT : SUMMARY_LINES_LIMIT_LANDSCAPE;
  const printPages = summary ? chunkSummaryRows(summary.rows, printLinesLimit) : [];
  const shouldPrintCalculationsHeader = Boolean(summary && summary.rows.length > 0 && printPages.length === 1);

  return (
    <main className="summary-app-root min-h-screen w-full bg-transparent">
      {isSidebarOpen ? (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          className="summary-print-hide fixed inset-0 z-20 bg-slate-900/45 md:hidden"
          aria-label="Close menu overlay"
        />
      ) : null}

      <div className="flex min-h-screen overflow-x-hidden">
        <aside
          className={`summary-app-sidebar summary-print-hide fixed inset-y-0 left-0 z-30 w-[245px] bg-slate-900 p-5 text-white transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div className="flex h-full flex-col">
            <nav className="mt-12 space-y-1">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="flex w-full cursor-pointer items-center rounded-xl px-3 py-2 text-left text-sm font-semibold text-blue-100 transition hover:bg-white/10"
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => router.push("/search")}
                className="flex w-full cursor-pointer items-center rounded-xl px-3 py-2 text-left text-sm font-semibold text-blue-100 transition hover:bg-white/10"
              >
                Search Tickets
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
                onClick={() => router.push("/reports")}
                className="flex w-full cursor-pointer items-center rounded-xl px-3 py-2 text-left text-sm font-semibold text-blue-100 transition hover:bg-white/10"
              >
                Reports
              </button>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center rounded-xl bg-white/95 px-3 py-2 text-left text-sm font-semibold text-slate-900"
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

        <section className={`summary-app-shell flex min-h-screen flex-1 flex-col transition-[padding-left] duration-300 ease-in-out ${isSidebarOpen ? "md:pl-[245px]" : "md:pl-0"}`}>
          <header className="summary-app-header summary-print-hide flex items-center gap-3 bg-slate-900 pl-16 pr-4 py-3 text-white sm:pl-20 sm:pr-5">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="fixed left-4 top-3 z-50 cursor-pointer rounded-lg border border-white/25 bg-slate-900/95 px-3 py-1.5 text-lg leading-none transition hover:bg-white/12"
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

          <section className="summary-app-content flex-1 overflow-auto p-4 sm:p-6">
            <div className="summary-panel panel p-5 sm:p-7">
              <h1 className="title">Monthly Summary</h1>
              <p className="muted mt-2">Select a month to generate the recap table and the billing calculations.</p>

              <form onSubmit={handleSubmit} className="summary-controls mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label htmlFor="summary-month" className="label">
                    Month
                  </label>
                  <select
                    id="summary-month"
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

                <div className="flex items-end">
                  <button type="submit" className="btn btn-success w-full" disabled={isLoadingFilters || isSubmitting}>
                    {isSubmitting ? "Loading..." : "Generate"}
                  </button>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    className="btn btn-ghost w-full"
                    onClick={handlePrint}
                    disabled={!summary || isLoadingFilters || isSubmitting}
                  >
                    Print
                  </button>
                </div>
              </form>

              {error ? <p className="status-error mt-4">{error}</p> : null}

              {summary ? (
                <div className="summary-screen-shell mt-6 space-y-5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <h2 className="text-lg font-bold text-slate-900">
                      Récapitulatif mois de <span className="ml-3">{formatPrintableMonthLabel(summary.month)}</span>
                    </h2>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full bg-white text-sm text-slate-700">
                      <thead>
                        <tr className="bg-slate-50 text-center text-slate-700">
                          <th className="px-4 py-3 font-semibold">DATE</th>
                          {summary.wilayas.map((wilaya) => (
                            <th key={wilaya.id} className="min-w-[150px] px-4 py-3 font-semibold">
                              {`MONTANT ${String(wilaya.name || "").toUpperCase()}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {summary.rows.length === 0 ? (
                          <tr>
                            <td className="px-4 py-6 text-center muted" colSpan={summary.wilayas.length + 1}>
                              No data found for the selected month.
                            </td>
                          </tr>
                        ) : (
                          summary.rows.map((row) => (
                            <tr key={row.date} className="border-t border-slate-100 text-center">
                              <td className="px-4 py-3 font-semibold">{row.displayDate}</td>
                              {summary.wilayas.map((wilaya) => {
                                const amount = row.amountsByWilaya[String(wilaya.id)];
                                return <td key={`${row.date}-${wilaya.id}`} className="px-4 py-3">{amount ? formatAmount(amount) : ""}</td>;
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 bg-slate-50 text-center font-bold text-slate-900">
                          <td className="px-4 py-3 italic">Sous Total</td>
                          {summary.wilayas.map((wilaya) => (
                            <td key={`subtotal-${wilaya.id}`} className="px-4 py-3">
                              {formatAmount(summary.subtotalsByWilaya[String(wilaya.id)] || 0)}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm text-slate-800">
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="px-4 py-3 font-medium">Montant général</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatAmount(summary.totalGeneral)}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="px-4 py-3 font-medium">Commission anep 30 %</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatAmount(summary.commissionAnep)}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="px-4 py-3 font-medium">Montant HT</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatAmount(summary.montantHt)}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="px-4 py-3 font-medium">MONTANT TVA 19 %</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatAmount(summary.montantTva)}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-bold">TTC</td>
                          <td className="px-4 py-3 text-right font-bold">{formatAmount(summary.ttc)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {summary ? (
                <section
                  className={`summary-print-sheet ${printIsPortrait ? "summary-print-sheet--portrait" : "summary-print-sheet--landscape"}`}
                  aria-hidden="true"
                >
                  {printPages.map((pageRows, pageIndex) => {
                    const isFirstPage = pageIndex === 0;
                    const isLastPage = pageIndex === printPages.length - 1;

                    return (
                      <article
                        key={`summary-print-page-${pageIndex}`}
                        className={`summary-print-page ${isLastPage ? "" : "summary-print-page-break"}`}
                      >
                        <div className="summary-print-content">
                          <header className="summary-print-header">
                            <div className="summary-print-logo-wrap">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src="/assets/image1.png"
                                alt="Sport News logo"
                                className="summary-print-logo"
                                loading="eager"
                                decoding="sync"
                              />
                            </div>
                            <div className="summary-print-header-right">
                              {PRINT_HEADER_LINES.map((line) => (
                                <p key={line}>{line}</p>
                              ))}
                            </div>
                          </header>

                          {isFirstPage ? (
                            <>
                              <br />
                              <br />
                              <section className="summary-print-meta">
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
                                <div className="summary-print-meta-break" />
                              </section>
                            </>
                          ) : null}

                          {isFirstPage ? (
                            <h1 className="summary-print-title">
                              <span>Récapitulatif mois de</span>
                              <span>{formatPrintableMonthLabel(summary.month)}</span>
                            </h1>
                          ) : null}

                          {!isFirstPage && !printIsPortrait ? (
                            <>
                              <br />
                              <br />
                            </>
                          ) : null}

                          {!isFirstPage && printIsPortrait ? (
                            <>
                              <br />
                              <br />
                            </>
                          ) : null}

                          <table className="summary-print-table">
                            <thead>
                              <tr>
                                <th>DATE</th>
                                {summary.wilayas.map((wilaya) => (
                                  <th key={`print-header-${wilaya.id}`}>{`MONTANT ${String(wilaya.name || "").toUpperCase()}`}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {pageRows.length === 0 ? (
                                <tr>
                                  <td colSpan={summary.wilayas.length + 1} className="summary-print-empty">
                                    No data found for the selected month.
                                  </td>
                                </tr>
                              ) : (
                                pageRows.map((row) => (
                                  <tr key={`print-${row.date}`}>
                                    <td>{row.displayDate}</td>
                                    {summary.wilayas.map((wilaya) => {
                                      const amount = row.amountsByWilaya[String(wilaya.id)];
                                      return <td key={`print-${row.date}-${wilaya.id}`}>{amount ? formatAmount(amount) : ""}</td>;
                                    })}
                                  </tr>
                                ))
                              )}
                            </tbody>
                            {isLastPage ? (
                              <tfoot>
                                <tr>
                                  <td>Sous Total</td>
                                  {summary.wilayas.map((wilaya) => (
                                    <td key={`print-subtotal-${wilaya.id}`}>{formatAmount(summary.subtotalsByWilaya[String(wilaya.id)] || 0)}</td>
                                  ))}
                                </tr>
                              </tfoot>
                            ) : null}
                          </table>

                          {isLastPage && printPages.length >= 2 ? (
                            <div className="summary-print-calculations-wrap">
                              <table className="summary-print-calculations">
                                <tbody>
                                  <tr>
                                    <td>Montant général</td>
                                    <td>{formatAmount(summary.totalGeneral)}</td>
                                  </tr>
                                  <tr>
                                    <td>Commission anep 30 %</td>
                                    <td>{formatAmount(summary.commissionAnep)}</td>
                                  </tr>
                                  <tr>
                                    <td>Montant HT</td>
                                    <td>{formatAmount(summary.montantHt)}</td>
                                  </tr>
                                  <tr>
                                    <td>MONTANT TVA 19 %</td>
                                    <td>{formatAmount(summary.montantTva)}</td>
                                  </tr>
                                  <tr>
                                    <td>TTC</td>
                                    <td>{formatAmount(summary.ttc)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}

                  {/* ─── FIXED: wrapper with padding-bottom so the fixed footer never overlaps ─── */}
                  {shouldPrintCalculationsHeader ? (
                    <div className="summary-print-calculations-page">
                      <header className="summary-print-header summary-print-header--calculations">
                        <div className="summary-print-logo-wrap">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/assets/image1.png"
                            alt="Sport News logo"
                            className="summary-print-logo"
                            loading="eager"
                            decoding="sync"
                          />
                        </div>
                        <div className="summary-print-header-right">
                          {PRINT_HEADER_LINES.map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                        </div>
                      </header>
                      <br />
                      <br />
                      {summary && printPages.length === 1 ? (
                        <div className="summary-print-calculations-wrap">
                          <table className="summary-print-calculations">
                            <tbody>
                              <tr>
                                <td>Montant général</td>
                                <td>{formatAmount(summary.totalGeneral)}</td>
                              </tr>
                              <tr>
                                <td>Commission anep 30 %</td>
                                <td>{formatAmount(summary.commissionAnep)}</td>
                              </tr>
                              <tr>
                                <td>Montant HT</td>
                                <td>{formatAmount(summary.montantHt)}</td>
                              </tr>
                              <tr>
                                <td>MONTANT TVA 19 %</td>
                                <td>{formatAmount(summary.montantTva)}</td>
                              </tr>
                              <tr>
                                <td>TTC</td>
                                <td>{formatAmount(summary.ttc)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <footer className="summary-print-footer">
                    {PRINT_FOOTER_LINES.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </footer>
                </section>
              ) : null}

              {!summary && !error && hasSubmitted ? (
                <p className="muted mt-6 text-sm">No summary data is available for the current selection.</p>
              ) : null}
            </div>
          </section>
        </section>
      </div>

      <style jsx global>{`
        .summary-print-sheet {
          display: none;
        }

        @media print {
          @page {
            size: A4 ${printIsPortrait ? "portrait" : "landscape"};
            margin: 8mm;
          }

          .summary-app-sidebar,
          .summary-app-header,
          .summary-controls,
          .summary-screen-shell,
          .summary-print-hide,
          .status-error {
            display: none !important;
          }

          .summary-app-root,
          .summary-app-shell,
          .summary-app-content {
            background: #fff !important;
            overflow: visible !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .summary-panel {
            box-shadow: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .summary-panel > .title,
          .summary-panel > .muted {
            display: none !important;
          }

          .summary-print-sheet {
            display: block !important;
            color: #000;
            font-family: "Times New Roman", serif;
          }

          .summary-print-content {
            width: 100%;
            padding-bottom: 34mm;
          }

          /* ─── FIXED: calculations page wrapper also gets the same padding-bottom ─── */
          .summary-print-calculations-page {
            padding-bottom: 34mm;
          }

          .summary-print-page-break {
            break-after: page;
            page-break-after: always;
          }

          .summary-print-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 5mm;
          }

          .summary-print-logo-wrap {
            width: 34mm;
          }

          .summary-print-logo {
            width: 100%;
            height: auto;
            object-fit: contain;
          }

          .summary-print-header-right {
            direction: rtl;
            text-align: right;
            line-height: 1.35;
            font-size: ${SUMMARY_PRINT_FONT_HEADER_RIGHT_PORTRAIT}px;
            max-width: 135mm;
            font-family: Calibri, "Segoe UI", Arial, sans-serif;
          }

          .summary-print-title {
            display: flex;
            justify-content: center;
            gap: 14mm;
            margin: 0 0 6mm;
            font-size: ${SUMMARY_PRINT_FONT_TITLE_PORTRAIT}px;
            font-weight: 700;
          }

          .summary-print-meta {
            margin-bottom: 4mm;
            line-height: 1.4;
            font-size: ${SUMMARY_PRINT_FONT_META_PORTRAIT}px;
          }

          .summary-print-meta p {
            display: flex;
            gap: 6px;
          }

          .summary-print-meta span {
            min-width: 145px;
          }

          .summary-print-meta-break {
            height: 3mm;
          }

          .summary-print-month-line {
            display: block !important;
            text-align: center;
            font-weight: 700;
            font-size: ${SUMMARY_PRINT_FONT_MONTH_LINE_PORTRAIT}px;
            margin: 0;
          }

          .summary-print-month-line span {
            min-width: 0;
            margin-right: 6px;
          }

          .summary-print-table {
            width: calc(100% - 1mm);
            margin-right: 1mm;
            box-sizing: border-box;
            border-collapse: collapse;
            border: 1px solid #000;
            color: #000;
          }

          .summary-print-table {
            font-size: ${SUMMARY_PRINT_FONT_TABLE_PORTRAIT}px;
          }

          .summary-print-table th,
          .summary-print-table td {
            border: 1px solid #000;
            padding: 1.2mm 1mm;
            line-height: 1;
            text-align: center;
            vertical-align: middle;
          }

          .summary-print-table th:last-child,
          .summary-print-table td:last-child {
            border-right: 1px solid #000 !important;
          }

          .summary-print-table thead {
            display: table-header-group;
          }

          .summary-print-table tfoot {
            display: table-row-group;
            font-weight: 700;
          }

          .summary-print-empty {
            padding: 5mm 0 !important;
          }

          .summary-print-calculations-wrap {
            margin-top: 4mm;
            width: calc(100% - 1mm);
            margin-right: 1mm;
            box-sizing: border-box;
            page-break-inside: avoid;
          }

          .summary-print-calculations {
            width: 100%;
            margin: 0;
            box-sizing: border-box;
            font-size: ${SUMMARY_PRINT_FONT_CALCULATIONS_PORTRAIT}px;
            color: #000;
            border-collapse: collapse;
            border: 1px solid #000;
            table-layout: fixed;
          }

          .summary-print-calculations td {
            border: 1px solid #000;
            padding: 1.2mm 1mm;
            line-height: 1;
            vertical-align: middle;
          }

          .summary-print-calculations td:last-child {
            border-right: 1px solid #000 !important;
          }

          .summary-print-calculations td:first-child {
            text-align: left;
          }

          .summary-print-calculations td:last-child {
            text-align: right;
            font-weight: 700;
          }

          .summary-print-footer {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            border-top: 1px solid #000;
            padding: 2mm 4mm 0;
            background: #fff;
            text-align: center;
            direction: rtl;
            font-size: ${SUMMARY_PRINT_FONT_FOOTER_PORTRAIT}px;
            line-height: 1.2;
            z-index: 2;
            font-family: Calibri, "Segoe UI", Arial, sans-serif;
          }

          .summary-print-footer p {
            margin: 0;
          }

          /* Landscape overrides */
          .summary-print-sheet--landscape .summary-print-content {
            padding-bottom: 30mm;
          }

          /* ─── FIXED: landscape also needs the reduced padding on the calculations page ─── */
          .summary-print-sheet--landscape .summary-print-calculations-page {
            padding-bottom: 30mm;
          }

          .summary-print-sheet--landscape .summary-print-header {
            margin-bottom: 3mm;
          }

          .summary-print-sheet--landscape .summary-print-meta {
            margin-bottom: 2mm;
            font-size: ${SUMMARY_PRINT_FONT_META_LANDSCAPE}px;
            line-height: 1.2;
          }

          .summary-print-sheet--landscape .summary-print-meta-break {
            height: 1.5mm;
          }

          .summary-print-sheet--landscape .summary-print-title {
            margin: 0 0 3mm;
            font-size: ${SUMMARY_PRINT_FONT_TITLE_LANDSCAPE}px;
            gap: 10mm;
          }

          .summary-print-sheet--landscape .summary-print-table {
            font-size: ${SUMMARY_PRINT_FONT_TABLE_LANDSCAPE}px;
          }

          .summary-print-sheet--landscape .summary-print-header-right {
            font-size: ${SUMMARY_PRINT_FONT_HEADER_RIGHT_LANDSCAPE}px;
          }

          .summary-print-sheet--landscape .summary-print-month-line {
            font-size: ${SUMMARY_PRINT_FONT_MONTH_LINE_LANDSCAPE}px;
          }

          .summary-print-sheet--landscape .summary-print-calculations {
            font-size: ${SUMMARY_PRINT_FONT_CALCULATIONS_LANDSCAPE}px;
          }

          .summary-print-sheet--landscape .summary-print-footer {
            font-size: ${SUMMARY_PRINT_FONT_FOOTER_LANDSCAPE}px;
          }

          .summary-print-sheet--landscape .summary-print-table th,
          .summary-print-sheet--landscape .summary-print-table td,
          .summary-print-sheet--landscape .summary-print-calculations td {
            padding: 0.7mm 0.8mm;
            line-height: 0.9;
          }
        }
      `}</style>
    </main>
  );
}