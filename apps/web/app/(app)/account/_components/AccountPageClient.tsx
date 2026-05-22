"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  User,
  CreditCard,
  BarChart2,
  Bell,
  Trash2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import {
  useAccount,
  useUpdateAccount,
  useUpdateNotifications,
  useDeleteAccount,
  type AccountData,
  type AccountNotifications,
} from "@/hooks/use-account";

type Tab = "profile" | "subscription" | "usage" | "notifications";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "subscription", label: "Subscription", icon: CreditCard },
  { key: "usage", label: "Usage", icon: BarChart2 },
  { key: "notifications", label: "Notifications", icon: Bell },
];

export function AccountPageClient() {
  const [tab, setTab] = useState<Tab>("profile");
  const { data: account, isLoading, isError, refetch } = useAccount();

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle size={32} className="text-destructive mb-4" />
        <p className="text-slate-600 mb-4">Failed to load account data.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sora text-3xl font-bold text-primary">Account</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Manage your profile, subscription, and preferences.
        </p>
      </div>

      {/* Mobile: select dropdown */}
      <div className="sm:hidden">
        <select
          value={tab}
          onChange={(e) => setTab(e.target.value as Tab)}
          className="input w-full"
        >
          {TABS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop: tab bar */}
      <div className="hidden sm:flex gap-1 border-b border-slate-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === key
                ? "border-accent text-accent"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div>
        {tab === "profile" && <ProfileTab account={account} isLoading={isLoading} />}
        {tab === "subscription" && <SubscriptionTab account={account} isLoading={isLoading} />}
        {tab === "usage" && <UsageTab account={account} isLoading={isLoading} />}
        {tab === "notifications" && <NotificationsTab account={account} isLoading={isLoading} />}
      </div>

      <DangerZone />
    </div>
  );
}

// ─── Profile ─────────────────────────────────────────────────────────────────

function ProfileTab({
  account,
  isLoading,
}: {
  account?: AccountData;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const { mutate: updateAccount, isPending } = useUpdateAccount();

  useEffect(() => {
    if (account) {
      setName(account.full_name);
      setWa(account.whatsapp_number ?? "");
    }
  }, [account]);

  const initials =
    account?.full_name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "?";

  const handleSave = () => {
    updateAccount(
      { full_name: name, whatsapp_number: wa || null },
      {
        onSuccess: () => toast.success("Profile updated"),
        onError: (err: unknown) =>
          toast.error((err as Error).message ?? "Failed to update profile"),
      }
    );
  };

  return (
    <div className="space-y-6 max-w-xl">
      {/* Avatar + name row */}
      <div className="flex items-center gap-4">
        {isLoading ? (
          <div className="w-16 h-16 rounded-full bg-slate-100 animate-pulse shrink-0" />
        ) : account?.avatar_url ? (
          <img
            src={account.avatar_url}
            alt={account.full_name}
            className="w-16 h-16 rounded-full object-cover border border-slate-200 shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-white font-sora font-bold text-xl shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          {isLoading ? (
            <div className="h-5 w-36 bg-slate-100 rounded animate-pulse mb-1" />
          ) : (
            <p className="font-sora font-semibold text-primary text-lg truncate">
              {account?.full_name}
            </p>
          )}
          <p className="text-sm text-slate-500 truncate">{account?.email ?? ""}</p>
        </div>
      </div>

      {/* Editable fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
          {isLoading ? (
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <input
              className="input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            WhatsApp number{" "}
            <span className="text-slate-400 font-normal">(E.164, e.g. +12025550100)</span>
          </label>
          {isLoading ? (
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <input
              className="input w-full"
              value={wa}
              onChange={(e) => setWa(e.target.value)}
              placeholder="+12025550100"
            />
          )}
        </div>
      </div>

      {/* Read-only metadata */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <ReadOnlyRow
          label="Email"
          value={account?.email}
          note="Change this in Clerk account settings"
          loading={isLoading}
        />
        <ReadOnlyRow label="Role" value={account?.role} loading={isLoading} badge />
        <ReadOnlyRow label="Plan" value={account?.plan} loading={isLoading} badge />
        <ReadOnlyRow
          label="Member since"
          value={
            account?.created_at
              ? new Date(account.created_at).toLocaleDateString()
              : undefined
          }
          loading={isLoading}
        />
        {account?.school_name && (
          <ReadOnlyRow label="School" value={account.school_name} loading={isLoading} />
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={isPending || isLoading}
        className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function ReadOnlyRow({
  label,
  value,
  loading,
  note,
  badge,
}: {
  label: string;
  value?: string;
  loading?: boolean;
  note?: string;
  badge?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      {loading ? (
        <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
      ) : badge ? (
        <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium capitalize">
          {value ?? "—"}
        </span>
      ) : (
        <div className="text-right">
          <span className="text-slate-700">{value ?? "—"}</span>
          {note && <p className="text-[11px] text-slate-400 mt-0.5">{note}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Subscription ─────────────────────────────────────────────────────────────

function SubscriptionTab({
  account,
  isLoading,
}: {
  account?: AccountData;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4 max-w-xl">
        <div className="h-44 rounded-xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  const sub = account?.subscription;
  const plan = account?.plan ?? "free";
  const schoolName = account?.school_name;

  if (!sub) return null;

  return (
    <div className="space-y-4 max-w-xl">
      {sub.status === "past_due" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Payment failed</p>
            <p className="text-sm text-slate-600 mt-0.5">
              Your payment is past due. Update your payment method to keep access.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Current plan
            </p>
            <h2 className="font-sora text-2xl font-bold text-primary capitalize mt-1">{plan}</h2>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${
              sub.status === "active" || sub.status === "trialing"
                ? "bg-teal/10 text-teal"
                : sub.status === "past_due"
                ? "bg-destructive/10 text-destructive"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {sub.status === "none" ? "free" : sub.status}
          </span>
        </div>

        {plan === "free" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              You are on the Free plan. Upgrade to unlock more AI messages, exams, and groups.
            </p>
            <a
              href="/upgrade"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
            >
              Upgrade to Personal — $8/mo
            </a>
          </div>
        )}

        {plan === "school" && (
          <p className="text-sm text-slate-600">
            Your plan is managed by {schoolName ?? "your school"}. Contact your administrator for
            billing questions.
          </p>
        )}

        {plan === "personal" && (
          <div className="space-y-3">
            {sub.current_period_end && (
              <p className="text-sm text-slate-600">
                {sub.cancel_at_period_end
                  ? `Your plan ends on ${new Date(sub.current_period_end).toLocaleDateString()}.`
                  : `Renews on ${new Date(sub.current_period_end).toLocaleDateString()}.`}
              </p>
            )}
            {sub.cancel_at_period_end && (
              <div className="rounded-lg border border-amber/30 bg-amber/5 p-3 text-sm text-slate-700">
                Your plan is set to cancel at the end of the billing period.
              </div>
            )}
            <a
              href="https://www.paypal.com/myaccount/autopay/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50"
            >
              <ExternalLink size={14} />
              Manage PayPal subscription
            </a>
          </div>
        )}

        {sub.status === "canceled" && sub.current_period_end && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Your plan ended on {new Date(sub.current_period_end).toLocaleDateString()}.
            </p>
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
            >
              Re-subscribe
            </a>
          </div>
        )}

        {sub.status === "past_due" && (
          <a
            href="https://www.paypal.com/myaccount/autopay/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-white text-sm font-medium hover:bg-destructive/90"
          >
            <ExternalLink size={14} />
            Update payment on PayPal
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Usage ────────────────────────────────────────────────────────────────────

function UsageTab({
  account,
  isLoading,
}: {
  account?: AccountData;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4 max-w-xl">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[76px] rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const u = account?.usage;
  if (!u) return null;

  return (
    <div className="space-y-4 max-w-xl">
      <UsageBar
        label="AI chat messages"
        sublabel="Resets daily at midnight UTC"
        current={u.chat_messages_today}
        limit={u.chat_messages_limit_day}
        tooltip="You can send this many AI messages per day."
      />
      <UsageBar
        label="Exams generated"
        sublabel="Resets on the 1st of each month"
        current={u.exams_generated_month}
        limit={u.exams_limit_month}
        tooltip="Number of AI-generated exams this month."
      />
      <UsageBar
        label="Groups owned"
        sublabel="Upgrade to create more"
        current={u.groups_count}
        limit={u.groups_limit}
        tooltip="You can own this many groups on your current plan."
      />
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">Files uploaded</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Total — no limit</p>
        </div>
        <span className="font-sora font-bold text-primary text-2xl">
          {u.files_uploaded_total}
        </span>
      </div>
    </div>
  );
}

function UsageBar({
  label,
  sublabel,
  current,
  limit,
  tooltip,
}: {
  label: string;
  sublabel: string;
  current: number;
  limit: number;
  tooltip: string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  const barColor =
    pct > 90 ? "bg-destructive" : pct > 70 ? "bg-amber" : "bg-teal";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" title={tooltip}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{sublabel}</p>
        </div>
        <span className="text-sm font-medium text-slate-700 shrink-0 ml-4">
          {current} / {limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────

function NotificationsTab({
  account,
  isLoading,
}: {
  account?: AccountData;
  isLoading: boolean;
}) {
  const { mutate: updateNotifs } = useUpdateNotifications();

  if (isLoading) {
    return (
      <div className="space-y-3 max-w-xl">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const notifs = account?.notifications;
  if (!notifs) return null;

  const plan = account?.plan ?? "free";
  const canWhatsApp = plan === "school";

  const toggle = (key: keyof AccountNotifications) => {
    if (key === "whatsapp_enabled" && !canWhatsApp) return;
    updateNotifs(
      { [key]: !notifs[key] },
      {
        onError: (err: unknown) =>
          toast.error((err as Error).message ?? "Failed to update notifications"),
      }
    );
  };

  return (
    <div className="space-y-3 max-w-xl">
      <NotifRow
        label="In-app notifications"
        description="Show alerts and badges inside the app"
        enabled={notifs.in_app_enabled}
        onToggle={() => toggle("in_app_enabled")}
      />
      <NotifRow
        label="Email notifications"
        description="Receive updates to your inbox"
        enabled={notifs.email_enabled}
        onToggle={() => toggle("email_enabled")}
      />
      <NotifRow
        label="WhatsApp notifications"
        description="Get messages on WhatsApp"
        enabled={notifs.whatsapp_enabled}
        onToggle={() => toggle("whatsapp_enabled")}
        disabled={!canWhatsApp}
        badge={!canWhatsApp ? "School plan required" : undefined}
      />
    </div>
  );
}

function NotifRow({
  label,
  description,
  enabled,
  onToggle,
  disabled,
  badge,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-4 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-slate-700">{label}</p>
          {badge && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-medium">
              {badge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
      </div>

      <button
        role="switch"
        aria-checked={enabled}
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={`relative shrink-0 w-10 h-5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          enabled && !disabled ? "bg-accent" : "bg-slate-200"
        } disabled:cursor-not-allowed`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Danger zone ──────────────────────────────────────────────────────────────

function DangerZone() {
  const [step, setStep] = useState<"idle" | "confirming">("idle");
  const [confirmText, setConfirmText] = useState("");
  const router = useRouter();
  const { mutate: deleteAccount, isPending } = useDeleteAccount();

  const handleDelete = () => {
    deleteAccount(confirmText, {
      onSuccess: () => {
        toast.success("Account deleted");
        router.push("/sign-in");
      },
      onError: (err: unknown) =>
        toast.error((err as Error).message ?? "Failed to delete account"),
    });
  };

  return (
    <div className="rounded-xl border-2 border-destructive/30 bg-white p-6 space-y-4 max-w-xl">
      <div className="flex items-center gap-3">
        <Trash2 size={18} className="text-destructive" />
        <h3 className="font-sora font-semibold text-destructive">Danger zone</h3>
      </div>
      <p className="text-sm text-slate-600">
        Permanently delete your account. All personal data will be anonymized and cannot be
        recovered.
      </p>

      {step === "idle" ? (
        <button
          onClick={() => setStep("confirming")}
          className="px-4 py-2 rounded-lg border border-destructive text-destructive text-sm font-medium hover:bg-destructive/5 transition"
        >
          Delete account
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">
            Type{" "}
            <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-destructive">
              DELETE
            </code>{" "}
            to confirm:
          </p>
          <input
            className="input w-full"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoFocus
          />
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={confirmText !== "DELETE" || isPending}
              className="px-4 py-2 rounded-lg bg-destructive text-white text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isPending ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              onClick={() => {
                setStep("idle");
                setConfirmText("");
              }}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
