import { supabase } from "@/lib/supabase";
import { requireAuth, requireAdmin } from "@/lib/auth";

const isValidPrice = (value) => Number.isFinite(value) && value >= 0;

export async function GET(req) {
  try {
    await requireAuth(req);

    const { data, error } = await supabase
      .from("surfaces")
      .select("id, name, price")
      .order("id", { ascending: true });

    if (error) throw error;

    return Response.json({ data });
  } catch (err) {
    if (err.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ error: err.message || "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await requireAdmin(req);

    const body = await req.json();
    const name = String(body?.name || "").trim();
    const parsedPrice = Number(body?.price);

    if (!name || !isValidPrice(parsedPrice)) {
      return Response.json({ error: "Surface name and a valid price are required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("surfaces")
      .insert([{ name, price: parsedPrice }])
      .select("id, name, price")
      .single();

    if (error) throw error;

    return Response.json({ data, message: "Surface added successfully." });
  } catch (err) {
    if (err.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return Response.json({ error: "Only admins can create surfaces." }, { status: 403 });
    }
    return Response.json({ error: err.message || "Something went wrong" }, { status: 500 });
  }
}