import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

const isValidUsername = (value) => {
  const trimmed = String(value || "").trim();
  return trimmed.length >= 3 && /^[a-zA-Z0-9_-]+$/.test(trimmed);
};

const isValidPassword = (value) => {
  const trimmed = String(value || "").trim();
  return trimmed.length >= 4;
};

export async function GET(req) {
  try {
    await requireAdmin(req);

    const { data, error } = await supabase
      .from("users")
      .select("id, username, is_admin, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return Response.json({ data: data || [] });
  } catch (err) {
    if (err.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return Response.json({ error: "Only admins can view users." }, { status: 403 });
    }
    return Response.json({ error: err.message || "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await requireAdmin(req);

    const body = await req.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "").trim();
    const isAdmin = Boolean(body?.isAdmin) || false;

    if (!isValidUsername(username)) {
      return Response.json(
        { error: "Username must be at least 3 characters, alphanumeric with - or _" },
        { status: 400 }
      );
    }

    if (!isValidPassword(password)) {
      return Response.json(
        { error: "Password must be at least 4 characters" },
        { status: 400 }
      );
    }

    // Check if username already exists
    const { data: existing, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existing) {
      return Response.json(
        { error: "Username already exists" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("users")
      .insert([{ username, password, is_admin: isAdmin }])
      .select("id, username, is_admin, created_at")
      .single();

    if (error) throw error;

    return Response.json({ data, message: "User created successfully." });
  } catch (err) {
    if (err.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return Response.json({ error: "Only admins can create users." }, { status: 403 });
    }
    return Response.json({ error: err.message || "Something went wrong" }, { status: 500 });
  }
}
