"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import {
  User,
  CreditCard,
  BarChart2,
  Bell,
  Trash2,
  AlertTriangle,
  ExternalLink,
  Globe,
} from "lucide-react";
import {
  useAccount,
  useUpdateAccount,
  useUpdateNotifications,
  useDeleteAccount,
  type AccountData,
  type AccountNotifications,
} from "@/hooks/use-account";
import { useLocale, type AppLocale } from "@/hooks/use-locale";

type Tab = "profile" | "subscription" | "usage" | "notifications" | "language";

export function AccountPageClient() {
  const [tab, setTab] = useState<Tab>("profile");
  const { data: account, isLoading, isError, refetch } = useAccount();
  const t = useTranslations("account");
  const tErrors = useTranslations("errors");
  const { isRTL } = useLocale();

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "profile", label: t("tabs.profile"), icon: User },
    { key: "subscription", label: t("tabs.subscription"), icon: CreditCard },
    { key: "usage", label: t("tabs.usage"), icon: BarChart2 },
    { key: "notifications", label: t("tabs.notifications"), icon: Bell },
    { key: "language", label: t("tabs.language"), icon: Globe },
  ];

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle size={32} className="text-destructive mb-4" />
        <p className="text-slate-600 mb-4">{t("load_error")}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
        >
          {tErrors("retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sora text-3xl font-bold text-primary">{t("title")}</h1>
        <p className="text-slate-500 mt-1 text-sm">{t("subtitle")}</p>
      </div>

      {/* Mobile: select dropdown */}
      <div className="sm:hidden">
        <select
          value={tab}
          onChange={(e) => setTab(e.target.value as Tab)}
          className="input w-full"
          dir={isRTL ? "rtl" : "ltr"}
        >
          {TABS.map((tt) => (
            <option key={tt.key} value={tt.key}>
              {tt.label}
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
        {tab === "language" && <LanguageTab account={account} isLoading={isLoading} />}
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
  const t = useTranslations("account.profile");

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
        onSuccess: () => toast.success(t("saved")),
        onError: (err: unknown) => toast.error((err as Error).message ?? t("error")),
      }
    );
  };

  return (
    <div className="space-y-6 max-w-xl">
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

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t("full_name")}</label>
          {isLoading ? (
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <input
              className="input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("name_placeholder")}
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t("whatsapp")}{" "}
            <span className="text-slate-400 font-normal">{t("whatsapp_format")}</span>
          </label>
          {isLoading ? (
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <input
              className="input w-full"
              value={wa}
              onChange={(e) => setWa(e.target.value)}
              placeholder={t("wa_placeholder")}
              dir="ltr"
            />
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <ReadOnlyRow label={t("email_label")} value={account?.email} note={t("email_note")} loading={isLoading} />
        <ReadOnlyRow label={t("role_label")} value={account?.role} loading={isLoading} badge />
        <ReadOnlyRow label={t("plan_label")} value={account?.plan} loading={isLoading} badge />
        <ReadOnlyRow
          label={t("member_since")}
          value={account?.created_at ? new Date(account.created_at).toLocaleDateString() : undefined}
          loading={isLoading}
        />
        {account?.school_name && (
          <ReadOnlyRow label={t("school_label")} value={account.school_name} loading={isLoading} />
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={isPending || isLoading}
        className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? t("saving") : t("save")}
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
        <div className="ltr:text-right rtl:text-left">
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
  const t = useTranslations("account.subscription");

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
            <p className="text-sm font-medium text-destructive">{t("payment_failed")}</p>
            <p className="text-sm text-slate-600 mt-0.5">{t("payment_past_due")}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t("current_plan")}
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
            {sub.status === "none" ? t("status_free") : sub.status}
          </span>
        </div>

        {plan === "free" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">{t("free_desc")}</p>
            <a
              href="/upgrade"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
            >
              {t("upgrade_cta")}
            </a>
          </div>
        )}

        {plan === "school" && (
          <p className="text-sm text-slate-600">
            {t("school_managed", { school: schoolName ?? "your school" })}
          </p>
        )}

        {plan === "personal" && (
          <div className="space-y-3">
            {sub.current_period_end && (
              <p className="text-sm text-slate-600">
                {sub.cancel_at_period_end
                  ? t("ends_on", { date: new Date(sub.current_period_end).toLocaleDateString() })
                  : t("renews_on", { date: new Date(sub.current_period_end).toLocaleDateString() })}
              </p>
            )}
            {sub.cancel_at_period_end && (
              <div className="rounded-lg border border-amber/30 bg-amber/5 p-3 text-sm text-slate-700">
                {t("cancel_warning")}
              </div>
            )}
            <a
              href="https://www.paypal.com/myaccount/autopay/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50"
            >
              <ExternalLink size={14} />
              {t("manage_paypal")}
            </a>
          </div>
        )}

        {sub.status === "canceled" && sub.current_period_end && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {t("ends_on", { date: new Date(sub.current_period_end).toLocaleDateString() })}
            </p>
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
            >
              {t("resubscribe")}
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
            {t("update_payment")}
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
  const t = useTranslations("account.usage");

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
        label={t("chat_messages")}
        sublabel={t("chat_sublabel")}
        current={u.chat_messages_today}
        limit={u.chat_messages_limit_day}
      />
      <UsageBar
        label={t("exams_generated")}
        sublabel={t("exams_sublabel")}
        current={u.exams_generated_month}
        limit={u.exams_limit_month}
      />
      <UsageBar
        label={t("groups_owned")}
        sublabel={t("groups_sublabel")}
        current={u.groups_count}
        limit={u.groups_limit}
      />
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">{t("files_uploaded")}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{t("files_sublabel")}</p>
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
}: {
  label: string;
  sublabel: string;
  current: number;
  limit: number;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  const barColor = pct > 90 ? "bg-destructive" : pct > 70 ? "bg-amber" : "bg-teal";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{sublabel}</p>
        </div>
        <span className="text-sm font-medium text-slate-700 shrink-0 ltr:ml-4 rtl:mr-4">
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
  const t = useTranslations("account.notifications");

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
        onError: (err: unknown) => toast.error((err as Error).message ?? t("error")),
      }
    );
  };

  return (
    <div className="space-y-3 max-w-xl">
      <NotifRow
        label={t("in_app")}
        description={t("in_app_desc")}
        enabled={notifs.in_app_enabled}
        onToggle={() => toggle("in_app_enabled")}
      />
      <NotifRow
        label={t("email")}
        description={t("email_desc")}
        enabled={notifs.email_enabled}
        onToggle={() => toggle("email_enabled")}
      />
      <NotifRow
        label={t("whatsapp")}
        description={t("whatsapp_desc")}
        enabled={notifs.whatsapp_enabled}
        onToggle={() => toggle("whatsapp_enabled")}
        disabled={!canWhatsApp}
        badge={!canWhatsApp ? t("school_plan_required") : undefined}
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

// ─── Language ─────────────────────────────────────────────────────────────────

function LanguageTab({
  account,
  isLoading,
}: {
  account?: AccountData;
  isLoading: boolean;
}) {
  const t = useTranslations("account.language");
  const { locale, setLocale } = useLocale();
  const { mutate: updateAccount } = useUpdateAccount();
  const [switching, setSwitching] = useState(false);

  const handleSwitch = async (newLocale: AppLocale) => {
    if (newLocale === locale || switching) return;
    setSwitching(true);
    try {
      // Persist to profile
      updateAccount({ language: newLocale });
      // Switch cookie + re-render
      await setLocale(newLocale);
      toast.success(t("saved"));
    } catch {
      toast.error(t("error"));
      setSwitching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-xl">
        <div className="h-32 rounded-xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">{t("title")}</h3>
        <p className="text-[13px] text-slate-500 mt-0.5">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <LanguageOption
          code="fr"
          label={t("fr_label")}
          flag="🇲🇦"
          selected={locale === "fr"}
          disabled={switching}
          onSelect={() => handleSwitch("fr")}
        />
        <LanguageOption
          code="ar"
          label={t("ar_label")}
          flag="🇲🇦"
          selected={locale === "ar"}
          disabled={switching}
          onSelect={() => handleSwitch("ar")}
        />
      </div>
    </div>
  );
}

function LanguageOption({
  code,
  label,
  flag,
  selected,
  disabled,
  onSelect,
}: {
  code: string;
  label: string;
  flag: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        selected
          ? "border-accent bg-accent/5 text-accent"
          : "border-slate-200 hover:border-slate-300 text-slate-700"
      }`}
    >
      <span className="text-2xl">{flag}</span>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-[10px] uppercase tracking-wider font-medium opacity-60">{code}</span>
      {selected && (
        <span className="w-2 h-2 rounded-full bg-accent" />
      )}
    </button>
  );
}

// ─── Danger zone ──────────────────────────────────────────────────────────────

function DangerZone() {
  const [step, setStep] = useState<"idle" | "confirming">("idle");
  const [confirmText, setConfirmText] = useState("");
  const router = useRouter();
  const { mutate: deleteAccount, isPending } = useDeleteAccount();
  const t = useTranslations("account.danger");

  const handleDelete = () => {
    deleteAccount(confirmText, {
      onSuccess: () => {
        toast.success(t("success"));
        router.push("/sign-in");
      },
      onError: (err: unknown) => toast.error((err as Error).message ?? t("error")),
    });
  };

  return (
    <div className="rounded-xl border-2 border-destructive/30 bg-white p-6 space-y-4 max-w-xl">
      <div className="flex items-center gap-3">
        <Trash2 size={18} className="text-destructive" />
        <h3 className="font-sora font-semibold text-destructive">{t("title")}</h3>
      </div>
      <p className="text-sm text-slate-600">{t("description")}</p>

      {step === "idle" ? (
        <button
          onClick={() => setStep("confirming")}
          className="px-4 py-2 rounded-lg border border-destructive text-destructive text-sm font-medium hover:bg-destructive/5 transition"
        >
          {t("delete_btn")}
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">
            {t("confirm_prompt")}{" "}
            <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-destructive">
              DELETE
            </code>
          </p>
          <input
            className="input w-full"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={t("confirm_placeholder")}
            autoFocus
            dir="ltr"
          />
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={confirmText !== "DELETE" || isPending}
              className="px-4 py-2 rounded-lg bg-destructive text-white text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isPending ? t("confirming_btn") : t("confirm_btn")}
            </button>
            <button
              onClick={() => {
                setStep("idle");
                setConfirmText("");
              }}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 transition"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
