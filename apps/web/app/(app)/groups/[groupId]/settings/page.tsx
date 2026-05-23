"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Check } from "lucide-react";
import { useGroup, useUpdateGroup } from "@/lib/hooks/use-groups";
import { cn } from "@/lib/utils";

const COLOR_SWATCHES = [
  "#1A3A5C", "#2563EB", "#7C3AED", "#DB2777",
  "#DC2626", "#D97706", "#16A34A", "#0891B2",
  "#475569", "#1E1B4B",
];

export default function GroupSettingsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);
  const router = useRouter();
  const { data: group, isLoading } = useGroup(groupId);
  const update = useUpdateGroup(groupId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#1A3A5C");
  const [customColor, setCustomColor] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");

  useEffect(() => {
    if (group) {
      setName(group.name ?? "");
      setDescription(group.description ?? "");
      setColor(group.color ?? "#1A3A5C");
      setCustomColor(COLOR_SWATCHES.includes(group.color ?? "") ? "" : (group.color ?? ""));
      setVisibility(group.visibility ?? "private");
    }
  }, [group]);

  if (!["owner", "teacher"].includes(group?.my_role ?? "")) {
    if (!isLoading && group) router.replace(`/groups/${groupId}`);
    return null;
  }

  const activeColor = customColor || color;

  function handleColorSwatch(hex: string) {
    setColor(hex);
    setCustomColor("");
  }

  function handleCustomColor(val: string) {
    setCustomColor(val);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }
    const hexRe = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
    if (customColor && !hexRe.test(customColor)) {
      toast.error("Enter a valid hex color (e.g. #1A3A5C)");
      return;
    }

    update.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        color: activeColor,
        visibility,
      },
      {
        onSuccess: () => toast.success("Group updated"),
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
            "Failed to save changes";
          toast.error(msg);
        },
      }
    );
  }

  return (
    <div className="max-w-lg">
      <h2 className="font-sora text-lg font-semibold text-primary mb-6">Group settings</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            placeholder="e.g. Maths Terminale S"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-none"
            placeholder="Optional description shown to members"
          />
        </div>

        {/* Color */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Group color</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {COLOR_SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => handleColorSwatch(hex)}
                className="w-8 h-8 rounded-lg flex items-center justify-center ring-2 ring-offset-1 transition-all"
                style={{ background: hex, ringColor: activeColor === hex ? hex : "transparent" }}
                title={hex}
              >
                {activeColor === hex && !customColor && (
                  <Check size={14} className="text-white drop-shadow" />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div
              className="w-8 h-8 rounded-lg border border-slate-200 shrink-0"
              style={{ background: activeColor }}
            />
            <input
              type="text"
              value={customColor}
              onChange={(e) => handleCustomColor(e.target.value)}
              placeholder="Custom hex (e.g. #A855F7)"
              maxLength={7}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </div>
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Visibility</label>
          <div className="flex gap-3">
            {(["private", "public"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={cn(
                  "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                  visibility === v
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-slate-300 text-slate-600 hover:border-slate-400"
                )}
              >
                {v === "private" ? "Private" : "Public"}
                <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                  {v === "private" ? "Invite only" : "Anyone with link"}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
          <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide font-medium">Preview</p>
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-sora font-bold text-lg shrink-0"
              style={{ background: activeColor }}
            >
              {(name || "G").charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="text-sm font-semibold text-primary">{name || "Group name"}</p>
              <p className="text-[11px] text-slate-400">{visibility} · {description || "No description"}</p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={update.isPending}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {update.isPending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
