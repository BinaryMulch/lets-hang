"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const BTN_PRIMARY = "px-4 py-2 text-sm font-medium rounded-full bg-violet-600 text-white hover:bg-violet-700";
const BTN_SECONDARY = "px-4 py-2 text-sm font-medium rounded-full bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-100";

type SavedBoard = { code: string; title: string };

export default function NotFoundActions({ code }: { code: string }) {
  const router = useRouter();

  function removeFromDevice() {
    const normalizedCode = code.toLowerCase();
    localStorage.removeItem(`hang:${normalizedCode}`);
    try {
      const saved = JSON.parse(localStorage.getItem("hang:boards") || "[]") as SavedBoard[];
      const next = Array.isArray(saved)
        ? saved.filter((board) => board && typeof board.code === "string" && board.code.toLowerCase() !== normalizedCode)
        : [];
      localStorage.setItem("hang:boards", JSON.stringify(next));
    } catch {
      localStorage.setItem("hang:boards", "[]");
    }
    router.push("/");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link className={BTN_SECONDARY} href="/">← Home</Link>
      <button className={BTN_PRIMARY} onClick={removeFromDevice} type="button">Remove from this device</button>
    </div>
  );
}
