"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const formatPrice = (value) => Number(value || 0).toLocaleString();

export default function SurfacesPage() {
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
  return <SurfacesContent key={username} username={username} isAdmin={isAdmin} />;
}

function SurfacesContent({ username, isAdmin }) {
  const router = useRouter();
  const profileMenuRef = useRef(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [surfaces, setSurfaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingPrice, setEditingPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadSurfaces = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/surfaces", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load surfaces.");
      }

      setSurfaces(Array.isArray(result.data) ? result.data : []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load surfaces.");
      setSurfaces([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSurfaces();
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

  const handleAddSurface = async (event) => {
    event.preventDefault();
    setError("");
    setStatusMessage("");

    const trimmedName = newName.trim();
    const parsedPrice = Number(newPrice);

    if (!trimmedName) {
      setError("Surface name is required.");
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("Enter a valid price.");
      return;
    }

    setIsAdding(true);

    try {
      const response = await fetch("/api/surfaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, price: parsedPrice }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to add surface.");
      }

      setNewName("");
      setNewPrice("");
      setStatusMessage("Surface added successfully.");
      await loadSurfaces();
    } catch (addError) {
      setError(addError.message || "Failed to add surface.");
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (surface) => {
    setEditingId(surface.id);
    setEditingName(String(surface.name || ""));
    setEditingPrice(String(surface.price ?? ""));
    setError("");
    setStatusMessage("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingPrice("");
  };

  const saveEdit = async () => {
    if (!editingId) {
      return;
    }

    setError("");
    setStatusMessage("");

    const trimmedName = editingName.trim();
    const parsedPrice = Number(editingPrice);

    if (!trimmedName) {
      setError("Surface name is required.");
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("Enter a valid price.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/surfaces/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, price: parsedPrice }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update surface.");
      }

      cancelEdit();
      setStatusMessage("Surface updated successfully.");
      await loadSurfaces();
    } catch (saveError) {
      setError(saveError.message || "Failed to update surface.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSurface = async (surfaceId) => {
    const confirmed = window.confirm("Delete this surface? Related tickets may be removed because of database cascade rules.");
    if (!confirmed) {
      return;
    }

    setError("");
    setStatusMessage("");

    try {
      const response = await fetch(`/api/surfaces/${surfaceId}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete surface.");
      }

      if (editingId === surfaceId) {
        cancelEdit();
      }

      setStatusMessage("Surface deleted successfully.");
      await loadSurfaces();
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete surface.");
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
                onClick={() => router.push("/search")}
                className="flex w-full cursor-pointer items-center rounded-xl px-3 py-2 text-left text-sm font-semibold text-blue-100 transition hover:bg-white/10"
              >
                Search Tickets
              </button>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center rounded-xl bg-white/95 px-3 py-2 text-left text-sm font-semibold text-slate-900"
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
              <h1 className="title">Manage Surfaces</h1>
              <p className="muted mt-2">Add, update, or remove prices. Ticket forms will use these live values automatically.</p>

              {isAdmin ? (
                <form onSubmit={handleAddSurface} className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <label htmlFor="new-surface-name" className="label">
                      Surface Name
                    </label>
                    <input
                      id="new-surface-name"
                      className="field"
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      placeholder="e.g. 1/16"
                    />
                  </div>

                  <div>
                    <label htmlFor="new-surface-price" className="label">
                      Price
                    </label>
                    <input
                      id="new-surface-price"
                      className="field"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newPrice}
                      onChange={(event) => setNewPrice(event.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div className="flex items-end">
                    <button type="submit" className="btn btn-success w-full" disabled={isAdding}>
                      {isAdding ? "Adding..." : "Add Surface"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-6 rounded-lg border border-slate-300 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">Only administrators can add surfaces.</p>
                </div>
              )}

              {statusMessage ? <p className="status-success mt-4">{statusMessage}</p> : null}
              {error ? <p className="status-error mt-2">{error}</p> : null}

              <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-slate-50 text-left text-sm text-slate-600">
                      <th className="px-4 py-3 font-semibold">ID</th>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Price</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td className="px-4 py-6 text-sm muted" colSpan={4}>
                          Loading surfaces...
                        </td>
                      </tr>
                    ) : null}

                    {!isLoading && surfaces.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-sm muted" colSpan={4}>
                          No surfaces found.
                        </td>
                      </tr>
                    ) : null}

                    {!isLoading
                      ? surfaces.map((surface) => {
                          const isEditing = editingId === surface.id;

                          return (
                            <tr key={surface.id} className="border-t border-slate-100 text-sm text-slate-700">
                              <td className="px-4 py-3 font-semibold">{surface.id}</td>
                              <td className="px-4 py-3">
                                {isEditing ? (
                                  <input
                                    className="field"
                                    value={editingName}
                                    onChange={(event) => setEditingName(event.target.value)}
                                  />
                                ) : (
                                  surface.name
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {isEditing ? (
                                  <input
                                    className="field"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editingPrice}
                                    onChange={(event) => setEditingPrice(event.target.value)}
                                  />
                                ) : (
                                  formatPrice(surface.price)
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={saveEdit}
                                        disabled={isSaving}
                                        className="btn btn-primary px-3 py-1 text-xs"
                                      >
                                        {isSaving ? "Saving..." : "Save"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEdit}
                                        className="btn btn-ghost px-3 py-1 text-xs"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : isAdmin ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => startEdit(surface)}
                                        className="btn btn-ghost px-3 py-1 text-xs"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteSurface(surface.id)}
                                        className="btn border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                                      >
                                        Delete
                                      </button>
                                    </>
                                  ) : (
                                    <p className="text-xs text-slate-500">No actions available</p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}