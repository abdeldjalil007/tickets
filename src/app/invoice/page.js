"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const amountFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const printableMonthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const printableMonthNameFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  timeZone: "UTC",
});

const printableDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const formatAmount = (value) => amountFormatter.format(Number(value || 0));

const formatInvoiceMonthCode = (monthData) => {
  const monthValue = String(monthData?.value || "").trim();
  if (/^\d{4}-\d{2}$/.test(monthValue)) {
    const [year, month] = monthValue.split("-");
    return `${month}/${year}`;
  }

  return String(monthData?.label || "-").trim() || "-";
};

const formatInvoiceMonthName = (monthData) => {
  const monthValue = String(monthData?.value || "").trim();
  if (/^\d{4}-\d{2}$/.test(monthValue)) {
    const [year, month] = monthValue.split("-").map(Number);
    return printableMonthNameFormatter.format(new Date(Date.UTC(year, month - 1, 1))).toLocaleUpperCase("fr-FR");
  }

  return "-";
};

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

const INVOICE_CLIENT_LINES = [
  "CLIENT : ANEP",
  "RC : 16/02-0010224B99",
  "NIF : 09991600102249616002",
  "NIS : 0989 1623 00014 41",
  "ADRESSE : 1er avenue Pasteur, Alger",
];

const INVOICE_PRINT_FONT_BASE_PORTRAIT = 12;
const INVOICE_PRINT_FONT_HEADER_RIGHT_PORTRAIT = 13.5;
const INVOICE_PRINT_FONT_DATE_PORTRAIT = 16;
const INVOICE_PRINT_FONT_CLIENT_PORTRAIT = 16;
const INVOICE_PRINT_FONT_TITLE_PORTRAIT = 18;
const INVOICE_PRINT_FONT_TABLE_PORTRAIT = 13;
const INVOICE_PRINT_FONT_TABLE_HEADER_PORTRAIT = 12;
const INVOICE_PRINT_FONT_NOTE_PORTRAIT = 15;

export default function InvoicePage() {
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
  return <InvoiceContent key={username} username={username} isAdmin={isAdmin} />;
}

function InvoiceContent({ username, isAdmin }) {
  const router = useRouter();
  const profileMenuRef = useRef(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [monthOptions, setMonthOptions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  
  const todayDateStr = new Date().toISOString().split("T")[0];
  const [invoiceDate, setInvoiceDate] = useState(todayDateStr);

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
          throw new Error(result.error || "Failed to load invoice filters.");
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
        setError(loadError.message || "Failed to load invoice filters.");
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
        throw new Error(result.error || "Failed to load invoice data.");
      }

      setSummary(result.summary || null);
    } catch (loadError) {
      setSummary(null);
      setError(loadError.message || "Failed to load invoice data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const issueDate = invoiceDate 
    ? invoiceDate.split("-").reverse().join("/")
    : printableDateFormatter.format(new Date());
  
  const invoiceMonthCode = summary ? formatInvoiceMonthCode(summary.month) : "-";
  const invoiceMonthName = summary ? formatInvoiceMonthName(summary.month) : "-";

  return (
    <main className="invoice-app-root min-h-screen w-full bg-transparent">
      {isSidebarOpen ? (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          className="invoice-print-hide fixed inset-0 z-20 bg-slate-900/45 md:hidden"
          aria-label="Close menu overlay"
        />
      ) : null}

      <div className="flex min-h-screen overflow-x-hidden">
        <aside
          className={`invoice-app-sidebar invoice-print-hide fixed inset-y-0 left-0 z-30 w-[245px] bg-slate-900 p-5 text-white transition-transform duration-300 ease-in-out ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
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
                onClick={() => router.push("/summary")}
                className="flex w-full cursor-pointer items-center rounded-xl px-3 py-2 text-left text-sm font-semibold text-blue-100 transition hover:bg-white/10"
              >
                Summary
              </button>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center rounded-xl bg-white/95 px-3 py-2 text-left text-sm font-semibold text-slate-900"
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

        <section className={`invoice-app-shell flex min-h-screen flex-1 flex-col transition-[padding-left] duration-300 ease-in-out ${isSidebarOpen ? "md:pl-[245px]" : "md:pl-0"}`}>
          <header className="invoice-app-header invoice-print-hide flex items-center gap-3 bg-slate-900 pl-16 pr-4 py-3 text-white sm:pl-20 sm:pr-5">
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

          <section className="invoice-app-content flex-1 overflow-auto p-4 sm:p-6">
            <div className="invoice-panel panel p-5 sm:p-7">
              <h1 className="title">Monthly Invoice</h1>
              <p className="muted mt-2">Select a month to generate the invoice preview and print it.</p>

              <form onSubmit={handleSubmit} className="invoice-controls mt-6 grid grid-cols-1 gap-3 lg:grid-cols-5 md:grid-cols-2">
                <div className="lg:col-span-2">
                  <label htmlFor="invoice-month" className="label">
                    Month
                  </label>
                  <select
                    id="invoice-month"
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

                <div>
                  <label htmlFor="invoice-date" className="label">
                    Invoice Date
                  </label>
                  <input
                    id="invoice-date"
                    type="date"
                    className="field"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
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
                <div className="invoice-screen-shell mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-center text-xl font-bold text-slate-900">FACTURE {invoiceMonthCode}</h2>
                  <p className="mt-1 text-center text-sm text-slate-600">{formatPrintableMonthLabel(summary.month)}</p>

                  <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <table className="w-full text-sm text-slate-800">
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="px-4 py-3 font-medium">Total Brut</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatAmount(summary.totalGeneral)}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="px-4 py-3 font-medium">Commission ANEP 30%</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatAmount(summary.commissionAnep)}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="px-4 py-3 font-medium">Montant HT</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatAmount(summary.montantHt)}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="px-4 py-3 font-medium">TVA 19%</td>
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
                <section className="invoice-print-sheet" aria-hidden="true">
                  <article className="invoice-print-page">
                    <header className="invoice-print-header">
                      <div className="invoice-print-logo-wrap">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/assets/image1.png"
                          alt="Sport News logo"
                          className="invoice-print-logo"
                          loading="eager"
                          decoding="sync"
                        />
                      </div>
                      <div className="invoice-print-header-right">
                        {PRINT_HEADER_LINES.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </div>
                    </header>

                    <p className="invoice-print-date">{issueDate}</p>

                    <section className="invoice-print-client">
                      {INVOICE_CLIENT_LINES.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </section>

                    <h1 className="invoice-print-title">FACTURE {invoiceMonthCode}</h1>

                    <table className="invoice-print-table">
                      <thead>
                        <tr>
                          <th>Désignation</th>
                          <th>Quantité</th>
                          <th>Montant BRUT</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td rowSpan={6} className="invoice-print-designation">
                            INSERTIONS DU
                            <br />
                            MOIS DE
                            <br />
                            {invoiceMonthName}
                          </td>
                          <td className="invoice-print-cell-center">1</td>
                          <td className="invoice-print-cell-value">{formatAmount(summary.totalGeneral)}</td>
                        </tr>
                        <tr>
                          <td>Total Brut</td>
                          <td className="invoice-print-cell-value">{formatAmount(summary.totalGeneral)}</td>
                        </tr>
                        <tr>
                          <td>Commission ANEP 30%</td>
                          <td className="invoice-print-cell-value">{formatAmount(summary.commissionAnep)}</td>
                        </tr>
                        <tr>
                          <td>Montant HT</td>
                          <td className="invoice-print-cell-value">{formatAmount(summary.montantHt)}</td>
                        </tr>
                        <tr>
                          <td>TVA 19%</td>
                          <td className="invoice-print-cell-value">{formatAmount(summary.montantTva)}</td>
                        </tr>
                        <tr>
                          <td>TTC</td>
                          <td className="invoice-print-cell-value">{formatAmount(summary.ttc)}</td>
                        </tr>
                      </tbody>
                    </table>

                    <p className="invoice-print-note">
                      <strong>Arrête la présente facture à la somme de :</strong> {formatAmount(summary.ttc)} Dinars Algerien.
                    </p>
                  </article>
                </section>
              ) : null}

              {!summary && !error && hasSubmitted ? (
                <p className="muted mt-6 text-sm">No invoice data is available for the current selection.</p>
              ) : null}
            </div>
          </section>
        </section>
      </div>

      <style jsx global>{`
        .invoice-print-sheet {
          display: none;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          .invoice-app-sidebar,
          .invoice-app-header,
          .invoice-controls,
          .invoice-screen-shell,
          .invoice-print-hide,
          .status-error {
            display: none !important;
          }

          .invoice-app-root,
          .invoice-app-shell,
          .invoice-app-content {
            background: #fff !important;
            overflow: visible !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .invoice-panel {
            box-shadow: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .invoice-panel > .title,
          .invoice-panel > .muted {
            display: none !important;
          }

          .invoice-print-sheet {
            display: block !important;
          }

          .invoice-print-page {
            color: #000;
            font-family: "Times New Roman", serif;
            font-size: ${INVOICE_PRINT_FONT_BASE_PORTRAIT}px;
          }

          .invoice-print-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 6mm;
          }

          .invoice-print-logo-wrap {
            width: 34mm;
          }

          .invoice-print-logo {
            width: 100%;
            height: auto;
            object-fit: contain;
          }

          .invoice-print-header-right {
            max-width: 90mm;
            direction: rtl;
            text-align: right;
            line-height: 1.3;
            font-size: ${INVOICE_PRINT_FONT_HEADER_RIGHT_PORTRAIT}px;
          }

          .invoice-print-header-right p,
          .invoice-print-client p {
            margin: 0;
          }

          .invoice-print-date {
            text-align: right;
            margin: 0 0 5mm;
            font-size: ${INVOICE_PRINT_FONT_DATE_PORTRAIT}px;
          }

          .invoice-print-client {
            margin-bottom: 7mm;
            line-height: 1.15;
            font-size: ${INVOICE_PRINT_FONT_CLIENT_PORTRAIT}px;
          }

          .invoice-print-title {
            text-align: center;
            margin: 0 0 8mm;
            font-size: ${INVOICE_PRINT_FONT_TITLE_PORTRAIT}px;
            font-weight: 700;
            letter-spacing: 0.03em;
          }

          .invoice-print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: ${INVOICE_PRINT_FONT_TABLE_PORTRAIT}px;
          }

          .invoice-print-table th,
          .invoice-print-table td {
            border: 1px solid #000;
            padding: 1.2mm 1mm;
            line-height: 1.08;
          }

          .invoice-print-table th {
            text-align: center;
            font-size: ${INVOICE_PRINT_FONT_TABLE_HEADER_PORTRAIT}px;
            font-weight: 700;
          }

          .invoice-print-designation {
            width: 26%;
            text-align: center;
            vertical-align: middle;
            font-weight: 700;
          }

          .invoice-print-cell-center {
            text-align: center;
            font-weight: 700;
          }

          .invoice-print-cell-value {
            text-align: right;
            font-weight: 700;
          }

          .invoice-print-note {
            margin-top: 14mm;
            font-size: ${INVOICE_PRINT_FONT_NOTE_PORTRAIT}px;
            line-height: 1.35;
          }
        }
      `}</style>
    </main>
  );
}
