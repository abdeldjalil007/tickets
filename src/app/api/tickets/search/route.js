import { supabase } from "@/lib/supabase";
import { getToken } from "next-auth/jwt";
import { parseSurfaceId } from "@/lib/surfaces";

const MAX_BIGINT = 9223372036854775807n;
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

export async function GET(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const numberParam = searchParams.get("number");
    
    if (!numberParam || !/^\d+$/.test(numberParam)) {
      return Response.json({ error: "A valid positive ticket number is required." }, { status: 400 });
    }

    const parsedBigInt = BigInt(numberParam);
    if (parsedBigInt <= 0n || parsedBigInt > MAX_BIGINT) {
      return Response.json({ error: "Ticket number is out of bigint range." }, { status: 400 });
    }

    // Fetch tickets matching the number
    const { data: tickets, error } = await supabase
      .from("tickets")
      .select("number, date, surface, surfaces ( id, name )")
      .eq("number", numberParam)
      .order("date", { ascending: false });

    if (error) throw error;

    return Response.json({ tickets: tickets || [] });
  } catch (err) {
    return Response.json({ error: err.message || "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const oldDate = String(body?.oldDate || "").trim();
    const newDate = String(body?.newDate || oldDate).trim();
    const oldNumber = String(body?.oldNumber || "").trim();
    const newNumber = String(body?.newNumber || "").trim();
    const parsedSurfaceId = parseSurfaceId(body?.newSurface);

    if (!isValidDate(oldDate) || !isValidDate(newDate) || !/^\d+$/.test(oldNumber) || !/^\d+$/.test(newNumber) || !parsedSurfaceId) {
      return Response.json(
        { error: "Valid old ticket date, new date, new ticket number, and surface are required." },
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

    // Enforce global uniqueness for ticket numbers, excluding the ticket being edited.
    const { data: conflictingTickets, error: conflictLookupError } = await supabase
      .from("tickets")
      .select("date, number")
      .eq("number", newNumber);

    if (conflictLookupError) throw conflictLookupError;

    const hasConflict = (conflictingTickets || []).some(
      (ticket) => String(ticket.date) !== oldDate || String(ticket.number) !== oldNumber
    );

    if (hasConflict) {
      return Response.json({ error: "Ticket number already exists." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("tickets")
      .update({ date: newDate, number: newNumber, surface: parsedSurfaceId })
      .eq("date", oldDate)
      .eq("number", oldNumber)
      .select("number, date, surface")
      .maybeSingle();

    if (error) {
      if (String(error.message || "").toLowerCase().includes("duplicate key")) {
        return Response.json({ error: "Ticket number already exists." }, { status: 400 });
      }
      throw error;
    }

    if (!data) {
      return Response.json({ error: "Ticket not found." }, { status: 404 });
    }

    return Response.json({ data, message: "Ticket updated successfully!" });
  } catch (err) {
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

export async function DELETE(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const date = String(body?.date || "").trim();
    const number = String(body?.number || "").trim();

    if (!isValidDate(date) || !/^\d+$/.test(number)) {
      return Response.json(
        { error: "Valid ticket date and ticket number are required." },
        { status: 400 }
      );
    }

    const parsedBigInt = BigInt(number);
    if (parsedBigInt <= 0n || parsedBigInt > MAX_BIGINT) {
      return Response.json({ error: "Ticket number is out of bigint range." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("tickets")
      .delete()
      .eq("date", date)
      .eq("number", number)
      .select("number, date")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return Response.json({ error: "Ticket not found." }, { status: 404 });
    }

    return Response.json({ data, message: "Ticket deleted successfully!" });
  } catch (err) {
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
