"use client";

import { useEffect, useRef, useState } from "react";

const COPIED_CLASS_NAME = "px-4 py-2 text-sm font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 active:bg-emerald-200";
const FAILED_CLASS_NAME = "px-4 py-2 text-sm font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 active:bg-amber-200";

type CopyFlashProps = {
  label: string;
  copiedLabel: string;
  baseClassName: string;
  activeClassName: string;
  perform: () => Promise<boolean>;
};

export default function CopyFlash({ label, copiedLabel, baseClassName, activeClassName, perform }: CopyFlashProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [popping, setPopping] = useState(false);
  const revertTimerRef = useRef<number | null>(null);
  const popTimerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (revertTimerRef.current !== null) window.clearTimeout(revertTimerRef.current);
    if (popTimerRef.current !== null) window.clearTimeout(popTimerRef.current);
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
  }, []);

  function clearTimers() {
    if (revertTimerRef.current !== null) {
      window.clearTimeout(revertTimerRef.current);
      revertTimerRef.current = null;
    }
    if (popTimerRef.current !== null) {
      window.clearTimeout(popTimerRef.current);
      popTimerRef.current = null;
    }
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  function startPop() {
    setPopping(false);
    animationFrameRef.current = window.requestAnimationFrame(() => {
      setPopping(true);
      animationFrameRef.current = null;
      popTimerRef.current = window.setTimeout(() => {
        setPopping(false);
        popTimerRef.current = null;
      }, 350);
    });
  }

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    clearTimers();
    startPop(); // click feedback fires immediately, never waiting on the clipboard
    const ok = await perform();
    setBusy(false);
    if (ok) {
      setFailed(false);
      setCopied(true);
      revertTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        revertTimerRef.current = null;
      }, 2000);
    } else {
      setCopied(false);
      setFailed(true);
      revertTimerRef.current = window.setTimeout(() => {
        setFailed(false);
        revertTimerRef.current = null;
      }, 2000);
    }
  }

  const className = `${copied ? COPIED_CLASS_NAME : failed ? FAILED_CLASS_NAME : baseClassName}${popping ? " copy-pop" : ""} ${activeClassName}`;

  return (
    <button
      aria-live="polite"
      className={className}
      disabled={busy}
      onClick={() => void handleClick()}
      type="button"
    >
      {copied ? copiedLabel : failed ? "Copy failed" : label}
    </button>
  );
}