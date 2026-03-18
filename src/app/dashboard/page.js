"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { normalizeSurfaceValue } from "@/lib/surfaces";

const getTicketDraftKey = (username) => `ticket:${username}`;
const TICKET_ADDED_SUCCESS_KEY = "ticket:add:success";

export default function Dashboard() {
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
  return <DashboardContent key={username} username={username} isAdmin={isAdmin} />;
}

function DashboardContent({ username, isAdmin }) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const storageKey = getTicketDraftKey(username);

  const [draft] = useState(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });

  const [date, setDate] = useState(() => draft?.date || today);
  const [number, setNumber] = useState(() => String(draft?.number || ""));
  const [surface, setSurface] = useState(() => normalizeSurfaceValue(draft?.surface));
  const [surfaces, setSurfaces] = useState([]);
  const [isSurfacesLoading, setIsSurfacesLoading] = useState(true);
  const [error, setError] = useState("");
  const [surfaceLoadError, setSurfaceLoadError] = useState("");
  const [showAddSuccess, setShowAddSuccess] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadSurfaces = async () => {
      setIsSurfacesLoading(true);
      setSurfaceLoadError("");

      try {
        const response = await fetch("/api/surfaces", { cache: "no-store" });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load surfaces.");
        }

        const loadedSurfaces = Array.isArray(result.data) ? result.data : [];
        if (!isMounted) {
          return;
        }

        setSurfaces(loadedSurfaces);
        setSurface((previousSurface) => {
          const normalizedPrevious = normalizeSurfaceValue(previousSurface);
          const hasExistingSurface = loadedSurfaces.some(
            (surfaceOption) => String(surfaceOption.id) === normalizedPrevious
          );
          if (hasExistingSurface) {
            return normalizedPrevious;
          }

          const preferredSurface = loadedSurfaces.find(
            (surfaceOption) => String(surfaceOption.name || "").trim() === "1/2"
          );

          if (preferredSurface) {
            return String(preferredSurface.id);
          }

          return loadedSurfaces[0] ? String(loadedSurfaces[0].id) : "";
        });
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setSurfaces([]);
        setSurface("");
        setSurfaceLoadError(loadError.message || "Failed to load surfaces.");
      } finally {
        if (isMounted) {
          setIsSurfacesLoading(false);
        }
      }
    };

    loadSurfaces();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const hasSuccessFlag = window.sessionStorage.getItem(TICKET_ADDED_SUCCESS_KEY) === "1";
    if (!hasSuccessFlag) {
      return;
    }

    setShowAddSuccess(true);
    window.sessionStorage.removeItem(TICKET_ADDED_SUCCESS_KEY);

    const timeoutId = window.setTimeout(() => {
      setShowAddSuccess(false);
    }, 4300);

    return () => window.clearTimeout(timeoutId);
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

  const submit = (e) => {
    e.preventDefault();
    setError("");

    const normalizedNumber = number.trim();
    const isDigitsOnly = /^\d+$/.test(normalizedNumber);
    if (!isDigitsOnly) {
      setError("Enter a valid positive ticket number.");
      return;
    }

    if (BigInt(normalizedNumber) <= 0n) {
      setError("Enter a valid positive ticket number.");
      return;
    }

    const normalizedSurface = normalizeSurfaceValue(surface);
    const selectedSurfaceExists = surfaces.some((surfaceOption) => String(surfaceOption.id) === normalizedSurface);

    if (!normalizedSurface || !selectedSurfaceExists) {
      setError("Select a valid surface.");
      return;
    }

    const data = { date, number: normalizedNumber, surface: normalizedSurface };
    window.localStorage.setItem(storageKey, JSON.stringify(data));
    router.push("/confirm");
  };

  return (
    <main className="min-h-screen w-full bg-transparent">
      {isSidebarOpen ? (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-slate-900/45 md:hidden"
          aria-label="Close menu overlay"
        />
      ) : null}

      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-[245px] bg-slate-900 p-5 text-white transition-transform duration-300 ${
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
                className="flex w-full cursor-pointer items-center rounded-xl bg-white/95 px-3 py-2 text-left text-sm font-semibold text-slate-900"
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

        <section className={`flex min-h-screen flex-1 flex-col ${isSidebarOpen ? "md:pl-[245px]" : ""}`}>
          <header className="flex items-center gap-3 bg-slate-900 px-4 py-3 text-white sm:px-5">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="cursor-pointer rounded-lg border border-white/25 px-3 py-1.5 text-lg leading-none transition hover:bg-white/12"
              aria-label="Open menu"
            >
              ☰
            </button>

            <div className="hidden min-w-0 flex-1 sm:block">
              <div className="flex items-center rounded-lg border border-white/15 bg-slate-800 px-3 py-2 text-sm text-blue-100">
                <input
                  type="text"
                  placeholder="Search"
                  className="w-full bg-transparent outline-none placeholder:text-blue-200"
                />
              </div>
            </div>

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

                {showAddSuccess ? (
                  <div className="success-toast absolute right-0 top-11 z-30" role="status" aria-live="polite">
                    <span className="success-toast__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" className="success-toast__svg">
                        <circle className="success-toast__ring" cx="12" cy="12" r="10" />
                        <path className="success-toast__tick" d="M7 12.5L10.5 16L17 9.5" />
                      </svg>
                    </span>
                    <div>
                      <p className="success-toast__title">Success</p>
                      <p className="success-toast__message">Ticket added successfully.</p>
                    </div>
                  </div>
                ) : null}

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

          <section className="flex-1 overflow-auto p-4 sm:p-6">
            <div className="panel p-5 sm:p-7">
              <p className="muted mb-5">Create a ticket draft before confirmation.</p>

              <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="date" className="label">
                    Date
                  </label>
                  <input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="field"
                  />
                </div>

                <div>
                  <label htmlFor="number" className="label">
                    Ticket Number
                  </label>
                  <input
                    id="number"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="e.g. 1024"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="field"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="surface" className="label">
                    Surface
                  </label>
                  <select
                    id="surface"
                    value={surface}
                    onChange={(e) => setSurface(e.target.value)}
                    className="field cursor-pointer"
                    disabled={isSurfacesLoading || surfaces.length === 0}
                  >
                    {surfaces.map((surfaceOption) => (
                      <option key={surfaceOption.id} value={String(surfaceOption.id)}>
                        {surfaceOption.name}
                      </option>
                    ))}
                  </select>
                </div>

                {surfaceLoadError ? <p className="status-error md:col-span-2">{surfaceLoadError}</p> : null}

                {error ? <p className="status-error md:col-span-2">{error}</p> : null}

                <button className="btn btn-success md:col-span-2" type="submit">
                  Continue to Confirmation
                </button>
              </form>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
