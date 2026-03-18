import { supabase } from "@/lib/supabase";
import { getToken } from "next-auth/jwt";

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const isValidMonthKey = (value) => /^\d{4}-\d{2}$/.test(String(value || ""));

const getMonthLabel = (monthKey) => {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return "";
  }

  return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
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

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const buildFilters = async () => {
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("date")
    .order("date", { ascending: false });

  if (error) {
    throw error;
  }

  const months = [];
  const seen = new Set();

  for (const ticket of tickets || []) {
    const monthKey = String(ticket?.date || "").slice(0, 7);
    if (isValidMonthKey(monthKey) && !seen.has(monthKey)) {
      seen.add(monthKey);
      months.push({ value: monthKey, label: getMonthLabel(monthKey) });
    }
  }

  return { months };
};

const buildSummary = async (monthKey) => {
  const { start, end } = getMonthRange(monthKey);

  const { data: tickets, error: ticketsError } = await supabase
    .from("tickets")
    .select("date, surface, wilaya_id")
    .gte("date", start)
    .lt("date", end)
    .order("date", { ascending: true })
    .order("wilaya_id", { ascending: true });

  if (ticketsError) {
    throw ticketsError;
  }

  const surfaceIds = Array.from(
    new Set((tickets || []).map((ticket) => ticket?.surface).filter((surfaceId) => Number.isInteger(surfaceId)))
  );
  const wilayaIds = Array.from(
    new Set((tickets || []).map((ticket) => ticket?.wilaya_id).filter((wilayaId) => Number.isInteger(wilayaId)))
  );

  const surfacesById = new Map();
  if (surfaceIds.length > 0) {
    const { data: surfaces, error: surfacesError } = await supabase
      .from("surfaces")
      .select("id, price")
      .in("id", surfaceIds);

    if (surfacesError) {
      throw surfacesError;
    }

    for (const surface of surfaces || []) {
      surfacesById.set(surface.id, surface);
    }
  }

  let wilayas = [];
  if (wilayaIds.length > 0) {
    const { data: wilayaRows, error: wilayasError } = await supabase
      .from("wilayas")
      .select("id, name")
      .in("id", wilayaIds);

    if (wilayasError) {
      throw wilayasError;
    }

    wilayas = (wilayaRows || [])
      .map((wilaya) => ({
        id: wilaya.id,
        name: String(wilaya.name || `Wilaya ${wilaya.id}`).trim() || `Wilaya ${wilaya.id}`,
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "fr", { sensitivity: "base" }));
  }

  const rowsByDate = new Map();
  const subtotalsByWilaya = Object.fromEntries(wilayas.map((wilaya) => [String(wilaya.id), 0]));

  for (const ticket of tickets || []) {
    if (!Number.isInteger(ticket?.wilaya_id)) {
      continue;
    }

    const amount = roundMoney(surfacesById.get(ticket.surface)?.price || 0);
    const wilayaKey = String(ticket.wilaya_id);

    if (!rowsByDate.has(ticket.date)) {
      rowsByDate.set(ticket.date, {
        date: ticket.date,
        displayDate: formatDateLabel(ticket.date),
        amountsByWilaya: {},
      });
    }

    const row = rowsByDate.get(ticket.date);
    row.amountsByWilaya[wilayaKey] = roundMoney((row.amountsByWilaya[wilayaKey] || 0) + amount);
    subtotalsByWilaya[wilayaKey] = roundMoney((subtotalsByWilaya[wilayaKey] || 0) + amount);
  }

  const rows = Array.from(rowsByDate.values());
  const totalGeneral = roundMoney(
    Object.values(subtotalsByWilaya).reduce((sum, amount) => sum + Number(amount || 0), 0)
  );
  const commissionAnep = roundMoney(totalGeneral * 0.3);
  const montantHt = roundMoney(totalGeneral - commissionAnep);
  const montantTva = roundMoney(montantHt * 0.19);
  const ttc = roundMoney(montantHt + montantTva);

  return {
    month: { value: monthKey, label: getMonthLabel(monthKey) },
    wilayas,
    rows,
    subtotalsByWilaya,
    totalGeneral,
    commissionAnep,
    montantHt,
    montantTva,
    ttc,
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

    if (!month) {
      return Response.json({ filters, summary: null });
    }

    if (!isValidMonthKey(month)) {
      return Response.json({ error: "A valid month is required." }, { status: 400 });
    }

    const summary = await buildSummary(month);
    return Response.json({ filters, summary });
  } catch (err) {
    return Response.json({ error: err.message || "Something went wrong" }, { status: 500 });
  }
}