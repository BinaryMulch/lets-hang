import { getDb, type EventRow } from "@/lib/db";
import { fmtRange } from "@/lib/dates";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const alt = "Let's Hang board";

export default async function OgImage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = rawCode.toLowerCase();
  const row = getDb().prepare("SELECT * FROM events WHERE code = ?").get(code) as EventRow | undefined;

  const title = (row?.title ?? "Let's Hang").slice(0, 80);
  const subtitle = row
    ? `Looking for a day everyone's free between ${fmtRange(row.start_date, row.end_date)}`
    : "Find a day when everyone's free";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #f5f3ff 0%, #ffffff 45%, #fffbeb 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "28px",
              background: "linear-gradient(135deg, #7c3aed, #d946ef, #f59e0b)",
            }}
          />
          <div style={{ fontSize: 34, fontWeight: 700, color: "#7c3aed", letterSpacing: "-0.5px" }}>
            {"Let's Hang"}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: "#18181b", lineHeight: 1.05, maxWidth: "1020px" }}>
          {title}
        </div>
        <div style={{ display: "flex", marginTop: "30px", fontSize: 40, color: "#3f3f46", maxWidth: "1020px" }}>
          {subtitle}
        </div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 30, color: "#a1a1aa" }}>
          {"Everyone taps the days that work — we find the overlap."}
        </div>
      </div>
    ),
    size,
  );
}