# TASK SPEC 4 — "Let's Hang" copy-flash + clearer identity copy

You are the coding agent again. App live; see `git log` + TASK_SPEC/2/3 for context. Do not
modify: lib/db.ts, lib/dates.ts, lib/avatars.ts, lib/identity.ts, app/globals.css, app/layout.tsx,
Docker/compose, package*.json, other configs, TASK_SPEC*.md.

`app/globals.css` now defines (operator-added, immutable):
```css
@keyframes copy-pop { 0% { transform: scale(1); } 40% { transform: scale(0.94); } 100% { transform: scale(1); } }
.copy-pop { animation: copy-pop 0.3s ease-out 1; }
```
This is the ONLY animation allowed in the app (explicit user request). Do not add any other
transition/animate/keyframe classes — the no-ambient-animation rule is still in force everywhere
else. hover:bg color changes remain the only hover effect.

## 1. Click-flash on BOTH copy buttons

Create `app/e/[code]/CopyFlash.tsx` — a reusable client component used for both the share-row
"Copy" and the identity "Copy my link":

```tsx
type CopyFlashProps = {
  label: string;
  copiedLabel: string;      // e.g. "Copied!"
  perform: () => Promise<boolean>;  // returns true when clipboard write succeeded
};
```

Behavior:
- On click: `const ok = await perform()`. false → do nothing (the existing catch behavior of
  resetting the label lives inside the EventClient `perform` implementations — keep them).
- On ok: enter "copied" state:
  - label becomes `copiedLabel`
  - base classes swap to `px-4 py-2 text-sm font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100`
  - add the class `copy-pop` ONCE per acknowledged click.
- After 2000 ms the copied state fully reverts (label back to `label`, base classes back to
  `px-4 py-2 text-sm font-medium rounded-full bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-100`
  — i.e. BTN_SECONDARY — and share-row Copy reverts to BTN_PRIMARY violet instead: accept a
  `baseClassName` prop so each usage keeps its own resting class, e.g. BTN_PRIMARY for share,
  BTN_SECONDARY for personal link. Include `key` prop passthrough not needed).
- Rapid re-click while copied: perform again and RE-TRIGGER the pop: set the pop class off, then
  on in the next frame (`requestAnimationFrame`), then schedule its removal at ~350 ms. Do NOT
  rely on onAnimationEnd (known pitfall: class re-add fails; timers must be managed in state +
  refs). All timeouts cleaned up on unmount.
- CopyFlash renders `<button type="button" disabled={busy}` — no disabled prop needed; keep it
  simple: `<button type="button" className={...} onClick={handler}>{label shown}</button>`.
- aria: keep an `aria-live="polite"` on the button so the copied label is announced.

Wire in EventClient:
- share row: `<CopyFlash label="Copy" copiedLabel="Copied!" baseClassName={BTN_PRIMARY} perform={copyLinkAsBool} />`
  — refactor `copyLink` to return boolean (clipboard write resolved → true; caught → set copy
  state back if you kept it — actually remove `copyLabel`/`personalCopyLabel` state from
  EventClient; CopyFlash owns its labels now).
- identity row: same with label "Copy my link", BTN_SECONDARY base, perform wraps
  `copyPersonalLink` (returns bool).
- Delete the now-unused `copyLabel`/`personalCopyLabel`/`setCopyLabel`/`setPersonalCopyLabel`
  state and their branches.

## 2. Clearer identity explanation line

Replace the tip under the participant chips in the identity branch of EventClient with:

```
Your editing access lives only in this browser — copy your personal link and open it on another
device to edit this board there. Anyone with that link edits as you, so treat it like a key.
```

Render as `<p className="text-sm text-zinc-600 leading-relaxed max-w-prose">` — first sentence on
its own line, second after a `<br />`? Keep one paragraph, no span highlighting needed. Same
placement as now (after chips row, above quick actions). JoinCard's line stays unchanged.

## Smoke tests (after `npm run build` exit 0; server on 2199)

Playwright, seeded identity + a demo event:
1. Click share-row Copy → within ~150 ms the button contains class `copy-pop` AND label is
   "Copied!" AND computed background contains rgb(239, 246, 255)-ish green (assert classList has
   `bg-emerald-50`); clipboard content still exactly the share URL.
2. After 2.4 s: label back to "Copy", no `copy-pop`, violet classes restored.
3. Click "Copy my link" → same checks with the personal-link URL; after 2.4 s fully reverted.
4. Rapid double-click on share Copy (two clicks <40 ms apart): final label "Copied!", clipboard
   valid, no error; wait 2.4 s → fully reverted (proves timer cleanup with re-trigger).
5. New identity-tip line visible: `get_by_text("treat it like a key")` count == 1.
6. Cleanup: delete ONLY the demo event (guard any unknown codes), kill server, DB 0 events.

## Finish

1. `npm run build` exit 0 (last ~10 lines).
2. Smoke outputs pasted.
3. `git add -A && git commit -m "feat: copy flash + explicit identity-key copy"` — report hash.
4. Server stopped, DB empty.