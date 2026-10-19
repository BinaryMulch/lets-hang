import { getDb, type EventRow, type ParticipantRow } from "@/lib/db";
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
    body = {};
  }

  const participantId = body.participant_id;
  if (!Number.isInteger(participantId) || typeof body.secret !== "string") {
    return NextResponse.json({ error: "Invalid participant or identity." }, { status: 400 });
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
  if (!secretsMatch(participant.secret, body.secret)) {
    return NextResponse.json({ error: "Your identity for this board doesn't match." }, { status: 401 });
  }

  db.prepare("DELETE FROM participants WHERE id = ?").run(participantId);
  return NextResponse.json({ ok: true });
}
