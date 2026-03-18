import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

const isValidPrice = (value) => Number.isFinite(value) && value >= 0;

const parseId = (idParam) => {
  const parsed = Number.parseInt(String(idParam || ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const resolveSurfaceId = async (paramsMaybePromise) => {
  const resolvedParams = await paramsMaybePromise;
  return parseId(resolvedParams?.id);
};

export async function PATCH(req, { params }) {
  try {
    await requireAdmin(req);

    const surfaceId = await resolveSurfaceId(params);
    if (!surfaceId) {
      return Response.json({ error: "Invalid surface id." }, { status: 400 });
    }

    const body = await req.json();
    const updates = {};

    if (Object.hasOwn(body, "name")) {
      const name = String(body?.name || "").trim();
      if (!name) {
        return Response.json({ error: "Surface name cannot be empty." }, { status: 400 });
      }

      updates.name = name;
    }

    if (Object.hasOwn(body, "price")) {
      const parsedPrice = Number(body?.price);
      if (!isValidPrice(parsedPrice)) {
        return Response.json({ error: "Surface price must be a valid number." }, { status: 400 });
      }

      updates.price = parsedPrice;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No valid updates were provided." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("surfaces")
      .update(updates)
      .eq("id", surfaceId)
      .select("id, name, price")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return Response.json({ error: "Surface not found." }, { status: 404 });
    }

    return Response.json({ data, message: "Surface updated successfully." });
  } catch (err) {
    if (err.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return Response.json({ error: "Only admins can edit surfaces." }, { status: 403 });
    }
    return Response.json({ error: err.message || "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await requireAdmin(req);

    const surfaceId = await resolveSurfaceId(params);
    if (!surfaceId) {
      return Response.json({ error: "Invalid surface id." }, { status: 400 });
    }

    const { error } = await supabase.from("surfaces").delete().eq("id", surfaceId);
    if (error) throw error;

    return Response.json({ message: "Surface deleted successfully." });
  } catch (err) {
    if (err.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return Response.json({ error: "Only admins can delete surfaces." }, { status: 403 });
    }
    return Response.json({ error: err.message || "Something went wrong" }, { status: 500 });
  }
}