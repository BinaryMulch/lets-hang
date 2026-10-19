"use client";

import { useEffect, useRef, useState } from "react";

const COPIED_CLASS_NAME = "px-4 py-2 text-sm font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100";

type CopyFlashProps = {
  label: string;
  copiedLabel: string;
  baseClassName: string;
  perform: () => Promise<boolean>;
};

export default function CopyFlash({ label, copiedLabel, baseClassName, perform }: CopyFlashProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [popping, setPopping] = useState(false);
  const revertTimerRef = useRef<number | null>(null);
  const popTimerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (revertTimerRef.current !== null) window.clearTimeout(revertTimerRef.current);
    if (popTimerRef.current !== null) window.clearTimeout(popTimerRef.current);
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
  }, []);

  async function handleClick() {
    setBusy(true);
    const ok = await perform();
    setBusy(false);
    if (!ok) return;

    if (revertTimerRef.current !== null) window.clearTimeout(revertTimerRef.current);
    if (popTimerRef.current !== null) window.clearTimeout(popTimerRef.current);
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);

    setCopied(true);
    setPopping(false);
    animationFrameRef.current = window.requestAnimationFrame(() => {
      setPopping(true);
      animationFrameRef.current = null;
      popTimerRef.current = window.setTimeout(() => {
        setPopping(false);
        popTimerRef.current = null;
      }, 350);
    });
    revertTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      setPopping(false);
      revertTimerRef.current = null;
    }, 2000);
  }

  return (
    <button
      aria-live="polite"
      className={`${copied ? COPIED_CLASS_NAME : baseClassName}${popping ? " copy-pop" : ""}`}
      disabled={busy}
      onClick={() => void handleClick()}
      type="button"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
