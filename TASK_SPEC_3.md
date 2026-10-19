# TASK SPEC 3 — "Let's Hang" leave-board feature

You are the coding agent again. The app is live and working (see `git log`; TASK_SPEC.md and
TASK_SPEC_2.md describe the base + identity system). Do not modify: lib/db.ts, lib/dates.ts,
lib/avatars.ts, lib/identity.ts, app/layout.tsx, app/globals.css, Docker/compose files,
package*.json, tsconfig, next.config.ts, postcss, eslint, any TASK_SPEC*.md.

## Goal

People can only "leave" a board today by editing their name — they should be able to actually
LEAVE (remove their participant row server-side), and ghost boards that no longer exist on the
server should be removable from the device. Three deliverables:

1. **Leave board** on the event page (destructive, confirmed via a modal).
2. **Remove from device** on the "board doesn't exist" card.
3. **Remove chip** on each card in the home page's "Your boards" list.

Destructive actions use a confirmation modal (NOT window.confirm/alert). The modal pattern to
follow: React state holds "confirmation open"; the modal ONLY sets/clears that state and all
logic (API call + local cleanup) lives in the handler the confirm button invokes; the modal
closes on backdrop click, on Escape, and on completion; inner card stops propagation. LIGHT
THEME adaptation: backdrop `bg-zinc-900/40 backdrop-blur-sm`, inner card
`bg-white border border-zinc-200 rounded-2xl shadow-lg max-w-sm w-full p-6 text-center`,
danger icon circle `bg-red-500/10` with a small inline-SVG trash icon (`text-red-500`),
headline `text-lg font-semibold text-zinc-900`, body `text-sm text-zinc-600 mb-6`,
Cancel `flex-1` BTN_SECONDARY, confirm `flex-1 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-full`.
**No animation/transition classes anywhere** (the reference example's `transition-colors` is
FORBIDDEN here). Reuse existing style constants; all text buttons stay same-size.

## 1. Server: app/api/events/[code]/leave/route.ts (NEW)

POST; body `{"participant_id": number, "secret": string}`.
Order of checks: bad types → 400 "Invalid participant or identity."; unknown event → 404
"Event not found"; participant not on this event → 400 "Participant does not belong to this
event."; `secretsMatch(participant.secret, body.secret)` false → 401 "Your identity for this
board doesn't match."; then `DELETE FROM participants WHERE id = ?` (slots cascade via foreign
keys — verify the connection has foreign_keys ON, it does via lib/db.ts). Response
`{"ok": true}`. The freed name becomes joinable again by design.

## 2. Event page: Leave board (EventClient.tsx)

- In the identity branch of the "mine" tab, next to "Not you?" and "Copy my link", add a text
  button **"Leave board"** (`px-4 py-2 text-sm text-zinc-500 rounded-full hover:bg-zinc-100`).
- Click → opens the light confirmation modal described above:
  - Headline: `Leave "<title>"?` (title from event state)
  - Body: `Your marked days will be removed from this board and your name becomes available
    again to others. You can always rejoin later and start fresh.`
  - Cancel button label `Cancel`, confirm button label `Leave board`.
- Escape key closes the modal while open (attach a keydown listener when open, remove on close —
  remember cleanup in useEffect per React rules).
- Confirm handler `doLeave()`:
  - POST /api/events/<code>/leave with the current identity's participant_id + secret
  - On success (status ok): remove `hang:<code>` from localStorage AND remove the board from
    the `hang:boards` list (dedupe by code, newest first — the home page pattern), then clear
    identity in EventClient state/refs (clearIdentity()), keep the user on the page — the
    JoinCard branch will appear since identity is now null. Clear both modal state and any
    pending-forget state.
  - On failure: close the modal, set slotError to "Couldn't leave the board. Try again."
- Guard: only render "Leave board" when identity exists.

## 3. Event page: board-doesn't-exist card

The server component currently renders a friendly CARD ("This board doesn't exist." + home
link) for unknown codes. Refactor: create a small client component
`app/e/[code]/NotFoundActions.tsx` (props: `code: string`) that
- on mount knows nothing server-side; clicking its button **"Remove from this device"**
  (BTN_PRIMARY) removes `hang:<lowercased code>` and the matching `hang:boards` entry, then
  `router.push("/")`.
- Keep the existing home link as a secondary (BTN_SECONDARY "← Home") beside it inside the card,
  both in a `flex flex-wrap gap-2`. Wire <NotFoundActions code={...} /> into that card.

## 4. Home page: per-board Remove chip (page.tsx)

- Each "Your boards" card gets an always-visible **"Remove"** text control (button,
  `px-2 py-2 text-sm text-zinc-400 rounded-full hover:bg-zinc-100 hover:text-red-600`), placed
  after the existing "Open" pill in the card's right-side cluster (wrap the right side in
  `flex items-center gap-2` so Open + Remove sit together; keep min-w-0 truncate on the text
  block).
- Two-tap confirm, same mechanics as "Not you?": first click sets that card's pending state
  (label becomes `Remove?` — render in red `text-red-600`), auto-reverts after 5s via timeout
  (store per-card timeout in a ref map or single state object; cleanup timeouts on unmount
  like forgetTimerRef does). Second click within the window executes:
  remove the board entry from `hang:boards`, AND remove `hang:<code>` identity if it exists,
  update the boards state (the card disappears).
- One card's pending state at a time is fine (single state {code, timer}).
- Layout must not shift badly on mobile: cards wrap buttons with flex-wrap if needed.

## Smoke tests (after `npm run build` exits 0)

Server on port 2199 as before. Show outputs:

1. curl: create event; capture creator identity. join "Bob" (capture Bob identity) → toggle a
   slot for Bob (with secret, must return ok).
2. `POST .../leave` Bob with WRONG secret → 401. Correct secret → `{"ok":true}`.
3. GET event → participants contain only the creator; then rejoin "Bob" → NEW participant_id
   (proves name freed).
4. Playwright on the live build:
   - board page (seeded identity): click "Leave board" → modal visible;
     click Cancel → modal gone + "Copy my link" still present (identity intact);
     click "Leave board" again → confirm "Leave board" → JoinCard becomes visible
     ("Who are you?") and a GET shows zero participants
   - home page: seed `hang:boards` = [{code:"zzzzz9",title:"Ghost board"},{code:<demo>,title:<demo title>}]
     → first Remove click shows "Remove?" (identity of ghost ALSO has hang:zzzzz9 seeded) → second
     click → ghost card gone, demo card still there, localStorage list updated
   - goto /e/zzzzz9 → "This board doesn't exist." card with "Remove from this device" → click →
     URL becomes "/" 
5. Cleanup: delete ONLY the demo event (leave DB with 0 events), kill server.

## Finish

1. `npm run build` exit 0 (last ~10 lines).
2. Smoke outputs pasted.
3. `git add -A && git commit -m "feat: leave board, ghost-board cleanup"` — report hash.
4. Server stopped, DB empty, nothing outside the repo.