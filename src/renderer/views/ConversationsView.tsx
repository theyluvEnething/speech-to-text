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
        "group rounded-lg border border-border/60 transition-colors",
        expanded ? "bg-card" : "hover:bg-card/50",
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-3 w-full px-3 py-3 text-left"
      >
        <span
          className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
          style={{ backgroundColor: profileColor }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-foreground leading-snug truncate">
            {conversation.text}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-muted-foreground">
              {profileIcon} {profileName}
            </span>
            <span className="text-[11px] text-muted-foreground/70">·</span>
            <span className="text-[11px] text-muted-foreground/70">
              {formatDuration(conversation.durationSec)}
            </span>
            <span className="text-[11px] text-muted-foreground/70">·</span>
            <span className="text-[11px] text-muted-foreground/70">
              {formatTime(conversation.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <span className="text-muted-foreground/50 ml-1">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-border/40 mx-3">
          <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap mt-3">
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
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium text-foreground mb-1">No conversations yet</h3>
        <p className="text-[13px] text-muted-foreground max-w-xs">
          Hold your push-to-talk key to start your first transcription.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
          Conversations
        </h2>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transcripts…"
          className="pl-9"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            No transcripts match your search.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2 px-1">
                {group.label}
              </h3>
              <div className="space-y-1">
                {group.conversations.map((c) => {
                  const profile = profileMap.get(c.profileId);
                  return (
                    <ConversationRow
                      key={c.id}
                      conversation={c}
                      profileColor={profile?.color ?? "#6c5ce7"}
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
