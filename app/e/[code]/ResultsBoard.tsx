"use client";

import { useState } from "react";
import { daysInRange, fmtDay, monthGrids, parseISO } from "@/lib/dates";
import type { EventData, ParticipantData } from "./EventClient";

const CARD = "bg-white/70 backdrop-blur-md border border-white/70 shadow-sm rounded-2xl";
const BTN_PRIMARY = "px-4 py-2 text-sm font-medium rounded-full bg-violet-600 text-white hover:bg-violet-700";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type ResultsBoardProps = {
  event: EventData;
  participants: ParticipantData[];
  participantId: number | null;
  onPick: (date: string) => Promise<void>;
};

export default function ResultsBoard({ event, participants, participantId, onPick }: ResultsBoardProps) {
  const [locking, setLocking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const total = participants.length;
  const availability = new Map<string, ParticipantData[]>();

  for (const date of daysInRange(event.start_date, event.end_date)) {
    availability.set(date, participants.filter((participant) => participant.slots.includes(date)));
  }

  const bestDays = Array.from(availability.entries())
    .filter(([, free]) => free.length > 0)
    .sort(([dateA, freeA], [dateB, freeB]) => {
      const allA = total > 0 && freeA.length === total;
      const allB = total > 0 && freeB.length === total;
      if (allA !== allB) return allA ? -1 : 1;
      return freeB.length - freeA.length || dateA.localeCompare(dateB);
    });

  async function lockDate(date: string) {
    setLocking(date);
    setError("");
    try {
      await onPick(date);
    } catch {
      setError("Couldn't lock that date. Try again.");
    } finally {
      setLocking(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {monthGrids(event.start_date, event.end_date).map((month) => (
          <section className={`${CARD} p-4`} key={month.label}>
            <h3 className="mb-3 text-sm font-semibold">{month.label}</h3>
            <div className="grid grid-cols-7 gap-1 md:gap-1.5">
              {WEEKDAYS.map((day) => (
                <div className="pb-1 text-center text-[10px] uppercase tracking-wider text-zinc-400" key={day}>{day}</div>
              ))}
              {month.days.flat().map((cell, index) => {
                if (!cell.date) return <div className="h-10 md:h-12" key={`filler-${index}`} />;
                const freeN = availability.get(cell.date)?.length || 0;
                const everyone = total > 0 && freeN === total;
                const color = everyone
                  ? "bg-emerald-500 text-white font-semibold"
                  : freeN > 0
                    ? "bg-amber-200 text-amber-900"
                    : "bg-white/50 text-zinc-400";
                return (
                  <div
                    className={`h-10 md:h-12 rounded-xl flex flex-col items-center justify-center text-xs md:text-sm ${color} ${cell.inRange ? "" : "opacity-30"}`}
                    key={cell.date}
                    title={fmtDay(cell.date)}
                  >
                    <span>{parseISO(cell.date).getDate()}</span>
                    {cell.inRange && freeN > 0 && <span className="text-[10px] leading-none">{freeN}</span>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-zinc-600">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-500" />Everyone</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-200" />Some</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-white/70 border border-zinc-200" />None</span>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Best days</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className={`${CARD} divide-y divide-zinc-200/70`}>
          {bestDays.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">No availability yet. Ask everyone to add their days.</p>
          ) : (
            bestDays.map(([date, free]) => {
              const everyone = total > 0 && free.length === total;
              const locked = event.picked_date === date;
              return (
                <div className="flex flex-wrap items-center gap-3 p-4" key={date}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{fmtDay(date)}</p>
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-600">{free.length} of {total} free</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-zinc-500">{free.map((participant) => participant.name).join(", ")}</p>
                  </div>
                  {locked ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">Locked</span>
                  ) : everyone && !event.picked_date ? (
                    <button className={BTN_PRIMARY} disabled={locking === date} onClick={() => void lockDate(date)} type="button">
                      {locking === date ? "Locking…" : "Lock date"}
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Everyone</h2>
        <div className={`${CARD} divide-y divide-zinc-200/70`}>
          {participants.map((participant) => (
            <div className="flex items-center justify-between gap-3 p-4" key={participant.id}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{participant.name}</span>
                {participant.id === participantId && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">you</span>}
              </div>
              <span className="shrink-0 text-sm text-zinc-500">days free: {participant.slots.length}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
