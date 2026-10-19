export const AVATAR_KEYS = ["violet", "rose", "amber", "emerald", "sky", "fuchsia", "orange", "teal", "indigo", "lime"] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

export function pickColor(existingCount: number): AvatarKey {
  return AVATAR_KEYS[existingCount % AVATAR_KEYS.length];
}

export const AVATAR_DOT: Record<AvatarKey, string> = {
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  amber: "bg-amber-400",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  fuchsia: "bg-fuchsia-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
  lime: "bg-lime-500",
};

export function dotClass(key: string | undefined | null): string {
  return AVATAR_DOT[(key ?? "") as AvatarKey] ?? "bg-zinc-300";
}
