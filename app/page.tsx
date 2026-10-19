"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { addDaysISO, todayISO } from "@/lib/dates";

const CARD = "bg-white/70 backdrop-blur-md border border-white/70 shadow-sm rounded-2xl";
const BTN_PRIMARY = "px-4 py-2 text-sm font-medium rounded-full bg-violet-600 text-white hover:bg-violet-700";
const BTN_SECONDARY = "px-4 py-2 text-sm font-medium rounded-full bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-100";
const INPUT = "w-full rounded-xl border border-zinc-300 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400";

type SavedBoard = { code: string; title: string };
type Identity = { participant_id: number; name: string; secret: string };

function saveBoard(board: SavedBoard) {
  const current = JSON.parse(localStorage.getItem("hang:boards") || "[]") as SavedBoard[];
  const next = [board, ...current.filter((item) => item.code !== board.code)];
  localStorage.setItem("hang:boards", JSON.stringify(next));
}

export default function HomePage() {
  const router = useRouter();
  const initialToday = todayISO();
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(initialToday);
  const [endDate, setEndDate] = useState(addDaysISO(initialToday, 13));
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [joinValue, setJoinValue] = useState("");
  const [joinError, setJoinError] = useState("");
  const [boards, setBoards] = useState<SavedBoard[] | null>(null);
  const [pendingRemoveCode, setPendingRemoveCode] = useState<string | null>(null);
  const removeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("hang:boards") || "[]") as SavedBoard[];
        setBoards(Array.isArray(saved) ? saved : []);
      } catch {
        setBoards([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => () => {
    if (removeTimerRef.current !== null) window.clearTimeout(removeTimerRef.current);
  }, []);

  function setQuickRange(days: number) {
    const today = todayISO();
    setStartDate(today);
    setEndDate(addDaysISO(today, days - 1));
  }

  async function createBoard(event: FormEvent) {
    event.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, name, start_date: startDate, end_date: endDate }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't create the board.");

      const code = String(data.event.code).toLowerCase();
      const identity: Identity = {
        participant_id: Number(data.participant_id),
        name: name.trim(),
        secret: String(data.secret),
      };
      localStorage.setItem(
        `hang:${code}`,
        JSON.stringify(identity),
      );
      saveBoard({ code, title: data.event.title });
      router.push(`/e/${code}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Couldn't create the board.");
      setCreating(false);
    }
  }

  function openBoard(event: FormEvent) {
    event.preventDefault();
    const value = joinValue.trim();
    const urlMatch = value.match(/\/e\/([a-z2-9]{5,10})(?:[/?#]|$)/i);
    const codeMatch = value.match(/^([a-z2-9]{5,10})$/i);
    const code = (urlMatch?.[1] || codeMatch?.[1])?.toLowerCase();
    if (!code) {
      setJoinError("Couldn't find a code in that link.");
      return;
    }
    setJoinError("");
    router.push(`/e/${code}`);
  }

  function requestRemoveBoard(code: string) {
    if (pendingRemoveCode === code) {
      if (removeTimerRef.current !== null) {
        window.clearTimeout(removeTimerRef.current);
        removeTimerRef.current = null;
      }
      const next = (boards || []).filter((board) => board.code !== code);
      localStorage.setItem("hang:boards", JSON.stringify(next));
      localStorage.removeItem(`hang:${code}`);
      setBoards(next);
      setPendingRemoveCode(null);
      return;
    }

    if (removeTimerRef.current !== null) window.clearTimeout(removeTimerRef.current);
    setPendingRemoveCode(code);
    removeTimerRef.current = window.setTimeout(() => {
      setPendingRemoveCode(null);
      removeTimerRef.current = null;
    }, 5000);
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent text-4xl font-extrabold">
          Let&apos;s Hang
        </h1>
        <p className="text-zinc-600">Find a day when everyone&apos;s free.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <form className={`${CARD} p-5 space-y-4`} onSubmit={createBoard}>
          <div>
            <h2 className="text-xl font-bold">Create a board</h2>
            <p className="mt-1 text-sm text-zinc-500">Pick a date range and invite your friends.</p>
          </div>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Title</span>
            <input
              className={INPUT}
              maxLength={80}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Saturday hangout"
              required
              value={title}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Your name</span>
            <input
              className={INPUT}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              required
              value={name}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Start date</span>
              <input className={INPUT} onChange={(event) => setStartDate(event.target.value)} required type="date" value={startDate} />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>End date</span>
              <input className={INPUT} onChange={(event) => setEndDate(event.target.value)} required type="date" value={endDate} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Quick date ranges">
            {[7, 14, 30].map((days) => (
              <button className={BTN_SECONDARY} key={days} onClick={() => setQuickRange(days)} type="button">
                Next {days} days
              </button>
            ))}
          </div>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <button className={BTN_PRIMARY} disabled={creating} type="submit">
            {creating ? "Creating…" : "Create board"}
          </button>
        </form>

        <form className={`${CARD} p-5 space-y-4 self-start`} onSubmit={openBoard}>
          <div>
            <h2 className="text-xl font-bold">Join a board</h2>
            <p className="mt-1 text-sm text-zinc-500">Open a link a friend shared with you.</p>
          </div>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Board link or code</span>
            <input
              className={INPUT}
              onChange={(event) => setJoinValue(event.target.value)}
              placeholder="Paste a board link or code"
              value={joinValue}
            />
          </label>
          {joinError && <p className="text-sm text-red-600">{joinError}</p>}
          <button className={BTN_PRIMARY} type="submit">Open board</button>
        </form>
      </div>

      {boards && boards.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Your boards</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <article className={`${CARD} p-4 flex flex-wrap items-center justify-between gap-3`} key={board.code}>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{board.title}</h3>
                  <code className="mt-1 inline-block rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-500">/e/{board.code}</code>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link className={BTN_SECONDARY} href={`/e/${board.code}`}>Open</Link>
                  <button
                    className={`px-2 py-2 text-sm rounded-full hover:bg-zinc-100 ${pendingRemoveCode === board.code ? "text-red-600" : "text-zinc-400 hover:text-red-600"}`}
                    onClick={() => requestRemoveBoard(board.code)}
                    type="button"
                  >
                    {pendingRemoveCode === board.code ? "Remove?" : "Remove"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
