# TASK SPEC 2 — "Let's Hang" identity upgrade

You are the coding agent again. The board app from TASK_SPEC.md is live and committed in this repo
(see `git log`). The operator has ALREADY changed `lib/db.ts`: `participants` now has
`secret TEXT NOT NULL DEFAULT ''` and `color TEXT NOT NULL DEFAULT ''` columns (idempotent ALTER
migrations included). The database has ZERO rows. Do not modify `lib/db.ts` (immutable), and do
not modify `lib/dates.ts`, `app/layout.tsx`, `app/globals.css`, or any infra/Docker file.

## Goal

Make identity real without accounts. Three changes:

1. **Per-person edit secret.** Every participant gets a random secret at join/create time, stored
   server-side. All mutations (`slots`, `pick`) must present a matching secret or fail 401.
   Server never hands secrets back after the initial issue.
2. **Personal identity link.** `/e/<code>?i=<participant_id>.<secret>` pasted in any browser
   restores that person's editing identity there. The event page consumes and immediately strips
   the param (replaceState). A "Copy my link" button builds it from the stored identity.
3. **Avatar colors.** Each participant gets a color from a fixed palette at join time. Colored
   dots appear on participant chips, results "who's free" lists, and the per-person summary.
   Joining a name that already exists now returns **409** (the old auto-merge is gone).

## New files

### lib/avatars.ts (client-safe, no imports)

```ts
export const AVATAR_KEYS = ["violet","rose","amber","emerald","sky","fuchsia","orange","teal","indigo","lime"] as const;
export type AvatarKey = (typeof AVATAR_KEYS)[number];
export function pickColor(existingCount: number): AvatarKey {
  return AVATAR_KEYS[existingCount % AVATAR_KEYS.length];
}
export const AVATAR_DOT: Record<AvatarKey, string> = {
  violet: "bg-violet-500", rose: "bg-rose-500", amber: "bg-amber-400", emerald: "bg-emerald-500",
  sky: "bg-sky-500", fuchsia: "bg-fuchsia-500", orange: "bg-orange-500", teal: "bg-teal-500",
  indigo: "bg-indigo-500", lime: "bg-lime-500",
};
export function dotClass(key: string | undefined | null): string {
  return AVATAR_DOT[(key ?? "") as AvatarKey] ?? "bg-zinc-300";
}
```

Class strings MUST stay literal (Tailwind never compiles `bg-${key}-500`).

### lib/identity.ts (server-only; imports node:crypto)

```ts
import { randomBytes, timingSafeEqual } from "node:crypto";

export function makeSecret(): string {
  return randomBytes(32).toString("base64url"); // 43 chars
}

export function secretsMatch(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length !== a.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

### app/api/events/[code]/verify/route.ts

POST. Body `{"participant_id": number, "secret": string}`. 400 on bad types. Load event by code
(404 unknown), load participant by id + event_id, `secretsMatch(participant?.secret, body.secret)`
→ else 401 `{"error": "This identity link doesn't work for this board."}`. Success 200:
`{"participant_id": N, "name": "...", "color": "violet"}`.

## API changes (keep every other rule from TASK_SPEC.md intact)

- `POST /api/events` — create: also generate the creator's secret (`makeSecret()`) and color
  (`pickColor(0)` — count participants of the NEW event before insert, which is 0). Response adds
  `"secret": "..."` and each participant object carries `"color"`. Never include secrets in any
  GET response, ever.
- `GET /api/events/[code]` — participants become
  `{"id","name","color","slots":[...]}` (same ordering; no secret).
- `POST /api/events/[code]/join` — REWRITE: look up existing name (COLLATE NOCASE) FIRST; if
  found → **409** `{"error": "That name has already joined this board. Open your personal link
  from a device where you joined, or pick a different name."}`. Else create with fresh
  secret + `pickColor(existingParticipantCount)`. Response 200:
  `{"participant_id","name","color","secret"}`.
- `POST /api/events/[code]/slots` — body gains `"secret": string`. Validate order: types (400) →
  event exists (404) → participant belongs (400) → date valid/in-range (400) →
  `secretsMatch(participant.secret, body.secret)` (401
  `{"error": "Your identity for this board doesn't match."}`). Then insert/delete as before.
- `POST /api/events/[code]/pick` — body gains `"secret"`. The secret must match ANY participant
  of the event (loop through participants, secretsMatch on each; ≤ small groups). 401 otherwise,
  same error message. Date validation unchanged.
- All routes keep ES imports only, `await ctx.params`, `Number(lastInsertRowid)`.

## Client changes

Identity type everywhere: `{ participant_id: number; name: string; secret: string }`.
localStorage key `hang:<code>` — on EventClient mount, if a saved value has no truthy `secret`,
delete the key and ignore it (defensive legacy cleanup).

`app/e/[code]/EventClient.tsx` mount effect (the existing 0ms `setTimeout` one):
1. First: read `window.location.search`. If `i=` param present and matches
   `/^(\d+)\.([A-Za-z0-9_-]{40,})$/`, call `POST /api/events/<code>/verify`. On 200 → save
   identity to localStorage and set state. On failure → ignore.
2. ALWAYS (success or fail, verify attempted or not): strip the `i=` param via
   `window.history.replaceState({}, "", window.location.pathname)` — the stored identity is the
   durable copy; URLs must not retain secrets.
3. Then read localStorage as today.

Also in EventClient:
- Add a **"Copy my link"** pill (BTN_SECONDARY, same size rules) in the chips row after
  "Not you?": builds
  `${window.location.origin}/e/${code}?i=${participant_id}.${secret}`, `navigator.clipboard`
  write, label flips to "Copied!" (mirror the share-row Copy behavior).
- "Not you?" becomes two-tap: first click sets label "Forget this identity?" for 5 seconds
  (a `setTimeout` reverts it to "Not you?"); a second click within that window calls
  clearIdentity(). No `confirm()` dialogs.
- `postSlot` must inspect the response: `if (!response.ok)` throw an Error with a `.status`
  field; in `toggleDate`/`setAllDays` catch blocks, if status === 401 → `clearIdentity()` and set
  slotError to "Your identity doesn't match this board anymore — rejoin with your personal link
  or a new name." Otherwise the existing revert-and-error behavior.
- Avatar dots: in the participant chips row, prefix each name (own included) with
  `<span className={\`inline-block h-2 w-2 rounded-full ${dotClass(color)}\`} />` (inside the
  chip, own chip gets the dot too); "you" suffix stays.

`app/e/[code]/ResultsBoard.tsx`:
- Per-person summary rows: name prefixed with the avatar dot.
- Replace the joined `names.join(", ")` line in Best days rows with a wrapped list:
  `flex flex-wrap gap-x-3 gap-y-1` of `<span className="inline-flex items-center gap-1 text-sm text-zinc-500"><dot/><span>{name}</span></span>`.
  Drop the `truncate` on that container (wraps now).

`app/e/[code]/JoinCard.tsx`: under the button row add
`<p className="text-sm text-zinc-500">Joined before on another device? Open your personal link — otherwise use a new name.</p>`.

`app/page.tsx` (create flow): identity written to `hang:<code>` becomes
`{ participant_id, name, secret }` (secret from the create response).

Style rules from TASK_SPEC.md remain fully in force (same CARD/BTN/INPUT constants, no
animations, identical max-w, mobile-safe). No `alert()`/`confirm()`.

## Smoke tests (after `npm run build` exits 0)

Start on port 2199 as before, run and SHOW outputs:

1. create → capture `event.code`, `participant_id`, `secret`
2. `POST join {"name":"<creator name in weird caps>"}` → expect **409**
3. `POST join {"name":"Alex"}` → capture Alex `participant_id`, `secret`, `color`
4. `POST join {"name":"Sam"}` → capture color (expect the NEXT palette key after Alex's)
5. `POST slots {participant_id: <creator>, date: in-range, free: true}` WITHOUT secret → **401**
6. `POST slots {..., secret: "wrong".repeat(...)}` → **401**
7. `POST slots {..., secret: <real>}` → `{"ok":true}` → slot toggle
8. `POST verify {participant_id: <Alex id>, secret: <Alex secret>}` → 200 + color;
   with wrong secret → 401
9. `POST pick {date: <in-range>, secret: <Alex secret>}` → ok (any participant may lock);
   GET shows picked_date
10. GET full → confirm NO `secret` key anywhere in the response JSON (assert with grep)
11. Cleanup: delete the test event(s) + kill the server (DB must be left with 0 events)

## Finish

1. `npm run build` exit 0 (last ~10 lines as evidence)
2. Smoke test outputs pasted
3. `git add -A && git commit -m "feat: per-person identity — secrets, personal links, avatar colors"` — report hash
4. Server stopped, DB empty, nothing outside the repo touched.