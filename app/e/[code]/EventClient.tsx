"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { daysBetween, daysInRange, fmtDay, fmtRange } from "@/lib/dates";
import Calendar from "./Calendar";
import JoinCard from "./JoinCard";
import ResultsBoard from "./ResultsBoard";

const CARD = "bg-white/70 backdrop-blur-md border border-white/70 shadow-sm rounded-2xl";
const BTN_PRIMARY = "px-4 py-2 text-sm font-medium rounded-full bg-violet-600 text-white hover:bg-violet-700";
const BTN_SECONDARY = "px-4 py-2 text-sm font-medium rounded-full bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-100";
const INPUT = "w-full rounded-xl border border-zinc-300 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400";

export type EventData = {
  code: string;
  title: string;
  start_date: string;
  end_date: string;
  picked_date: string | null;
};

export type ParticipantData = { id: number; name: string; slots: string[] };

type EventClientProps = {
  initialEvent: EventData;
  initialParticipants: ParticipantData[];
};

export default function EventClient({ initialEvent, initialParticipants }: EventClientProps) {
  const code = initialEvent.code.toLowerCase();
  const [event, setEvent] = useState(initialEvent);
  const [participants, setParticipants] = useState(initialParticipants);
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [tab, setTab] = useState<"mine" | "results">("mine");
  const [shareUrl, setShareUrl] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [slotError, setSlotError] = useState("");
  const inFlightRef = useRef(0);
  const participantIdRef = useRef<number | null>(null);
  const pendingDatesRef = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    if (inFlightRef.current > 0) return;
    const response = await fetch(`/api/events/${code}`);
    if (!response.ok) return;
    const data = (await response.json()) as { event: EventData; participants: ParticipantData[] };
    setEvent(data.event);
    setParticipants((current) => {
      const ownId = participantIdRef.current;
      const localOwn = ownId === null ? undefined : current.find((participant) => participant.id === ownId);
      return data.participants.map((participant) => participant.id === ownId && localOwn ? localOwn : participant);
    });
  }, [code]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShareUrl(`${window.location.origin}/e/${code}`);
      try {
        const saved = JSON.parse(localStorage.getItem(`hang:${code}`) || "null") as { participant_id?: unknown } | null;
        if (saved && Number.isInteger(saved.participant_id)) {
          const savedId = Number(saved.participant_id);
          participantIdRef.current = savedId;
          setParticipantId(savedId);
        }
      } catch {
        localStorage.removeItem(`hang:${code}`);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [code]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && inFlightRef.current === 0) {
        void refresh();
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const ownParticipant = participants.find((participant) => participant.id === participantId);
  const selected = new Set(ownParticipant?.slots || []);

  function replaceOwnSlots(update: (slots: Set<string>) => Set<string>) {
    const ownId = participantIdRef.current;
    if (ownId === null) return;
    setParticipants((current) => current.map((participant) => {
      if (participant.id !== ownId) return participant;
      return { ...participant, slots: Array.from(update(new Set(participant.slots))).sort() };
    }));
  }

  async function postSlot(date: string, free: boolean) {
    const ownId = participantIdRef.current;
    if (ownId === null) throw new Error("Join this board first.");
    const response = await fetch(`/api/events/${code}/slots`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participant_id: ownId, date, free }),
    });
    if (!response.ok) throw new Error("Couldn't save availability.");
  }

  function toggleDate(date: string) {
    if (participantIdRef.current === null || pendingDatesRef.current.has(date)) return;
    const wasFree = selected.has(date);
    pendingDatesRef.current.add(date);
    inFlightRef.current += 1;
    setSlotError("");
    replaceOwnSlots((slots) => {
      if (wasFree) slots.delete(date);
      else slots.add(date);
      return slots;
    });

    void postSlot(date, !wasFree)
      .catch(() => {
        replaceOwnSlots((slots) => {
          if (wasFree) slots.add(date);
          else slots.delete(date);
          return slots;
        });
        setSlotError("Couldn't save that day. Try again.");
      })
      .finally(() => {
        pendingDatesRef.current.delete(date);
        inFlightRef.current -= 1;
      });
  }

  function setAllDays(free: boolean) {
    if (!ownParticipant || inFlightRef.current > 0) return;
    const allDays = daysInRange(event.start_date, event.end_date);
    const previous = new Set(ownParticipant.slots);
    const changed = allDays.filter((date) => previous.has(date) !== free);
    if (changed.length === 0) return;

    setSlotError("");
    replaceOwnSlots(() => free ? new Set(allDays) : new Set());
    inFlightRef.current += 1;
    void (async () => {
      let failed = false;
      for (const date of changed) {
        try {
          await postSlot(date, free);
        } catch {
          failed = true;
          replaceOwnSlots((slots) => {
            if (previous.has(date)) slots.add(date);
            else slots.delete(date);
            return slots;
          });
        }
      }
      if (failed) setSlotError("Some days couldn't be saved. Try again.");
      inFlightRef.current -= 1;
    })();
  }

  function joined(id: number, name: string) {
    participantIdRef.current = id;
    setParticipantId(id);
    setParticipants((current) => current.some((participant) => participant.id === id)
      ? current
      : [...current, { id, name, slots: [] }].sort((a, b) => a.name.localeCompare(b.name)));
    void refresh();
  }

  function clearIdentity() {
    localStorage.removeItem(`hang:${code}`);
    participantIdRef.current = null;
    setParticipantId(null);
  }

  async function pickDate(date: string | null) {
    const response = await fetch(`/api/events/${code}/pick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date }),
    });
    if (!response.ok) throw new Error("Couldn't update the date.");
    setEvent((current) => ({ ...current, picked_date: date }));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyLabel("Copied!");
    } catch {
      setCopyLabel("Copy");
    }
  }

  return (
    <>
      <header className={`${CARD} p-5 space-y-4`}>
        <Link className="text-sm text-zinc-600 hover:text-violet-700" href="/">← Home</Link>
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">{event.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {fmtRange(event.start_date, event.end_date)} · {daysBetween(event.start_date, event.end_date)} days
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Share link" className={`${INPUT} min-w-0 flex-1`} readOnly value={shareUrl} />
          <button className={BTN_PRIMARY} onClick={() => void copyLink()} type="button">{copyLabel}</button>
        </div>
        {event.picked_date && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 flex items-center gap-2 justify-between">
            <span className="font-medium">It&apos;s happening: {fmtDay(event.picked_date)}</span>
            <button className="px-4 py-2 text-sm font-medium rounded-full hover:bg-emerald-100" onClick={() => void pickDate(null)} type="button">Undo</button>
          </div>
        )}
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Board views">
        <button className={tab === "mine" ? BTN_PRIMARY : BTN_SECONDARY} onClick={() => setTab("mine")} role="tab" type="button">My availability</button>
        <button className={tab === "results" ? BTN_PRIMARY : BTN_SECONDARY} onClick={() => setTab("results")} role="tab" type="button">Group results</button>
      </div>

      {tab === "mine" ? (
        participantId === null || !ownParticipant ? (
          <JoinCard code={code} onJoined={joined} title={event.title} />
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {participants.map((participant) => participant.id === participantId ? (
                <div className="flex items-center gap-2" key={participant.id}>
                  <span className="px-4 py-2 text-sm font-medium rounded-full bg-violet-600 text-white">
                    {participant.name} <span className="text-xs text-violet-100">you</span>
                  </span>
                  <button className="px-4 py-2 text-sm text-zinc-500 rounded-full hover:bg-zinc-100" onClick={clearIdentity} type="button">Not you?</button>
                </div>
              ) : (
                <span className={BTN_SECONDARY} key={participant.id}>{participant.name}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={BTN_SECONDARY} onClick={() => setAllDays(true)} type="button">Fill all days</button>
              <button className={BTN_SECONDARY} onClick={() => setAllDays(false)} type="button">Clear all</button>
            </div>
            {slotError && <p className="text-sm text-red-600">{slotError}</p>}
            <Calendar endDate={event.end_date} onToggle={toggleDate} selected={selected} startDate={event.start_date} />
          </section>
        )
      ) : (
        <ResultsBoard event={event} onPick={(date) => pickDate(date)} participantId={participantId} participants={participants} />
      )}
    </>
  );
}
