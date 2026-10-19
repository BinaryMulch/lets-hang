"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { dotClass } from "@/lib/avatars";
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

export type ParticipantData = { id: number; name: string; color: string; slots: string[] };
export type Identity = { participant_id: number; name: string; secret: string };

type EventClientProps = {
  initialEvent: EventData;
  initialParticipants: ParticipantData[];
};

export default function EventClient({ initialEvent, initialParticipants }: EventClientProps) {
  const code = initialEvent.code.toLowerCase();
  const [event, setEvent] = useState(initialEvent);
  const [participants, setParticipants] = useState(initialParticipants);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [tab, setTab] = useState<"mine" | "results">("mine");
  const [shareUrl, setShareUrl] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [personalCopyLabel, setPersonalCopyLabel] = useState("Copy my link");
  const [forgetPending, setForgetPending] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const inFlightRef = useRef(0);
  const identityRef = useRef<Identity | null>(null);
  const pendingDatesRef = useRef(new Set<string>());
  const forgetTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (inFlightRef.current > 0) return;
    const response = await fetch(`/api/events/${code}`);
    if (!response.ok) return;
    const data = (await response.json()) as { event: EventData; participants: ParticipantData[] };
    setEvent(data.event);
    setParticipants((current) => {
      const ownId = identityRef.current?.participant_id ?? null;
      const localOwn = ownId === null ? undefined : current.find((participant) => participant.id === ownId);
      return data.participants.map((participant) => participant.id === ownId && localOwn ? localOwn : participant);
    });
  }, [code]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const identityParam = new URLSearchParams(window.location.search).get("i");
        const identityMatch = identityParam?.match(/^(\d+)\.([A-Za-z0-9_-]{40,})$/);
        const verification = identityMatch
          ? fetch(`/api/events/${code}/verify`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              participant_id: Number(identityMatch[1]),
              secret: identityMatch[2],
            }),
          })
          : null;
        window.history.replaceState({}, "", window.location.pathname);

        try {
          if (verification && identityMatch) {
            const response = await verification;
            if (response.ok) {
              const data = (await response.json()) as { participant_id: number; name: string; color: string };
              const verifiedIdentity: Identity = {
                participant_id: data.participant_id,
                name: data.name,
                secret: identityMatch[2],
              };
              localStorage.setItem(`hang:${code}`, JSON.stringify(verifiedIdentity));
            }
          }
        } catch {
          // A failed identity link is ignored; an existing saved identity may still be usable.
        }

        setShareUrl(`${window.location.origin}/e/${code}`);
        try {
          const saved = JSON.parse(localStorage.getItem(`hang:${code}`) || "null") as Partial<Identity> | null;
          if (saved && !saved.secret) {
            localStorage.removeItem(`hang:${code}`);
            return;
          }
          if (
            saved
            && Number.isInteger(saved.participant_id)
            && typeof saved.name === "string"
            && typeof saved.secret === "string"
          ) {
            const savedIdentity = saved as Identity;
            identityRef.current = savedIdentity;
            if (!cancelled) setIdentity(savedIdentity);
          }
        } catch {
          localStorage.removeItem(`hang:${code}`);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code]);

  useEffect(() => () => {
    if (forgetTimerRef.current !== null) window.clearTimeout(forgetTimerRef.current);
  }, []);

  const participantId = identity?.participant_id ?? null;
  const ownParticipant = participants.find((participant) => participant.id === participantId);
  const selected = new Set(ownParticipant?.slots || []);

  function replaceOwnSlots(update: (slots: Set<string>) => Set<string>) {
    const ownId = identityRef.current?.participant_id ?? null;
    if (ownId === null) return;
    setParticipants((current) => current.map((participant) => {
      if (participant.id !== ownId) return participant;
      return { ...participant, slots: Array.from(update(new Set(participant.slots))).sort() };
    }));
  }

  async function postSlot(date: string, free: boolean) {
    const currentIdentity = identityRef.current;
    if (!currentIdentity) throw new Error("Join this board first.");
    const response = await fetch(`/api/events/${code}/slots`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        participant_id: currentIdentity.participant_id,
        date,
        free,
        secret: currentIdentity.secret,
      }),
    });
    if (!response.ok) {
      const error = new Error("Couldn't save availability.") as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
  }

  function toggleDate(date: string) {
    if (!identityRef.current || pendingDatesRef.current.has(date)) return;
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
      .catch((error: Error & { status?: number }) => {
        replaceOwnSlots((slots) => {
          if (wasFree) slots.add(date);
          else slots.delete(date);
          return slots;
        });
        if (error.status === 401) {
          clearIdentity();
          setSlotError("Your identity doesn't match this board anymore — rejoin with your personal link or a new name.");
        } else {
          setSlotError("Couldn't save that day. Try again.");
        }
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
      let identityFailed = false;
      for (const date of changed) {
        try {
          await postSlot(date, free);
        } catch (error) {
          if ((error as Error & { status?: number }).status === 401) {
            replaceOwnSlots(() => previous);
            clearIdentity();
            setSlotError("Your identity doesn't match this board anymore — rejoin with your personal link or a new name.");
            identityFailed = true;
            break;
          }
          failed = true;
          replaceOwnSlots((slots) => {
            if (previous.has(date)) slots.add(date);
            else slots.delete(date);
            return slots;
          });
        }
      }
      if (failed && !identityFailed) setSlotError("Some days couldn't be saved. Try again.");
      inFlightRef.current -= 1;
    })();
  }

  function joined(joinedIdentity: Identity, color: string) {
    identityRef.current = joinedIdentity;
    setIdentity(joinedIdentity);
    setParticipants((current) => current.some((participant) => participant.id === joinedIdentity.participant_id)
      ? current
      : [...current, {
        id: joinedIdentity.participant_id,
        name: joinedIdentity.name,
        color,
        slots: [],
      }].sort((a, b) => a.name.localeCompare(b.name)));
    void refresh();
  }

  function clearIdentity() {
    localStorage.removeItem(`hang:${code}`);
    identityRef.current = null;
    setIdentity(null);
    setSlotError("");
    setForgetPending(false);
    if (forgetTimerRef.current !== null) {
      window.clearTimeout(forgetTimerRef.current);
      forgetTimerRef.current = null;
    }
  }

  function requestForgetIdentity() {
    if (forgetPending) {
      clearIdentity();
      return;
    }
    setForgetPending(true);
    forgetTimerRef.current = window.setTimeout(() => {
      setForgetPending(false);
      forgetTimerRef.current = null;
    }, 5000);
  }

  async function manualRefresh() {
    if (refreshing || inFlightRef.current > 0) return;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  async function pickDate(date: string | null) {
    const response = await fetch(`/api/events/${code}/pick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, secret: identityRef.current?.secret ?? "" }),
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

  async function copyPersonalLink() {
    if (!identity) return;
    const personalLink = `${window.location.origin}/e/${code}?i=${identity.participant_id}.${identity.secret}`;
    try {
      await navigator.clipboard.writeText(personalLink);
      setPersonalCopyLabel("Copied!");
    } catch {
      setPersonalCopyLabel("Copy my link");
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Board views">
          <button className={tab === "mine" ? BTN_PRIMARY : BTN_SECONDARY} onClick={() => setTab("mine")} role="tab" type="button">My availability</button>
          <button className={tab === "results" ? BTN_PRIMARY : BTN_SECONDARY} onClick={() => setTab("results")} role="tab" type="button">Group results</button>
        </div>
        <button className={BTN_SECONDARY} disabled={refreshing} onClick={() => void manualRefresh()} type="button">
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {tab === "mine" ? (
        participantId === null || !ownParticipant ? (
          <div className="space-y-4">
            {slotError && <p className="text-sm text-red-600">{slotError}</p>}
            <JoinCard code={code} onJoined={joined} title={event.title} />
          </div>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {participants.map((participant) => participant.id === participantId ? (
                <div className="flex flex-wrap items-center gap-2" key={participant.id}>
                  <span className="px-4 py-2 text-sm font-medium rounded-full bg-violet-600 text-white">
                    <span className={`inline-block h-2 w-2 rounded-full ${dotClass(participant.color)}`} />{" "}
                    {participant.name} <span className="text-xs text-violet-100">you</span>
                  </span>
                  <button className="px-4 py-2 text-sm text-zinc-500 rounded-full hover:bg-zinc-100" onClick={requestForgetIdentity} type="button">
                    {forgetPending ? "Forget this identity?" : "Not you?"}
                  </button>
                  <button className={BTN_SECONDARY} onClick={() => void copyPersonalLink()} type="button">{personalCopyLabel}</button>
                </div>
              ) : (
                <span className={`${BTN_SECONDARY} inline-flex items-center gap-1.5`} key={participant.id}>
                  <span className={`inline-block h-2 w-2 rounded-full ${dotClass(participant.color)}`} />
                  {participant.name}
                </span>
              ))}
            </div>
            <p className="text-sm text-zinc-500">Editing identity lives on this device — <span className="font-medium text-zinc-600">Copy my link</span> carries it to another one.</p>
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
