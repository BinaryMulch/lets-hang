export type MonthGrid = {
  label: string;
  days: { date: string | null; inRange: boolean }[][];
};

export function parseISO(s: string): Date {
  const [year, month, day] = s.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDaysISO(s: string, n: number): string {
  const date = parseISO(s);
  date.setDate(date.getDate() + n);
  return toISO(date);
}

export function daysBetween(startISO: string, endISO: string): number {
  if (endISO < startISO) return 0;

  let count = 0;
  let current = startISO;
  while (current <= endISO) {
    count += 1;
    current = addDaysISO(current, 1);
  }
  return count;
}

export function daysInRange(startISO: string, endISO: string): string[] {
  const days: string[] = [];
  if (endISO < startISO) return days;

  for (let current = startISO; current <= endISO; current = addDaysISO(current, 1)) {
    days.push(current);
  }
  return days;
}

export function fmtDay(s: string): string {
  return parseISO(s).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function fmtRange(startISO: string, endISO: string): string {
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  const differentYears = start.getFullYear() !== end.getFullYear();
  const options: Intl.DateTimeFormatOptions = {
    month: differentYears ? "long" : "short",
    day: "numeric",
    ...(differentYears ? { year: "numeric" } : {}),
  };

  return `${start.toLocaleDateString("en-US", options)} – ${end.toLocaleDateString("en-US", options)}`;
}

export function monthGrids(startISO: string, endISO: string): MonthGrid[] {
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  const grids: MonthGrid[] = [];

  for (
    let month = new Date(start.getFullYear(), start.getMonth(), 1);
    month <= end;
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  ) {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstWeekday = month.getDay();
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const cells: { date: string | null; inRange: boolean }[] = [];

    for (let index = 0; index < firstWeekday; index += 1) {
      cells.push({ date: null, inRange: false });
    }

    for (let day = 1; day <= lastDay; day += 1) {
      const date = toISO(new Date(year, monthIndex, day));
      cells.push({ date, inRange: date >= startISO && date <= endISO });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ date: null, inRange: false });
    }

    const weeks: { date: string | null; inRange: boolean }[][] = [];
    for (let index = 0; index < cells.length; index += 7) {
      weeks.push(cells.slice(index, index + 7));
    }

    grids.push({
      label: month.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      days: weeks,
    });
  }

  return grids;
}

export function isValidISO(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const date = parseISO(s);
  return !Number.isNaN(date.getTime()) && toISO(date) === s;
}
