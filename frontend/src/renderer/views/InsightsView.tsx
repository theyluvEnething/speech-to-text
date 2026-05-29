import React, { useMemo, useState } from "react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { WV_CARD, WV_TITLE } from "@/styles/theme";

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/* Gauge: a 180° arc; `pct` (0–1) fills from the left. */
function Gauge({ pct, label, value }: { pct: number; label: string; value: string }) {
  const cx = 84, cy = 94, r = 70;
  const start = Math.PI;                     // 180°
  const end = Math.PI - Math.min(1, pct) * Math.PI;
  const x = cx + r * Math.cos(end);
  const y = cy - r * Math.sin(end);
  const large = pct > 0.5 ? 1 : 0;
  return (
    <div className="flex flex-col items-center mt-1">
      <svg width="168" height="98" viewBox="0 0 168 98">
        <path d="M14 94 A70 70 0 0 1 154 94" fill="none" stroke="var(--chart-track)" strokeWidth="15" strokeLinecap="round" />
        <path d={`M14 94 A70 70 0 ${large} 1 ${x.toFixed(1)} ${y.toFixed(1)}`} fill="none" stroke="var(--data-high)" strokeWidth="15" strokeLinecap="round" />
      </svg>
      <div className="-mt-11 text-center">
        <div className="text-[11.5px] text-ink-3">{label}</div>
        <div className="font-display text-[20px] font-semibold text-ink">{value}</div>
      </div>
    </div>
  );
}

function StatCard({ value, cap, children }: { value: React.ReactNode; cap: string; children?: React.ReactNode }) {
  return (
    <div className={cn(WV_CARD, "p-5")}>
      <div className="font-display text-[32px] font-semibold tracking-[-0.02em] text-ink">{value}</div>
      <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink-4 mt-0.5">{cap}</div>
      {children}
    </div>
  );
}

const BAR_TONE = ["bg-data-high", "bg-data-mid", "bg-data-low", "bg-data-faint"];

function InsightsView(): React.ReactElement {
  const conversations = useStore((s) => s.conversations);
  const profiles = useStore((s) => s.profiles);
  const [tab, setTab] = useState<"usage" | "voice">("usage");

  const totalWords = useMemo(() => conversations.reduce((n, c) => n + wordCount(c.text), 0), [conversations]);
  const totalSec = useMemo(() => conversations.reduce((n, c) => n + c.durationSec, 0), [conversations]);
  const avgWpm = totalSec > 0 ? Math.round((totalWords / totalSec) * 60) : 0;

  // breakdown by profile
  const breakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of conversations) counts.set(c.profileId, (counts.get(c.profileId) ?? 0) + 1);
    const total = conversations.length || 1;
    return [...counts.entries()]
      .map(([id, count]) => {
        const p = profiles.find((pr) => pr.id === id);
        return { name: p?.name ?? "Unknown", icon: p?.icon ?? "🎙️", count, pct: Math.round((count / total) * 100) };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [conversations, profiles]);

  // heatmap: last 182 days (26 weeks)
  const heat = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const c of conversations) {
      const d = new Date(c.createdAt);
      byDay.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, (byDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) ?? 0) + 1);
    }
    const cells: number[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 182 - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      cells.push(byDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) ?? 0);
    }
    return cells;
  }, [conversations]);

  const heatShade = (n: number) =>
    n === 0 ? "bg-heat-empty" : n === 1 ? "bg-data-faint" : n <= 3 ? "bg-data-low" : n <= 6 ? "bg-data-mid" : "bg-data-high";

  const wpmPct = Math.min(1, avgWpm / 300); // 300 wpm = full gauge

  return (
    <div>
      <h1 className={cn(WV_TITLE, "mb-[18px]")}>Insights</h1>

      <div className="flex gap-6 border-b border-line mb-6">
        {(["usage", "voice"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "py-2.5 text-[14px] font-semibold capitalize -mb-px border-b-[2.5px] transition-colors",
              tab === t ? "text-ink border-acc-strong" : "text-ink-3 border-transparent",
            )}
          >
            {t === "usage" ? "Your Usage" : "Your Voice"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-4 mb-4">
        <div className={cn(WV_CARD, "p-5")}>
          <Gauge pct={wpmPct} label="Words/min" value={String(avgWpm)} />
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink-4 text-center mt-2.5">Average speaking speed</div>
        </div>
        <StatCard value={conversations.length} cap="Total transcriptions">
          <div className="border-t border-line-soft mt-3.5 pt-3.5 text-[12.5px] text-ink-2">{Math.round(totalSec)}s recorded</div>
        </StatCard>
        <StatCard value={totalWords} cap="Total words dictated">
          <div className="border-t border-line-soft mt-3.5 pt-3.5 text-[12.5px] text-ink-2 flex justify-between items-center">
            <span>🖥️ Desktop · {totalWords} words</span>
          </div>
        </StatCard>
      </div>

      <div className="grid grid-cols-[1fr_1.2fr] gap-4">
        <div className={cn(WV_CARD, "p-5")}>
          <div className="flex justify-between items-baseline mb-4">
            <span className="font-display text-[18px] font-medium text-ink">Usage by profile</span>
            <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink-4">{conversations.length} total</span>
          </div>
          {breakdown.length === 0 ? (
            <p className="text-[12.5px] text-ink-3">No data yet.</p>
          ) : breakdown.map((b, i) => (
            <div key={b.name} className="flex items-center gap-2.5 mb-2.5">
              <span className="w-5 text-center text-[14px]">{b.icon}</span>
              <div className="flex-1 h-6 rounded-lg bg-chart-track overflow-hidden relative">
                <div className={cn("absolute inset-y-0 left-0 rounded-lg flex items-center pl-2.5 text-[11.5px] font-semibold text-color-palette-50", BAR_TONE[i])} style={{ width: `${Math.max(b.pct, 8)}%` }}>{b.pct}%</div>
              </div>
              <span className="text-[12px] text-ink-3 w-[120px] truncate">{b.name}</span>
            </div>
          ))}
        </div>

        <div className={cn(WV_CARD, "p-5")}>
          <div className="flex justify-between items-baseline mb-1">
            <span className="font-display text-[18px] font-medium text-ink">Activity</span>
            <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink-4">last 26 weeks</span>
          </div>
          <div className="grid grid-cols-[repeat(26,1fr)] gap-[3px] mt-3">
            {heat.map((n, i) => <span key={i} className={cn("rounded-[3px] aspect-square", heatShade(n))} />)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-ink-4 mt-2.5">
            Less
            <span className="w-2.5 h-2.5 rounded-[2.5px] bg-heat-empty" />
            <span className="w-2.5 h-2.5 rounded-[2.5px] bg-data-faint" />
            <span className="w-2.5 h-2.5 rounded-[2.5px] bg-data-low" />
            <span className="w-2.5 h-2.5 rounded-[2.5px] bg-data-mid" />
            <span className="w-2.5 h-2.5 rounded-[2.5px] bg-data-high" />
            More
          </div>
        </div>
      </div>
    </div>
  );
}

export default InsightsView;
