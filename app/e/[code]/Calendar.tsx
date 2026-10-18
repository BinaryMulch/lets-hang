"use client";

import { fmtDay, monthGrids, parseISO, todayISO } from "@/lib/dates";

const CARD = "bg-white/70 backdrop-blur-md border border-white/70 shadow-sm rounded-2xl";

type CalendarProps = {
  startDate: string;
  endDate: string;
  selected: Set<string>;
  onToggle: (date: string) => void;
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function Calendar({ startDate, endDate, selected, onToggle }: CalendarProps) {
  const today = todayISO();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {monthGrids(startDate, endDate).map((month) => (
        <section className={`${CARD} p-4`} key={month.label}>
          <h3 className="mb-3 text-sm font-semibold">{month.label}</h3>
          <div className="grid grid-cols-7 gap-1 md:gap-1.5">
            {WEEKDAYS.map((day) => (
              <div className="pb-1 text-center text-[10px] uppercase tracking-wider text-zinc-400" key={day}>{day}</div>
            ))}
            {month.days.flat().map((cell, index) => {
              if (!cell.date) return <div className="h-10 md:h-12" key={`filler-${index}`} />;
              const dayNumber = parseISO(cell.date).getDate();
              if (!cell.inRange) {
                return (
                  <div className="h-10 md:h-12 flex items-center justify-center rounded-xl text-xs text-zinc-500 opacity-30 md:text-sm" key={cell.date}>
                    {dayNumber}
                  </div>
                );
              }

              const isSelected = selected.has(cell.date);
              const isToday = cell.date === today;
              return (
                <button
                  className={`h-10 md:h-12 rounded-xl text-xs md:text-sm ${
                    isSelected
                      ? "bg-violet-600 text-white font-semibold"
                      : "bg-white/60 text-zinc-700 hover:bg-violet-100"
                  } ${isToday ? "ring-2 ring-violet-400" : ""}`}
                  key={cell.date}
                  onClick={() => onToggle(cell.date as string)}
                  title={fmtDay(cell.date)}
                  type="button"
                >
                  {dayNumber}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
