import React, { useState, useMemo } from "react";
import { Search, Copy, Trash2, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@clerk/clerk-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import ProfileIcon from "@/components/ProfileIcon";
import {
  WV_CARD, WV_INPUT, WV_SECTION_LABEL, WV_STAT_NUMBER, WV_BUTTON_SOFT,
} from "@/styles/theme";
import HotkeyChip from "@/components/HotkeyChip";

interface Group { label: string; conversations: Conversation[]; }

const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const formatDuration = (sec: number) =>
  sec < 60 ? `${Math.round(sec)}s` : `${Math.floor(sec / 60)}:${Math.round(sec % 60).toString().padStart(2, "0")}`;
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function groupConversations(list: Conversation[]): Group[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const groups: Group[] = [
    { label: "Today", conversations: [] },
    { label: "Yesterday", conversations: [] },
    { label: "This week", conversations: [] },
    { label: "Earlier", conversations: [] },
  ];
  for (const c of list) {
    const d = new Date(c.createdAt);
    if (d >= today) groups[0]!.conversations.push(c);
    else if (d >= yesterday) groups[1]!.conversations.push(c);
    else if (d >= weekAgo) groups[2]!.conversations.push(c);
    else groups[3]!.conversations.push(c);
  }
  return groups.filter((g) => g.conversations.length > 0);
}

function ConversationRow({
  c, color, icon, name, onDelete,
}: { c: Conversation; color: string; icon: string; name: string; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const copy = () => navigator.clipboard.writeText(c.text).then(() => toast("Copied to clipboard"));
  return (
    <div className="group border-b border-line-soft last:border-b-0">
      <button onClick={() => setExpanded(!expanded)} className="flex gap-3.5 w-full px-4 py-3.5 text-left hover:bg-hover transition-colors">
        <span className="text-[12px] text-ink-4 w-[60px] shrink-0 pt-0.5">{formatTime(c.createdAt)}</span>
        <div className="flex-1 min-w-0">
          <p className={cn("text-[13.5px] font-medium text-ink leading-snug", !expanded && "truncate")}>{c.text}</p>
          <div className="flex items-center gap-2 mt-1.5 text-[11.5px] text-ink-4">
            <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: color }} />
            <ProfileIcon icon={icon} className="text-[11px]" /> {name}
            <span>·</span> {formatDuration(c.durationSec)}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); copy(); }} className="p-1.5 rounded hover:bg-raised text-ink-3 hover:text-ink"><Copy className="h-3.5 w-3.5" /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded hover:bg-raised text-ink-3 hover:text-ink"><Trash2 className="h-3.5 w-3.5" /></button>
          <span className="text-ink-4 ml-0.5">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
        </div>
      </button>
    </div>
  );
}

function RailCard({ children }: { children: React.ReactNode }) {
  return <div className={cn(WV_CARD, "p-5")}>{children}</div>;
}

function ConversationsView(): React.ReactElement {
  const conversations = useStore((s) => s.conversations);
  const profiles = useStore((s) => s.profiles);
  const setConversations = useStore((s) => s.setConversations);
  const { user } = useUser();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => c.text.toLowerCase().includes(q));
  }, [conversations, search]);

  const groups = useMemo(() => groupConversations(filtered), [filtered]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const totalWords = useMemo(() => conversations.reduce((n, c) => n + wordCount(c.text), 0), [conversations]);
  const avgWpm = useMemo(() => {
    const totalSec = conversations.reduce((n, c) => n + c.durationSec, 0);
    return totalSec > 0 ? Math.round((totalWords / totalSec) * 60) : 0;
  }, [conversations, totalWords]);
  const todayCount = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return conversations.filter((c) => c.createdAt >= start.getTime()).length;
  }, [conversations]);

  const handleDelete = (id: string) =>
    window.wavely.conversations.delete(id).then((r) => {
      setConversations(r as Conversation[]);
      toast("Conversation deleted");
    });

  const firstName = user?.firstName ?? "there";

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="w-12 h-12 rounded-full bg-input grid place-items-center mb-4">
          <MessageSquare className="h-6 w-6 text-ink-4" />
        </div>
        <h3 className="text-[14px] font-medium text-ink mb-1">No conversations yet</h3>
        <p className="text-[13px] text-ink-3 max-w-xs">Hold your push-to-talk key to start your first transcription.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-[22px] text-[22px] font-semibold text-ink">
        <span>Hey {firstName}, start recording with</span>
        <HotkeyChip />
      </div>

      {/* hero */}
      <div className="relative rounded-card overflow-hidden h-[200px] mb-7"
        style={{ background: "radial-gradient(110% 80% at 80% 30%, color-mix(in srgb, var(--acc) 35%, transparent), transparent 55%), linear-gradient(130deg, var(--raised) 0%, var(--background) 65%)" }}>
        <div className="relative z-10 p-8 max-w-[58%]">
          <h3 className="font-display text-[28px] font-medium text-ink mb-1.5">Try Wavely anywhere you type</h3>
          <p className="text-[13.5px] text-ink-3 mb-[18px]">Hold your push-to-talk key, speak, release — done.</p>
          <button className="inline-flex items-center justify-center gap-2 rounded-[11px] bg-amber-accent-500 text-amber-accent-100 font-semibold text-[12.5px] px-4 py-2.5 transition-opacity hover:opacity-90 disabled:opacity-50">Get started</button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_290px] gap-6 items-start">
        <div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-4" />
            <input className={cn(WV_INPUT, "pl-9")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transcripts…" />
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-ink-3 py-12">No transcripts match your search.</p>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="mb-6">
                <p className={cn(WV_SECTION_LABEL, "mb-2.5 px-1")}>{g.label}</p>
                <div className="border border-line rounded-card bg-surface overflow-hidden">
                  {g.conversations.map((c) => {
                    const p = profileMap.get(c.profileId);
                    return (
                      <ConversationRow key={c.id} c={c} color={p?.color ?? "var(--acc)"} icon={p?.icon ?? "🎙️"} name={p?.name ?? "Default"} onDelete={() => handleDelete(c.id)} />
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* right rail */}
        <div className="flex flex-col gap-3.5">
          <RailCard>
            <div className="flex items-baseline"><span className={WV_STAT_NUMBER}>{totalWords}</span><span className="text-[12px] text-ink-3 ml-2">total words</span></div>
            <div className="flex items-baseline mt-1"><span className={WV_STAT_NUMBER}>{avgWpm}</span><span className="text-[12px] text-ink-3 ml-2">avg wpm</span></div>
            <div className="flex items-baseline mt-1"><span className={WV_STAT_NUMBER}>{todayCount}</span><span className="text-[12px] text-ink-3 ml-2">today</span></div>
          </RailCard>
          <RailCard>
            <div className="text-[13px] font-semibold text-ink mb-0.5">Your Voice Profile</div>
            <p className="text-[11.5px] text-ink-2 leading-[1.5] mb-2.5">Discover how you use your voice.</p>
            <div className="h-1.5 rounded-full bg-chart-track overflow-hidden"><div className="h-full rounded-full bg-acc" style={{ width: `${Math.min(100, (totalWords / 2000) * 100)}%` }} /></div>
            <div className="flex justify-end text-[11px] text-ink-4 mt-1.5">{Math.max(0, 2000 - totalWords)} words to unlock</div>
          </RailCard>
          <RailCard>
            <div className="text-[13px] font-semibold text-ink mb-0.5">100 Words a Day</div>
            <p className="text-[11.5px] text-ink-2 leading-[1.5] mb-2.5">Earn an extra day of Pro.</p>
            <div className="h-1.5 rounded-full bg-chart-track overflow-hidden"><div className="h-full rounded-full bg-data-mid" style={{ width: `${Math.min(100, todayCount * 10)}%` }} /></div>
          </RailCard>
        </div>
      </div>
    </div>
  );
}

export default ConversationsView;
