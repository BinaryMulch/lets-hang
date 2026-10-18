import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { daysBetween, isValidISO } from "@/lib/dates";
import { NextResponse } from "next/server";

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function makeCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const startDate = typeof body.start_date === "string" ? body.start_date : "";
  const endDate = typeof body.end_date === "string" ? body.end_date : "";

  if (title.length < 1 || title.length > 80) {
    return NextResponse.json({ error: "Title must be between 1 and 80 characters." }, { status: 400 });
  }
  if (name.length < 1 || name.length > 40) {
    return NextResponse.json({ error: "Name must be between 1 and 40 characters." }, { status: 400 });
  }
  if (!isValidISO(startDate) || !isValidISO(endDate)) {
    return NextResponse.json({ error: "Choose valid start and end dates." }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: "End date must be on or after the start date." }, { status: 400 });
  }
  if (daysBetween(startDate, endDate) > 60) {
    return NextResponse.json({ error: "Date range cannot be longer than 60 days." }, { status: 400 });
  }

  const db = getDb();
  const create = db.transaction((code: string) => {
    const eventResult = db
      .prepare("INSERT INTO events (code, title, start_date, end_date) VALUES (?, ?, ?, ?)")
      .run(code, title, startDate, endDate);
    const participantResult = db
      .prepare("INSERT INTO participants (event_id, name) VALUES (?, ?)")
      .run(Number(eventResult.lastInsertRowid), name);
    return Number(participantResult.lastInsertRowid);
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeCode();
    try {
      const participantId = create(code);
      return NextResponse.json({
        event: {
          code,
          title,
          start_date: startDate,
          end_date: endDate,
          picked_date: null,
        },
        participant_id: participantId,
      });
    } catch (error) {
      const sqliteError = error as { code?: string };
      if (sqliteError.code !== "SQLITE_CONSTRAINT_UNIQUE") throw error;
    }
  }

  return NextResponse.json({ error: "Couldn't create a unique board code. Try again." }, { status: 500 });
}
