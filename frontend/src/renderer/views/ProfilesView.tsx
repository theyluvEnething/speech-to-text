import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import { toast } from "sonner";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import ProfileIcon from "@/components/ProfileIcon";
import { WV_CARD, WV_TITLE } from "@/styles/theme";

const COLORS = ["#83a9af", "#63949c", "#50767c", "#3c595d", "#a2bfc3", "#c1d4d7", "#283b3e", "#eff4f5"];
const QUICK_ICONS = ["🇬🇧","🇩🇪","🇫🇷","🇪🇸","🇮🇹","🇯🇵","🇰🇷","🇨🇳","🎙️","💼","🏥","🎓","💻","🎨","📝"];
const SENTINEL = "__global__";
const LANGUAGES = [
  { value: SENTINEL, label: "Use global setting" },
  { value: "en", label: "English" }, { value: "de", label: "Deutsch" }, { value: "fr", label: "Français" },
  { value: "es", label: "Español" }, { value: "it", label: "Italiano" }, { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" }, { value: "zh", label: "Chinese" }, { value: "auto", label: "Auto-detect" },
];
const MODELS = [
  { value: SENTINEL, label: "Use global setting" },
  { value: "whisper-large-v3-turbo", label: "whisper-large-v3-turbo" },
  { value: "whisper-large-v3", label: "whisper-large-v3" },
  { value: "nova-2", label: "nova-2" }, { value: "nova-2-general", label: "nova-2-general" },
];

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; const v = c === "x" ? r : (r & 0x3) | 0x8; return v.toString(16);
  });
}

const EMPTY: Profile = { id: "", name: "", color: "#83a9af", icon: "🎙️", systemPrompt: "", language: "", model: "" };

function ProfilesView(): React.ReactElement {
  const profiles = useStore((s) => s.profiles);
  const activeProfile = useStore((s) => s.activeProfile);
  const setProfiles = useStore((s) => s.setProfiles);
  const setActiveProfile = useStore((s) => s.setActiveProfile);
  const triggerNewProfile = useStore((s) => s.triggerNewProfile);
  const setTriggerNewProfile = useStore((s) => s.setTriggerNewProfile);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Profile>({ ...EMPTY });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    if (triggerNewProfile) {
      setEditing({ ...EMPTY }); setNameTouched(false); setDialogOpen(true); setTriggerNewProfile(false);
    }
  }, [triggerNewProfile, setTriggerNewProfile]);

  const openCreate = () => { setEditing({ ...EMPTY }); setNameTouched(false); setDialogOpen(true); };
  const openEdit = (p: Profile) => { setEditing({ ...p }); setNameTouched(false); setDialogOpen(true); };

  function handleSave(): void {
    if (!editing.name.trim()) { setNameTouched(true); return; }
    const profile: Profile = { ...editing, id: editing.id || randomId(), name: editing.name.trim() };
    window.wavely.profiles.upsert(profile).then((r) => {
      setProfiles(r as Profile[]);
      if (!editing.id || activeProfile?.id === editing.id) setActiveProfile(profile);
      setDialogOpen(false);
      toast(editing.id ? "Profile updated" : "Profile created");
    }).catch((e) => toast(e instanceof Error ? e.message : "Failed to save profile"));
  }

  function handleDelete(id: string): void {
    if (profiles.length <= 1) { toast("Cannot delete the last profile."); return; }
    window.wavely.profiles.delete(id).then((r) => { setProfiles(r as Profile[]); toast("Profile deleted"); })
      .catch((e) => toast(e instanceof Error ? e.message : "Failed to delete profile"));
  }

  function handleSetActive(id: string): void {
    window.wavely.profiles.setActive(id).then(() => {
      const p = profiles.find((pr) => pr.id === id); if (p) setActiveProfile(p);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-[22px]">
        <h1 className={WV_TITLE}>Profiles</h1>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />New profile</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {profiles.map((p) => {
          const isActive = activeProfile?.id === p.id;
          return (
            <div
              key={p.id}
              onClick={() => handleSetActive(p.id)}
              className={cn(WV_CARD, "p-4 cursor-pointer group hover:border-acc transition-colors",
                isActive && "ring-2 ring-acc")}
            >
              <div className="flex items-start gap-3">
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <ProfileIcon icon={p.icon} className="text-lg" />
                    <span className="text-[14px] font-semibold text-ink truncate">{p.name}</span>
                  </div>
                  {p.language && <p className="text-[12px] text-ink-4 mt-1">Language: {p.language}</p>}
                  {p.model && <p className="text-[12px] text-ink-4">Model: {p.model}</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="p-1 rounded hover:bg-raised text-ink-3 hover:text-ink"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="p-1 rounded hover:bg-raised text-ink-3 hover:text-ink"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing.id ? "Edit profile" : "New profile"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editing.name}
                onChange={(e) => { setEditing((p) => ({ ...p, name: e.target.value })); if (e.target.value.trim()) setNameTouched(false); }}
                onBlur={() => setNameTouched(!editing.name.trim())}
                placeholder="e.g. Medical Calls"
                className={cn(nameTouched && !editing.name.trim() && "border-data-high focus-visible:ring-acc-faint")}
              />
              {nameTouched && !editing.name.trim() && <p className="text-[12px] text-data-high">Profile name is required.</p>}
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setEditing((p) => ({ ...p, color: c }))}
                    className={cn("w-8 h-8 rounded-full transition-all", editing.color === c && "ring-2 ring-ink ring-offset-2 ring-offset-background")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="grid grid-cols-8 gap-1.5">
                {QUICK_ICONS.map((e) => (
                  <button key={e} onClick={() => setEditing((p) => ({ ...p, icon: e }))}
                    className={cn("grid place-items-center w-9 h-9 rounded-md text-lg transition-all",
                      editing.icon === e ? "bg-accent ring-1 ring-line" : "hover:bg-hover")}>
                    <ProfileIcon icon={e} className="text-lg" />
                  </button>
                ))}
                <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <PopoverTrigger asChild>
                    <button title="More emojis" className="grid place-items-center w-9 h-9 rounded-md text-lg text-ink-3 hover:text-ink hover:bg-hover transition-colors border border-dashed border-line">+</button>
                  </PopoverTrigger>
                  <PopoverContent align="end" side="bottom" className="w-auto p-0 border-line" sideOffset={8}>
                    <EmojiPicker onEmojiClick={(d: EmojiClickData) => { setEditing((p) => ({ ...p, icon: d.emoji })); setShowEmojiPicker(false); }} autoFocusSearch theme={"dark" as any} width={350} height={400} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>System prompt</Label>
              <Textarea value={editing.systemPrompt} onChange={(e) => setEditing((p) => ({ ...p, systemPrompt: e.target.value }))}
                placeholder="Optional. Reserved for future post-processing." rows={4} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Language override</Label>
                <Select value={editing.language || SENTINEL} onValueChange={(v) => setEditing((p) => ({ ...p, language: v === SENTINEL ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model override</Label>
                <Select value={editing.model || SENTINEL} onValueChange={(v) => setEditing((p) => ({ ...p, model: v === SENTINEL ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!editing.name.trim()}>{editing.id ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProfilesView;
