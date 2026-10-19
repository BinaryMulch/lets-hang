import { getDb, type EventRow, type ParticipantRow } from "@/lib/db";
import { isValidISO } from "@/lib/dates";
import { secretsMatch } from "@/lib/identity";
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

  const participants = db
    .prepare("SELECT * FROM participants WHERE event_id = ?")
    .all(event.id) as ParticipantRow[];
  if (!participants.some((participant) => secretsMatch(participant.secret, body.secret))) {
    return NextResponse.json({ error: "Your identity for this board doesn't match." }, { status: 401 });
  }

  db.prepare("UPDATE events SET picked_date = ? WHERE id = ?").run(date, event.id);
  return NextResponse.json({ ok: true, picked_date: date });
}
