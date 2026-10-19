import type { Metadata } from "next";
import { headers } from "next/headers";
import { getDb, type EventRow, type ParticipantRow, type SlotRow } from "@/lib/db";
import { daysBetween, fmtRange } from "@/lib/dates";
import EventClient, { type EventData, type ParticipantData } from "./EventClient";
import NotFoundActions from "./NotFoundActions";

const CARD = "bg-white/70 backdrop-blur-md border border-white/70 shadow-sm rounded-2xl";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code: rawCode } = await params;
  const code = rawCode.toLowerCase();
  const row = getDb().prepare("SELECT * FROM events WHERE code = ?").get(code) as EventRow | undefined;
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;

  if (!row) {
    return {
      metadataBase: new URL(base),
      title: "Board not found — Let's Hang",
      description: "Check the link, or head home to create a new board.",
    };
  }

  const range = fmtRange(row.start_date, row.end_date);
  const days = daysBetween(row.start_date, row.end_date);
  const title = `${row.title} — Let's Hang`;
  const description = `Happening sometime across ${range} (${days} days). Add your name, tap the days that work, and pick one where everyone's free.`;

  return {
    metadataBase: new URL(base),
    title,
    description,
    openGraph: {
      title,
      description: `${row.title}: looking for a day everyone's free between ${range}. Tap your days — let's lock one in.`,
      url: `${base}/e/${code}`,
      siteName: "Let's Hang",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function EventPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = rawCode.toLowerCase();
  const db = getDb();
  const row = db.prepare("SELECT * FROM events WHERE code = ?").get(code) as EventRow | undefined;

  if (!row) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <section className={`${CARD} p-6 space-y-4`}>
          <h1 className="text-2xl font-bold">This board doesn&apos;t exist.</h1>
          <p className="text-zinc-600">Check the link, or head home to create a new board.</p>
          <NotFoundActions code={code} />
        </section>
      </main>
    );
  }

  const participantRows = db
    .prepare("SELECT * FROM participants WHERE event_id = ? ORDER BY name COLLATE NOCASE ASC")
    .all(row.id) as ParticipantRow[];
  const slotRows = db
    .prepare(
      `SELECT slots.* FROM slots
       JOIN participants ON participants.id = slots.participant_id
       WHERE participants.event_id = ?
       ORDER BY slots.date ASC`,
    )
    .all(row.id) as SlotRow[];

  const event: EventData = {
    code: row.code,
    title: row.title,
    start_date: row.start_date,
    end_date: row.end_date,
    picked_date: row.picked_date,
  };
  const participants: ParticipantData[] = participantRows.map((participant) => ({
    id: participant.id,
    name: participant.name,
    color: participant.color,
    slots: slotRows.filter((slot) => slot.participant_id === participant.id).map((slot) => slot.date),
  }));

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <EventClient initialEvent={event} initialParticipants={participants} />
    </main>
  );
}
