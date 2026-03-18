import { supabase } from "@/lib/supabase";
import { getToken } from "next-auth/jwt";

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const getMonthLabel = (monthKey) => {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return "";
  }

  return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
};

const isValidMonthKey = (value) => /^\d{4}-\d{2}$/.test(String(value || ""));

const parseWilayaId = (value) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const getMonthRange = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};

const formatDateLabel = (value) => {
  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const [year, month, day] = normalized.split("-");
  return `${day}-${month}-${year.slice(-2)}`;
};

const buildFilters = async () => {
  const { data: ticketFilters, error: ticketFiltersError } = await supabase
    .from("tickets")
    .select("date, wilaya_id")
    .order("date", { ascending: false });

  if (ticketFiltersError) {
    throw ticketFiltersError;
  }

  const monthKeys = [];
  const monthSeen = new Set();
  const wilayaIds = new Set();

  for (const ticket of ticketFilters || []) {
    const monthKey = String(ticket?.date || "").slice(0, 7);
    if (isValidMonthKey(monthKey) && !monthSeen.has(monthKey)) {
      monthSeen.add(monthKey);
      monthKeys.push(monthKey);
    }

    if (Number.isInteger(ticket?.wilaya_id)) {
      wilayaIds.add(ticket.wilaya_id);
    }
  }

  let wilayas = [];
  if (wilayaIds.size > 0) {
    const { data: wilayaRows, error: wilayaRowsError } = await supabase
      .from("wilayas")
      .select("id, name")
      .in("id", Array.from(wilayaIds).sort((left, right) => left - right))
      .order("id", { ascending: true });

    if (wilayaRowsError) {
      throw wilayaRowsError;
    }

    wilayas = (wilayaRows || []).map((wilaya) => ({
      id: wilaya.id,
      name: String(wilaya.name || `Wilaya ${wilaya.id}`).trim() || `Wilaya ${wilaya.id}`,
    }));
  }

  return {
    months: monthKeys.map((value) => ({ value, label: getMonthLabel(value) })),
    wilayas,
  };
};

const buildReport = async (monthKey, wilayaId) => {
  const { start, end } = getMonthRange(monthKey);

  const { data: tickets, error: ticketsError } = await supabase
    .from("tickets")
    .select("number, date, surface")
    .eq("wilaya_id", wilayaId)
    .gte("date", start)
    .lt("date", end)
    .order("date", { ascending: true })
    .order("number", { ascending: true });

  if (ticketsError) {
    throw ticketsError;
  }

  const surfaceIds = Array.from(
    new Set((tickets || []).map((ticket) => ticket?.surface).filter((surfaceId) => Number.isInteger(surfaceId)))
  );

  const surfacesById = new Map();
  if (surfaceIds.length > 0) {
    const { data: surfaces, error: surfacesError } = await supabase
      .from("surfaces")
      .select("id, name, price")
      .in("id", surfaceIds);

    if (surfacesError) {
      throw surfacesError;
    }

    for (const surface of surfaces || []) {
      surfacesById.set(surface.id, surface);
    }
  }

  const days = [];
  let activeDay = null;
  let totalGeneral = 0;

  for (const ticket of tickets || []) {
    const surface = surfacesById.get(ticket.surface);
    const amount = Number(surface?.price || 0);

    if (!activeDay || activeDay.date !== ticket.date) {
      activeDay = {
        date: ticket.date,
        displayDate: formatDateLabel(ticket.date),
        totalAmount: 0,
        tickets: [],
      };
      days.push(activeDay);
    }

    activeDay.tickets.push({
      number: String(ticket.number || ""),
      surfaceId: Number.isInteger(ticket.surface) ? ticket.surface : null,
      surfaceName: String(surface?.name || ticket.surface || "").trim(),
      amount,
    });
    activeDay.totalAmount += amount;
    totalGeneral += amount;
  }

  return {
    month: { value: monthKey, label: getMonthLabel(monthKey) },
    wilayaId,
    days,
    totalGeneral,
  };
};

export async function GET(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const filters = await buildFilters();
    const { searchParams } = new URL(req.url);
    const month = String(searchParams.get("month") || "").trim();
    const wilayaId = parseWilayaId(searchParams.get("wilayaId"));

    if (!month && !wilayaId) {
      return Response.json({ filters, report: null });
    }

    if (!isValidMonthKey(month) || !wilayaId) {
      return Response.json({ error: "A valid month and wilaya are required." }, { status: 400 });
    }

    const selectedWilayaExists = filters.wilayas.some((wilaya) => wilaya.id === wilayaId);
    if (!selectedWilayaExists) {
      return Response.json({ error: "Selected wilaya does not exist in ticket data." }, { status: 400 });
    }

    const report = await buildReport(month, wilayaId);
    return Response.json({ filters, report });
  } catch (err) {
    return Response.json({ error: err.message || "Something went wrong" }, { status: 500 });
  }
}