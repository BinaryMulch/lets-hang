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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Number.isInteger(body.participant_id) || typeof body.secret !== "string") {
    return NextResponse.json({ error: "Invalid participant or secret." }, { status: 400 });
  }

  const db = getDb();
  const event = db.prepare("SELECT * FROM events WHERE code = ?").get(code) as EventRow | undefined;
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const participant = db
    .prepare("SELECT * FROM participants WHERE id = ? AND event_id = ?")
    .get(body.participant_id, event.id) as ParticipantRow | undefined;
  if (!secretsMatch(participant?.secret, body.secret)) {
    return NextResponse.json(
      { error: "This identity link doesn't work for this board." },
      { status: 401 },
    );
  }

  return NextResponse.json({
    participant_id: participant.id,
    name: participant.name,
    color: participant.color,
  });
}
