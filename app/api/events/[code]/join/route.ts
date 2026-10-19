import { pickColor } from "@/lib/avatars";
import { getDb, type EventRow, type ParticipantRow } from "@/lib/db";
import { makeSecret } from "@/lib/identity";
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 40) {
    return NextResponse.json({ error: "Name must be between 1 and 40 characters." }, { status: 400 });
  }

  const db = getDb();
  const event = db.prepare("SELECT * FROM events WHERE code = ?").get(code) as EventRow | undefined;
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const existing = db
    .prepare("SELECT * FROM participants WHERE event_id = ? AND name = ? COLLATE NOCASE")
    .get(event.id, name) as ParticipantRow | undefined;
  if (existing) {
    return NextResponse.json(
      { error: "That name has already joined this board. Open your personal sign-in link from a device where you joined, or pick a different name." },
      { status: 409 },
    );
  }

  const participantCount = db
    .prepare("SELECT COUNT(*) AS count FROM participants WHERE event_id = ?")
    .get(event.id) as { count: number };
  const secret = makeSecret();
  const color = pickColor(participantCount.count);
  const result = db
    .prepare("INSERT INTO participants (event_id, name, secret, color) VALUES (?, ?, ?, ?)")
    .run(event.id, name, secret, color);
  return NextResponse.json({ participant_id: Number(result.lastInsertRowid), name, color, secret });
}
