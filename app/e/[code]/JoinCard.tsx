"use client";

import { FormEvent, useState } from "react";

const CARD = "bg-white/70 backdrop-blur-md border border-white/70 shadow-sm rounded-2xl";
const BTN_PRIMARY = "px-4 py-2 text-sm font-medium rounded-full bg-violet-600 text-white hover:bg-violet-700";
const INPUT = "w-full rounded-xl border border-zinc-300 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400";

type SavedBoard = { code: string; title: string };

type JoinCardProps = {
  code: string;
  title: string;
  onJoined: (participantId: number, name: string) => void;
};

export default function JoinCard({ code, title, onJoined }: JoinCardProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  async function join(event: FormEvent) {
    event.preventDefault();
    setError("");
    setJoining(true);
    try {
      const response = await fetch(`/api/events/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't join the board.");

      const identity = { participant_id: Number(data.participant_id), name: String(data.name) };
      localStorage.setItem(`hang:${code}`, JSON.stringify(identity));
      let boards: SavedBoard[] = [];
      try {
        const saved = JSON.parse(localStorage.getItem("hang:boards") || "[]") as SavedBoard[];
        boards = Array.isArray(saved) ? saved : [];
      } catch {
        boards = [];
      }
      localStorage.setItem(
        "hang:boards",
        JSON.stringify([{ code, title }, ...boards.filter((board) => board.code !== code)]),
      );
      onJoined(identity.participant_id, identity.name);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Couldn't join the board.");
      setJoining(false);
    }
  }

  return (
    <form className={`${CARD} p-5 space-y-4`} onSubmit={join}>
      <div>
        <h2 className="text-xl font-bold">Who are you?</h2>
        <p className="mt-1 text-sm text-zinc-500">Add your name to mark the days that work.</p>
      </div>
      <input
        className={INPUT}
        maxLength={40}
        onChange={(event) => setName(event.target.value)}
        placeholder="Your name"
        required
        value={name}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className={BTN_PRIMARY} disabled={joining} type="submit">
          {joining ? "Joining…" : "Join board"}
        </button>
        <p className="text-sm text-zinc-500">You&apos;ll be able to change your days anytime.</p>
      </div>
    </form>
  );
}
