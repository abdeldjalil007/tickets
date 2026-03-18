import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { parseSurfaceId } from "@/lib/surfaces";

const MAX_BIGINT = 9223372036854775807n;
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

export async function PATCH(req) {
  try {
    await requireAdmin(req);

    const body = await req.json();
    const oldDate = String(body?.oldDate || "").trim();
    const oldNumber = String(body?.oldNumber || "").trim();
    const newNumber = String(body?.newNumber || "").trim();
    const parsedSurfaceId = parseSurfaceId(body?.newSurface);

    if (!isValidDate(oldDate) || !/^\d+$/.test(oldNumber) || !/^\d+$/.test(newNumber) || !parsedSurfaceId) {
      return Response.json(
        { error: "Valid old ticket, new ticket number, and surface are required." },
        { status: 400 }
      );
    }

    const oldBigInt = BigInt(oldNumber);
    const newBigInt = BigInt(newNumber);
    if (oldBigInt <= 0n || oldBigInt > MAX_BIGINT || newBigInt <= 0n || newBigInt > MAX_BIGINT) {
      return Response.json({ error: "Ticket number is out of bigint range." }, { status: 400 });
    }

    const { data: surfaceRow, error: surfaceLookupError } = await supabase
      .from("surfaces")
      .select("id")
      .eq("id", parsedSurfaceId)
      .maybeSingle();

    if (surfaceLookupError) throw surfaceLookupError;
    if (!surfaceRow) {
      return Response.json({ error: "Selected surface does not exist." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("tickets")
      .update({ number: newNumber, surface: parsedSurfaceId })
      .eq("date", oldDate)
      .eq("number", oldNumber)
      .select("number, date, surface")
      .maybeSingle();

    if (error) {
      if (String(error.message || "").toLowerCase().includes("duplicate key")) {
        return Response.json({ error: "Ticket number already exists for this date." }, { status: 400 });
      }
      throw error;
    }

    if (!data) {
      return Response.json({ error: "Ticket not found." }, { status: 404 });
    }

    return Response.json({ data, message: "Ticket updated successfully." });
  } catch (err) {
    if (err.message === "Unauthorized") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return Response.json({ error: "Only admins can edit tickets." }, { status: 403 });
    }
    if (
      typeof err?.message === "string" &&
      (err.message.includes("out of range for type integer") || err.message.includes("out of range for type bigint"))
    ) {
      return Response.json(
        { error: "Ticket number is out of bigint range." },
        { status: 400 }
      );
    }

    return Response.json({ error: err.message || "Something went wrong" }, { status: 500 });
  }
}