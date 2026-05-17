import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const COLORS = ["#ef4444", "#f59e0b", "#eab308", "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];
const EMOJIS = ["🩺", "💉", "🏥", "💼", "📞", "🎙️", "🏠", "💻", "✈️", "📝", "🎓", "☕", "🛠️", "🧠", "⚡", "🎯"];
const LANGUAGES = [
  { value: "", label: "Use global setting" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Francais" },
  { value: "es", label: "Espanol" },
  { value: "it", label: "Italiano" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "auto", label: "Auto-detect" },
];

const MODELS = [
  { value: "", label: "Use global setting" },
  { value: "nova-2", label: "nova-2" },
  { value: "nova-3", label: "nova-3" },
];

const EMPTY_FORM: Profile = {
  id: "",
  name: "",
  color: "#10b981",
  icon: "🎙️",
  systemPrompt: "",
  language: "",
  model: "",
};

function ProfilesView(): React.ReactElement {
  const profiles = useStore((s) => s.profiles);
  const activeProfile = useStore((s) => s.activeProfile);
  const setProfiles = useStore((s) => s.setProfiles);
  const setActiveProfile = useStore((s) => s.setActiveProfile);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Profile>({ ...EMPTY_FORM });

  useEffect(() => {
    function onNewProfile(): void {
      setEditing({ ...EMPTY_FORM });
      setDialogOpen(true);
    }
    window.addEventListener("wavely:new-profile", onNewProfile);
    return () => window.removeEventListener("wavely:new-profile", onNewProfile);
  }, []);

  function openCreate(): void {
    setEditing({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(profile: Profile): void {
    setEditing({ ...profile });
    setDialogOpen(true);
  }

  function handleSave(): void {
    if (!editing.name.trim()) return;

    const profile: Profile = {
      ...editing,
      id: editing.id || crypto.randomUUID(),
      name: editing.name.trim(),
    };

    window.wavely.profiles.upsert(profile).then((result) => {
      const updated = result as Profile[];
      setProfiles(updated);
      if (!editing.id || activeProfile?.id === editing.id) {
        setActiveProfile(profile);
      }
      setDialogOpen(false);
      toast(editing.id ? "Profile updated" : "Profile created");
    }).catch((err) => {
      toast(err instanceof Error ? err.message : "Failed to save profile");
    });
  }

  function handleDelete(id: string): void {
    if (profiles.length <= 1) {
      toast("Cannot delete the last profile.");
      return;
    }
    window.wavely.profiles.delete(id).then((result) => {
      const updated = result as Profile[];
      setProfiles(updated);
      toast("Profile deleted");
    }).catch((err) => {
      toast(err instanceof Error ? err.message : "Failed to delete profile");
    });
  }

  function handleSetActive(id: string): void {
    window.wavely.profiles.setActive(id).then(() => {
      const p = profiles.find((pr) => pr.id === id);
      if (p) setActiveProfile(p);
    });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Profiles</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          New profile
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          {profiles.map((p) => {
            const isActive = activeProfile?.id === p.id;
            return (
              <Card
                key={p.id}
                className={cn(
                  "cursor-pointer transition-all hover:border-border/80 group",
                  isActive && "ring-2 ring-primary/60",
                )}
                onClick={() => handleSetActive(p.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-1 self-stretch rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{p.icon}</span>
                        <span className="text-sm font-medium truncate text-foreground">
                          {p.name}
                        </span>
                      </div>
                      {p.language && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Language: {p.language}
                        </p>
                      )}
                      {p.model && (
                        <p className="text-[11px] text-muted-foreground">
                          Model: {p.model}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                        className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Edit profile" : "New profile"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editing.name}
                onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Medical Calls"
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEditing((p) => ({ ...p, color: c }))}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      editing.color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="grid grid-cols-8 gap-1.5">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEditing((p) => ({ ...p, icon: e }))}
                    className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-md text-lg transition-all",
                      editing.icon === e
                        ? "bg-accent ring-1 ring-border"
                        : "hover:bg-accent/50",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>System prompt</Label>
              <Textarea
                value={editing.systemPrompt}
                onChange={(e) => setEditing((p) => ({ ...p, systemPrompt: e.target.value }))}
                placeholder="Optional. Reserved for future post-processing — e.g. 'Format as bullet points and remove filler words.'"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Language override</Label>
                <Select
                  value={editing.language || ""}
                  onValueChange={(v) => setEditing((p) => ({ ...p, language: v || undefined }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model override</Label>
                <Select
                  value={editing.model || ""}
                  onValueChange={(v) => setEditing((p) => ({ ...p, model: v || undefined }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProfilesView;
