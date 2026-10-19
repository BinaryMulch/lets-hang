import { getDb, type EventRow, type ParticipantRow, type SlotRow } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await ctx.params;
  const code = rawCode.toLowerCase();
  const db = getDb();
  const event = db.prepare("SELECT * FROM events WHERE code = ?").get(code) as EventRow | undefined;

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const participantRows = db
    .prepare("SELECT * FROM participants WHERE event_id = ? ORDER BY name COLLATE NOCASE ASC")
    .all(event.id) as ParticipantRow[];
  const slotRows = db
    .prepare(
      `SELECT slots.* FROM slots
       JOIN participants ON participants.id = slots.participant_id
       WHERE participants.event_id = ?
       ORDER BY slots.date ASC`,
    )
    .all(event.id) as SlotRow[];

  const participants = participantRows.map((participant) => ({
    id: participant.id,
    name: participant.name,
    color: participant.color,
    slots: slotRows
      .filter((slot) => slot.participant_id === participant.id)
      .map((slot) => slot.date),
  }));

  return NextResponse.json({
    event: {
      code: event.code,
      title: event.title,
      start_date: event.start_date,
      end_date: event.end_date,
      picked_date: event.picked_date,
    },
    participants,
  });
}
