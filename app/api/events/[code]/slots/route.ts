import { getDb, type EventRow, type ParticipantRow } from "@/lib/db";
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

  const participantId = body.participant_id;
  const date = body.date;
  const free = body.free;
  if (!Number.isInteger(participantId) || typeof date !== "string" || typeof free !== "boolean") {
    return NextResponse.json({ error: "Invalid participant, date, or availability." }, { status: 400 });
  }

  const db = getDb();
  const event = db.prepare("SELECT * FROM events WHERE code = ?").get(code) as EventRow | undefined;
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const participant = db
    .prepare("SELECT * FROM participants WHERE id = ? AND event_id = ?")
    .get(participantId, event.id) as ParticipantRow | undefined;
  if (!participant) {
    return NextResponse.json({ error: "Participant does not belong to this event." }, { status: 400 });
  }
  if (!isValidISO(date) || date < event.start_date || date > event.end_date) {
    return NextResponse.json({ error: "Date is outside this event's range." }, { status: 400 });
  }

  if (free) {
    db.prepare("INSERT INTO slots (participant_id, date) VALUES (?, ?) ON CONFLICT(participant_id, date) DO NOTHING").run(
      participantId,
      date,
    );
  } else {
    db.prepare("DELETE FROM slots WHERE participant_id = ? AND date = ?").run(participantId, date);
  }

  return NextResponse.json({ ok: true });
}
