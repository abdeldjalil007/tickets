"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

export default function SearchPage() {
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
  return <SearchContent key={username} username={username} isAdmin={isAdmin} />;
}

function SearchContent({ username, isAdmin }) {
  const router = useRouter();
  const profileMenuRef = useRef(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [surfaces, setSurfaces] = useState([]);
  
  const [searchNumber, setSearchNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const [editingKey, setEditingKey] = useState("");
  const [editingDate, setEditingDate] = useState("");
  const [editingNumber, setEditingNumber] = useState("");
  const [editingSurfaceId, setEditingSurfaceId] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadSurfaces = async () => {
      try {
        const response = await fetch("/api/surfaces", { cache: "no-store" });
        const result = await response.json();
        if (response.ok && isMounted) {
          setSurfaces(Array.isArray(result.data) ? result.data : []);
        }
      } catch {
        if (isMounted) setSurfaces([]);
      }
    };
    loadSurfaces();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const timeoutId = window.setTimeout(() => setStatusMessage(""), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  useEffect(() => {
    if (!isProfileOpen) return;
    const handleOutsideClick = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setIsProfileOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isProfileOpen]);

  const handleSearch = async (event) => {
    if (event) event.preventDefault();
    setError("");
    setStatusMessage("");
    setHasSearched(true);
    cancelEdit();

    const normalizedNumber = searchNumber.trim();
    if (!/^\d+$/.test(normalizedNumber)) {
      setError("Please enter a valid ticket number.");
      setTickets([]);
      return;
    }

    setIsSearching(true);
    try {
      const query = new URLSearchParams({ number: normalizedNumber });
      const response = await fetch(`/api/tickets/search?${query.toString()}`, { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to search tickets.");
      }

      setTickets(result.tickets || []);
    } catch (err) {
      setError(err.message || "Failed to search tickets.");
      setTickets([]);
    } finally {
      setIsSearching(false);
    }
  };

  const getRowKey = (ticket) => `${ticket.date}-${ticket.number}`;

  const startEdit = (ticket) => {
    setEditingKey(getRowKey(ticket));
    setEditingDate(String(ticket.date || ""));
    setEditingNumber(String(ticket.number || ""));
    setEditingSurfaceId(String(ticket.surface || ""));
    setError("");
    setStatusMessage("");
  };

  const cancelEdit = () => {
    setEditingKey("");
    setEditingDate("");
    setEditingNumber("");
    setEditingSurfaceId("");
  };

  const saveEdit = async (ticket) => {
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
      const response = await fetch("/api/tickets/search", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldDate: ticket.date,
          newDate: editingDate,
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
      setStatusMessage("Ticket modified successfully.");
      
      // Update local state ticket list to reflect changes without a full fetch if we want
      // Or simply re-run the search to ensure sync
      if (normalizedNumber === searchNumber.trim()) {
        await handleSearch();
      } else {
        // If the number was changed to something else, we can re-search with the original search number
        await handleSearch(); 
      }
    } catch (saveError) {
      setError(saveError.message || "Failed to update ticket.");
    } finally {
      setIsSavingEdit(false);
    }
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

      <div className="flex min-h-screen overflow-x-hidden">
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-[245px] bg-slate-900 p-5 text-white transition-transform duration-300 ease-in-out ${
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
                className="flex w-full cursor-pointer items-center rounded-xl bg-white/95 px-3 py-2 text-left text-sm font-semibold text-slate-900"
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

        <section className={`flex min-h-screen flex-1 flex-col transition-[padding-left] duration-300 ease-in-out ${isSidebarOpen ? "md:pl-[245px]" : "md:pl-0"}`}>
          <header className="flex items-center gap-3 bg-slate-900 pl-16 pr-4 py-3 text-white sm:pl-20 sm:pr-5">
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

          <section className="flex-1 overflow-auto p-4 sm:p-6">
            <div className="panel p-5 sm:p-7">
              <h1 className="title">Search Tickets</h1>
              <p className="muted mt-2">Find and modify existing tickets by their ticket number.</p>

              <form onSubmit={handleSearch} className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label htmlFor="search-number" className="label">
                    Ticket Number
                  </label>
                  <input
                    id="search-number"
                    className="field"
                    value={searchNumber}
                    onChange={(event) => setSearchNumber(event.target.value)}
                    placeholder="Enter ticket number (N°BC)..."
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </div>

                <div className="flex items-end">
                  <button type="submit" className="btn btn-success w-full" disabled={isSearching}>
                    {isSearching ? "Searching..." : "Search"}
                  </button>
                </div>
              </form>

              {statusMessage ? <p className="status-success mt-4">{statusMessage}</p> : null}
              {error ? <p className="status-error mt-4">{error}</p> : null}

              {hasSearched && !isSearching && tickets.length === 0 ? (
                <p className="muted mt-6 text-sm">No tickets found with that number.</p>
              ) : null}

              {tickets.length > 0 ? (
                <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full bg-white">
                    <thead>
                      <tr className="bg-slate-50 text-left text-sm text-slate-600">
                        <th className="px-4 py-3 font-semibold">DATE</th>
                        <th className="px-4 py-3 font-semibold">N°BC</th>
                        <th className="px-4 py-3 font-semibold">SURFACE</th>
                        <th className="px-4 py-3 font-semibold">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((ticket) => {
                        const rowKey = getRowKey(ticket);
                        const isEditing = editingKey === rowKey;

                        return (
                          <tr key={rowKey} className="border-t border-slate-100 text-sm text-slate-700">
                            <td className="px-4 py-3 font-semibold align-top">
                              {isEditing ? (
                                <input
                                  className="field min-w-[130px]"
                                  type="date"
                                  value={editingDate}
                                  onChange={(event) => setEditingDate(event.target.value)}
                                />
                              ) : (
                                ticket.date
                              )}
                            </td>
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
                                ticket.surfaces?.name || ticket.surface
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => saveEdit(ticket)}
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
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEdit(ticket)}
                                  disabled={Boolean(editingKey)}
                                  className="btn btn-ghost px-3 py-1 text-xs"
                                >
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
