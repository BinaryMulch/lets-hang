import { getDb, type EventRow } from "@/lib/db";
import { isValidISO } from "@/lib/dates";
import { NextResponse } from "next/server";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await ctx.params;
  const code = rawCode.toLowerCase();
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const requestedDate = body.date;
  if (requestedDate !== null && typeof requestedDate !== "string") {
    return NextResponse.json({ error: "Date must be a valid date or null." }, { status: 400 });
  }
  const date = requestedDate as string | null;

  const db = getDb();
  const event = db.prepare("SELECT * FROM events WHERE code = ?").get(code) as EventRow | undefined;
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (date !== null && (!isValidISO(date) || date < event.start_date || date > event.end_date)) {
    return NextResponse.json({ error: "Date is outside this event's range." }, { status: 400 });
  }

  db.prepare("UPDATE events SET picked_date = ? WHERE id = ?").run(date, event.id);
  return NextResponse.json({ ok: true, picked_date: date });
}
