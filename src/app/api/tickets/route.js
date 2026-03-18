import { supabase } from "@/lib/supabase";
import { getToken } from "next-auth/jwt";
import { parseSurfaceId } from "@/lib/surfaces";

const MAX_BIGINT = 9223372036854775807n;

export async function POST(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { date, number, surface } = body;

    const normalizedDate = String(date || "").trim();
    const parsedSurfaceId = parseSurfaceId(surface);
    const normalizedNumber = String(number || "").trim();

    if (!normalizedDate || !parsedSurfaceId || !/^\d+$/.test(normalizedNumber)) {
      return Response.json(
        { error: "Date, a valid surface, and a valid positive ticket number are required." },
        { status: 400 }
      );
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

    const parsedBigInt = BigInt(normalizedNumber);
    if (parsedBigInt <= 0n || parsedBigInt > MAX_BIGINT) {
      return Response.json(
        { error: "Ticket number is out of bigint range." },
        { status: 400 }
      );
    }

    // Check if ticket with same number for the same date already exists
    const { data: exists, error: checkError } = await supabase
      .from("tickets")
      .select("number")
      .eq("number", normalizedNumber)
      .eq("date", normalizedDate);

    if (checkError) throw checkError;

    if (exists.length > 0) {
      return Response.json({ error: "Ticket number already exists!" }, { status: 400 });
    }

    // Insert new ticket
    const { data, error } = await supabase
      .from("tickets")
      .insert([{ number: normalizedNumber, date: normalizedDate, surface: parsedSurfaceId }]);

    if (error) throw error;

    return Response.json({ data, message: "Ticket added successfully!" });
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