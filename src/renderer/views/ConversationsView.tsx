import React, { useState, useMemo } from "react";
import { Search, Copy, Trash2, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Group {
  label: string;
  conversations: Conversation[];
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function groupConversations(conversations: Conversation[]): Group[] {
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

  for (const c of conversations) {
    const d = new Date(c.createdAt);
    if (d >= today) {
      groups[0]!.conversations.push(c);
    } else if (d >= yesterday) {
      groups[1]!.conversations.push(c);
    } else if (d >= weekAgo) {
      groups[2]!.conversations.push(c);
    } else {
      groups[3]!.conversations.push(c);
    }
  }

  return groups.filter((g) => g.conversations.length > 0);
}

function ConversationRow({
  conversation,
  profileColor,
  profileIcon,
  profileName,
  onDelete,
}: {
  conversation: Conversation;
  profileColor: string;
  profileIcon: string;
  profileName: string;
  onDelete: () => void;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  function handleCopy(): void {
    navigator.clipboard.writeText(conversation.text).then(() => {
      toast("Copied to clipboard");
    });
  }

  return (
    <div
      className={cn(
        "group rounded-lg border border-border transition-colors duration-150",
        expanded ? "bg-[#1A1B1E] border-border" : "bg-muted hover:bg-[#1A1B1E] hover:border-border",
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-3 w-full px-3.5 py-3 text-left"
      >
        <span
          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
          style={{ backgroundColor: profileColor }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-foreground/92 leading-snug truncate tracking-[-0.01em]">
            {conversation.text}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[12px] text-foreground/45">
              {profileIcon} {profileName}
            </span>
            <span className="text-[12px] text-foreground/25">·</span>
            <span className="text-[12px] text-foreground/45">
              {formatDuration(conversation.durationSec)}
            </span>
            <span className="text-[12px] text-foreground/25">·</span>
            <span className="text-[12px] text-foreground/45">
              {formatTime(conversation.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            className="p-1.5 rounded hover:bg-accent text-foreground/45 hover:text-foreground/70"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded hover:bg-accent text-foreground/45 hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <span className="text-foreground/30 ml-1">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-3.5 pb-3 pt-0 border-t border-border mx-3.5">
          <p className="text-[13px] text-foreground/70 leading-relaxed whitespace-pre-wrap mt-3">
            {conversation.text}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationsView(): React.ReactElement {
  const conversations = useStore((s) => s.conversations);
  const profiles = useStore((s) => s.profiles);
  const setConversations = useStore((s) => s.setConversations);

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => c.text.toLowerCase().includes(q));
  }, [conversations, search]);

  const groups = useMemo(() => groupConversations(filtered), [filtered]);

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const p of profiles) map.set(p.id, p);
    return map;
  }, [profiles]);

  function handleDelete(id: string): void {
    window.wavely.conversations.delete(id).then((result) => {
      setConversations(result as Conversation[]);
      toast("Conversation deleted");
    });
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="w-12 h-12 rounded-full bg-input flex items-center justify-center mb-4">
          <MessageSquare className="h-6 w-6 text-foreground/25" />
        </div>
        <h3 className="text-[14px] font-medium text-foreground/92 mb-1 tracking-[-0.01em]">No conversations yet</h3>
        <p className="text-[13px] text-foreground/45 max-w-xs">
          Hold your push-to-talk key to start your first transcription.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-foreground/98">
          Conversations
        </h2>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/25" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transcripts…"
          className="pl-9"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-center text-[13px] text-foreground/45 py-12">
            No transcripts match your search.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-6">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.04em] text-foreground/40 mb-2 px-1">
                {group.label}
              </h3>
              <div className="space-y-1">
                {group.conversations.map((c) => {
                  const profile = profileMap.get(c.profileId);
                  return (
                    <ConversationRow
                      key={c.id}
                      conversation={c}
                      profileColor={profile?.color ?? "#888888"}
                      profileIcon={profile?.icon ?? "🎙️"}
                      profileName={profile?.name ?? "Default"}
                      onDelete={() => handleDelete(c.id)}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ConversationsView;
