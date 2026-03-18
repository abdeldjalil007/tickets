import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

const isValidPassword = (value) => {
  const trimmed = String(value || "").trim();
  return trimmed.length >= 4;
};

const parseId = (idParam) => {
  const parsed = Number.parseInt(String(idParam || ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const resolveUserId = async (paramsMaybePromise) => {
  const resolvedParams = await paramsMaybePromise;
  return parseId(resolvedParams?.id);
};

export async function PATCH(req, { params }) {
  try {
    await requireAdmin(req);

    const userId = await resolveUserId(params);
    if (!userId) {
      return Response.json({ error: "Invalid user id." }, { status: 400 });
    }

    const body = await req.json();
    const updates = {};

    if (Object.hasOwn(body, "password")) {
      const password = String(body?.password || "").trim();
      if (!isValidPassword(password)) {
        return Response.json(
          { error: "Password must be at least 4 characters" },
          { status: 400 }
        );
      }
      updates.password = password;
    }

    if (Object.hasOwn(body, "isAdmin")) {
      updates.is_admin = Boolean(body?.isAdmin);
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No valid updates were provided." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select("id, username, is_admin")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return Response.json({ error: "User not found." }, { status: 404 });
    }

    return Response.json({ data, message: "User updated successfully." });
  } catch (err) {
    if (err.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return Response.json({ error: "Only admins can update users." }, { status: 403 });
    }
    return Response.json({ error: err.message || "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await requireAdmin(req);

    const userId = await resolveUserId(params);
    if (!userId) {
      return Response.json({ error: "Invalid user id." }, { status: 400 });
    }

    // Prevent deleting the last admin
    const { data: adminCount, error: countError } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", true);

    if (countError) throw countError;

    // Check if this user is an admin
    const { data: thisUser, error: fetchError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!thisUser) {
      return Response.json({ error: "User not found." }, { status: 404 });
    }

    if (thisUser.is_admin && (adminCount?.length || 0) <= 1) {
      return Response.json(
        { error: "Cannot delete the last admin user." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) throw error;

    return Response.json({ message: "User deleted successfully." });
  } catch (err) {
    if (err.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return Response.json({ error: "Only admins can delete users." }, { status: 403 });
    }
    return Response.json({ error: err.message || "Something went wrong" }, { status: 500 });
  }
}
