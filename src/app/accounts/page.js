"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

export default function AccountsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
    if (status === "authenticated" && !session?.user?.isAdmin) {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <main className="min-h-screen w-full flex items-center justify-center p-4">
        <div className="panel p-6 muted">Loading session...</div>
      </main>
    );
  }

  if (!session?.user?.isAdmin) {
    return null;
  }

  const username = session?.user?.name || "User";
  return <AccountsContent key={username} username={username} />;
}

function AccountsContent({ username }) {
  const router = useRouter();
  const profileMenuRef = useRef(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editingPassword, setEditingPassword] = useState("");
  const [editingIsAdmin, setEditingIsAdmin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/accounts", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load users.");
      }

      setUsers(Array.isArray(result.data) ? result.data : []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load users.");
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
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

  const handleAddUser = async (event) => {
    event.preventDefault();
    setError("");
    setStatusMessage("");

    const trimmedUsername = newUsername.trim();
    const trimmedPassword = newPassword.trim();

    if (!trimmedUsername) {
      setError("Username is required.");
      return;
    }

    if (trimmedUsername.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      setError("Username can only contain letters, numbers, hyphens, and underscores.");
      return;
    }

    if (!trimmedPassword) {
      setError("Password is required.");
      return;
    }

    if (trimmedPassword.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    setIsAdding(true);

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmedUsername,
          password: trimmedPassword,
          isAdmin: newIsAdmin,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to create user.");
      }

      setNewUsername("");
      setNewPassword("");
      setNewIsAdmin(false);
      setStatusMessage("User created successfully.");
      await loadUsers();
    } catch (addError) {
      setError(addError.message || "Failed to create user.");
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (user) => {
    setEditingId(user.id);
    setEditingPassword("");
    setEditingIsAdmin(Boolean(user.is_admin));
    setError("");
    setStatusMessage("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingPassword("");
    setEditingIsAdmin(false);
  };

  const saveEdit = async () => {
    if (!editingId) {
      return;
    }

    setError("");
    setStatusMessage("");

    const trimmedPassword = editingPassword.trim();

    if (trimmedPassword && trimmedPassword.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    setIsSaving(true);

    try {
      const updates = {};
      if (trimmedPassword) {
        updates.password = trimmedPassword;
      }
      updates.isAdmin = editingIsAdmin;

      const response = await fetch(`/api/accounts/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update user.");
      }

      cancelEdit();
      setStatusMessage("User updated successfully.");
      await loadUsers();
    } catch (saveError) {
      setError(saveError.message || "Failed to update user.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteUser = async (userId) => {
    const user = users.find((u) => u.id === userId);
    const confirmed = window.confirm(
      `Delete user "${user?.username}"? This action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setError("");
    setStatusMessage("");

    try {
      const response = await fetch(`/api/accounts/${userId}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete user.");
      }

      if (editingId === userId) {
        cancelEdit();
      }

      setStatusMessage("User deleted successfully.");
      await loadUsers();
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete user.");
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
              <button
                type="button"
                className="flex w-full cursor-pointer items-center rounded-xl bg-white/95 px-3 py-2 text-left text-sm font-semibold text-slate-900"
              >
                Accounts
              </button>
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
              <h1 className="title">User Accounts</h1>
              <p className="muted mt-2">Create new users, manage passwords, and assign admin roles.</p>

              <form onSubmit={handleAddUser} className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-5">
                <div>
                  <label htmlFor="new-username" className="label">
                    Username
                  </label>
                  <input
                    id="new-username"
                    className="field"
                    value={newUsername}
                    onChange={(event) => setNewUsername(event.target.value)}
                    placeholder="e.g. john_doe"
                  />
                </div>

                <div>
                  <label htmlFor="new-password" className="label">
                    Password
                  </label>
                  <input
                    id="new-password"
                    className="field"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Minimum 4 characters"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <label htmlFor="new-admin" className="flex items-center gap-2 cursor-pointer">
                    <input
                      id="new-admin"
                      type="checkbox"
                      checked={newIsAdmin}
                      onChange={(event) => setNewIsAdmin(event.target.checked)}
                      className="cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-slate-700">Admin</span>
                  </label>
                </div>

                <div className="flex items-end">
                  <button type="submit" className="btn btn-success w-full" disabled={isAdding}>
                    {isAdding ? "Creating..." : "Create User"}
                  </button>
                </div>
              </form>

              {statusMessage ? <p className="status-success mt-4">{statusMessage}</p> : null}
              {error ? <p className="status-error mt-2">{error}</p> : null}

              <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-slate-50 text-left text-sm text-slate-600">
                      <th className="px-4 py-3 font-semibold">Username</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td className="px-4 py-6 text-sm muted" colSpan={4}>
                          Loading users...
                        </td>
                      </tr>
                    ) : null}

                    {!isLoading && users.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-sm muted" colSpan={4}>
                          No users found.
                        </td>
                      </tr>
                    ) : null}

                    {!isLoading
                      ? users.map((user) => {
                          const isEditing = editingId === user.id;
                          const createdDate = user.created_at
                            ? new Date(user.created_at).toLocaleDateString()
                            : "-";

                          return (
                            <tr key={user.id} className="border-t border-slate-100 text-sm text-slate-700">
                              <td className="px-4 py-3 font-semibold">{user.username}</td>
                              <td className="px-4 py-3">
                                {isEditing ? (
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingIsAdmin}
                                      onChange={(event) => setEditingIsAdmin(event.target.checked)}
                                      className="cursor-pointer"
                                    />
                                    <span className="text-sm">Admin</span>
                                  </label>
                                ) : (
                                  <span
                                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                                      user.is_admin
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {user.is_admin ? "Admin" : "User"}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">{createdDate}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  {isEditing ? (
                                    <>
                                      <input
                                        type="password"
                                        className="field text-xs py-1 px-2"
                                        value={editingPassword}
                                        onChange={(event) => setEditingPassword(event.target.value)}
                                        placeholder="Leave blank to keep current"
                                      />
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
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => startEdit(user)}
                                        className="btn btn-ghost px-3 py-1 text-xs"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteUser(user.id)}
                                        className="btn border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                                      >
                                        Delete
                                      </button>
                                    </>
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
