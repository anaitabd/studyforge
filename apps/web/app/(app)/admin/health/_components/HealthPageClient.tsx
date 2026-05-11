"use client";

import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  Trash2,
  Search,
  ShieldAlert,
  DollarSign,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useHealthOverview,
  useStuckFiles,
  useRetryStuckFile,
  useMarkFileError,
  useDlqMessages,
  useRetryDlqMessage,
  useDeleteDlqMessage,
  useAiCosts,
  useAdminUserSearch,
  useOverrideUserPlan,
  useSuspendUser,
  useFeatureFlags,
  useUpdateFeatureFlag,
  type AdminUser,
  type DlqMessage,
} from "@/hooks/use-admin-health";

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-white rounded-2xl border border-slate-200 p-6", className)}>
      <h2 className="font-sora font-semibold text-primary text-base mb-4">{title}</h2>
      {children}
    </div>
  );
}

function StatusDot({ status }: { status: "ok" | "degraded" | "error" | string }) {
  return (
    <span
      className={cn("inline-block w-2 h-2 rounded-full flex-shrink-0", {
        "bg-emerald-500": status === "ok",
        "bg-amber-400": status === "degraded",
        "bg-red-500": status === "error",
      })}
    />
  );
}

// ─── Section 1: Service status bar ───────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  api: "API",
  database: "Database",
  redis: "Redis",
  vector_db: "Vector DB",
  storage: "Storage",
  ai_provider: "AI Provider",
};

function ServiceStatusBar() {
  const { data, isLoading, refetch, isFetching } = useHealthOverview();

  return (
    <SectionCard title="Service Status">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400">
          {data ? `Last checked ${new Date(data.checked_at * 1000).toLocaleTimeString()}` : "Auto-refreshes every 15s"}
        </span>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors"
        >
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-28 bg-slate-100 rounded-full animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {Object.entries(SERVICE_LABELS).map(([key, label]) => {
            const svc = data?.services[key as keyof typeof data.services];
            const status = svc?.status ?? "error";
            return (
              <div
                key={key}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 text-sm"
                title={svc?.detail ?? undefined}
              >
                <StatusDot status={status} />
                <span className="text-slate-700">{label}</span>
                {status === "ok" && <CheckCircle2 size={12} className="text-emerald-500" />}
                {status === "degraded" && <AlertTriangle size={12} className="text-amber-500" />}
                {status === "error" && <XCircle size={12} className="text-red-500" />}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 2: Queue depth cards ────────────────────────────────────────────

function QueueDepthCards() {
  const { data } = useHealthOverview();

  const queues = [
    { key: "files", label: "Files Queue" },
    { key: "slides", label: "Slides Queue" },
    { key: "notifications", label: "Notifications Queue" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {queues.map(({ key, label }) => {
        const depth = data?.queues[key as keyof typeof data.queues] ?? null;
        const isHigh = depth !== null && depth > 50;
        return (
          <div
            key={key}
            className={cn(
              "rounded-2xl border p-5",
              isHigh ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
            )}
          >
            <p className="text-sm text-slate-500 mb-1">{label}</p>
            {depth === null ? (
              <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
            ) : (
              <p className={cn("text-3xl font-bold font-sora", isHigh ? "text-amber-600" : "text-primary")}>
                {depth === -1 ? "—" : depth}
              </p>
            )}
            {depth === -1 && <p className="text-xs text-slate-400 mt-1">Unable to connect</p>}
            {isHigh && <p className="text-xs text-amber-600 mt-1">High queue depth</p>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Section 3: Stuck files ───────────────────────────────────────────────────

function StuckFilesTable() {
  const [minutes, setMinutes] = useState(30);
  const [confirming, setConfirming] = useState<{ id: string; action: "retry" | "error" } | null>(null);

  const { data: files, isLoading } = useStuckFiles(minutes);
  const retryMut = useRetryStuckFile();
  const errorMut = useMarkFileError();

  async function handleAction(fileId: string, action: "retry" | "error") {
    if (confirming?.id === fileId && confirming?.action === action) {
      if (action === "retry") await retryMut.mutateAsync(fileId);
      else await errorMut.mutateAsync(fileId);
      setConfirming(null);
    } else {
      setConfirming({ id: fileId, action });
    }
  }

  return (
    <SectionCard title="Stuck Files">
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm text-slate-600">Stuck for more than</label>
        <select
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={60}>1 hour</option>
          <option value={360}>6 hours</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !files?.length ? (
        <p className="text-sm text-slate-400 text-center py-6">No stuck files</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-medium">File</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Stuck</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {files.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-4">
                    <p className="font-medium text-primary truncate max-w-[200px]">{f.name}</p>
                    <p className="text-xs text-slate-400">{f.id.slice(0, 8)}…</p>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                      {f.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-500">{f.stuck_minutes}m</td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleAction(f.id, "retry")}
                        disabled={retryMut.isPending}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                          confirming?.id === f.id && confirming.action === "retry"
                            ? "bg-accent text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        )}
                      >
                        <RotateCcw size={11} />
                        {confirming?.id === f.id && confirming.action === "retry" ? "Confirm" : "Retry"}
                      </button>
                      <button
                        onClick={() => handleAction(f.id, "error")}
                        disabled={errorMut.isPending}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                          confirming?.id === f.id && confirming.action === "error"
                            ? "bg-red-500 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-red-100 hover:text-red-600"
                        )}
                      >
                        <XCircle size={11} />
                        {confirming?.id === f.id && confirming.action === "error" ? "Confirm" : "Mark error"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 4: DLQ ───────────────────────────────────────────────────────────

type DlqQueue = "files" | "slides" | "notifications";

function DlqTable() {
  const [queue, setQueue] = useState<DlqQueue>("files");
  const [confirming, setConfirming] = useState<string | null>(null);

  const { data, isLoading } = useDlqMessages(queue);
  const retryMut = useRetryDlqMessage();
  const deleteMut = useDeleteDlqMessage();

  async function handleRetry(msg: DlqMessage) {
    await retryMut.mutateAsync({
      messageId: msg.message_id,
      receiptHandle: msg.receipt_handle,
      queue,
    });
  }

  async function handleDelete(msg: DlqMessage) {
    if (confirming === msg.message_id) {
      await deleteMut.mutateAsync({
        messageId: msg.message_id,
        receiptHandle: msg.receipt_handle,
        queue,
      });
      setConfirming(null);
    } else {
      setConfirming(msg.message_id);
    }
  }

  return (
    <SectionCard title="Dead Letter Queue">
      <div className="flex items-center gap-2 mb-4">
        {(["files", "slides", "notifications"] as DlqQueue[]).map((q) => (
          <button
            key={q}
            onClick={() => setQueue(q)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize",
              queue === q ? "bg-accent text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {q}
          </button>
        ))}
      </div>

      {data?.note && (
        <p className="text-sm text-slate-400 text-center py-4">{data.note}</p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : !data?.messages?.length && !data?.note ? (
        <p className="text-sm text-slate-400 text-center py-6">No messages in DLQ</p>
      ) : data?.messages && data.messages.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-medium">Message ID</th>
                <th className="pb-2 font-medium">Receive count</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.messages.map((msg) => (
                <tr key={msg.message_id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-4">
                    <p className="font-mono text-xs text-slate-600">{msg.message_id.slice(0, 16)}…</p>
                    <p className="text-xs text-slate-400 truncate max-w-[240px]">{msg.body.slice(0, 60)}…</p>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-500">{msg.receive_count ?? "—"}</td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRetry(msg)}
                        disabled={retryMut.isPending}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        <RotateCcw size={11} /> Requeue
                      </button>
                      <button
                        onClick={() => handleDelete(msg)}
                        disabled={deleteMut.isPending}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                          confirming === msg.message_id
                            ? "bg-red-500 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-red-100 hover:text-red-600"
                        )}
                      >
                        <Trash2 size={11} />
                        {confirming === msg.message_id ? "Confirm" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </SectionCard>
  );
}

// ─── Section 5: User search & operations ─────────────────────────────────────

function PlanModal({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState(user.plan);
  const [reason, setReason] = useState("");
  const overrideMut = useOverrideUserPlan();

  async function submit() {
    await overrideMut.mutateAsync({ userId: user.id, plan, reason: reason || undefined });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="font-sora font-semibold text-primary mb-4">Override Plan</h3>
        <p className="text-sm text-slate-600 mb-4">
          User: <strong>{user.name}</strong> ({user.email})
        </p>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="free">Free</option>
          <option value="personal">Personal</option>
          <option value="school">School</option>
        </select>
        <input
          type="text"
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={overrideMut.isPending}
            className="flex-1 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {overrideMut.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuspendModal({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const suspendMut = useSuspendUser();

  async function submit() {
    await suspendMut.mutateAsync({ userId: user.id, reason: reason || undefined });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert size={20} className="text-red-500" />
          <h3 className="font-sora font-semibold text-primary">Suspend User</h3>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          This will deactivate <strong>{user.name}</strong> and revoke all active sessions. This action is logged.
        </p>
        <input
          type="text"
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={suspendMut.isPending}
            className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {suspendMut.isPending ? "Suspending…" : "Suspend"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserSearchSection() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [planModal, setPlanModal] = useState<AdminUser | null>(null);
  const [suspendModal, setSuspendModal] = useState<AdminUser | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(val: string) {
    setInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQ(val), 300);
  }

  const { data: users, isFetching } = useAdminUserSearch(q);

  return (
    <SectionCard title="User Search & Operations">
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name or email…"
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {isFetching && (
          <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
        )}
      </div>

      {q.length >= 2 && !users?.length && !isFetching && (
        <p className="text-sm text-slate-400 text-center py-4">No users found</p>
      )}

      {users && users.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-medium">User</th>
                <th className="pb-2 font-medium">Role / Plan</th>
                <th className="pb-2 font-medium">School</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-4">
                    <p className="font-medium text-primary">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="text-xs text-slate-600">{u.role}</span>
                    <span className="mx-1 text-slate-300">/</span>
                    <span className="text-xs font-medium text-accent">{u.plan}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-slate-500">{u.school ?? "—"}</td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs",
                        u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                      )}
                    >
                      {u.is_active ? "active" : "suspended"}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setPlanModal(u)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        Plan
                      </button>
                      {u.is_active && (
                        <button
                          onClick={() => setSuspendModal(u)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                        >
                          <ShieldAlert size={11} /> Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {planModal && <PlanModal user={planModal} onClose={() => setPlanModal(null)} />}
      {suspendModal && <SuspendModal user={suspendModal} onClose={() => setSuspendModal(null)} />}
    </SectionCard>
  );
}

// ─── Section 6: AI cost summary ───────────────────────────────────────────────

function AiCostSection() {
  const { data, isLoading } = useAiCosts();

  return (
    <SectionCard title="AI Cost Summary">
      {isLoading ? (
        <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
      ) : !data?.tracking_enabled ? (
        <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
          <DollarSign size={18} className="text-slate-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-700">Cost tracking not enabled</p>
            <p className="text-xs text-slate-400 mt-0.5">{data?.note}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">Total cost</p>
              <p className="text-2xl font-bold font-sora text-primary">
                ${data?.total_cost_usd?.toFixed(2) ?? "0.00"}
              </p>
            </div>
          </div>

          {(data?.daily_chart ?? []).length > 0 && (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.daily_chart ?? []}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [typeof v === "number" ? `$${v.toFixed(4)}` : v, "Cost"]} />
                  <Bar dataKey="cost_usd" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 7: Feature flags ─────────────────────────────────────────────────

function FeatureFlagsSection() {
  const { data: flags, isLoading } = useFeatureFlags();
  const updateMut = useUpdateFeatureFlag();
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function handleToggle(key: string, currentEnabled: boolean, plans: string[]) {
    if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key]);
    debounceRefs.current[key] = setTimeout(() => {
      updateMut.mutate({ key, enabled: !currentEnabled, enabled_for_plans: plans });
    }, 500);
  }

  return (
    <SectionCard title="Feature Flags">
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !flags?.length ? (
        <p className="text-sm text-slate-400 text-center py-6">No feature flags defined</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {flags.map((flag) => (
            <div key={flag.key} className="flex items-center justify-between py-3.5">
              <div className="flex-1 mr-4">
                <p className="text-sm font-medium text-primary">{flag.label}</p>
                {flag.description && (
                  <p className="text-xs text-slate-400 mt-0.5">{flag.description}</p>
                )}
                {flag.enabled_for_plans.length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {flag.enabled_for_plans.map((p) => (
                      <span key={p} className="px-1.5 py-0.5 rounded-full text-[10px] bg-accent/10 text-accent font-medium">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleToggle(flag.key, flag.enabled, flag.enabled_for_plans)}
                className="transition-colors"
                aria-label={flag.enabled ? "Disable flag" : "Enable flag"}
              >
                {flag.enabled ? (
                  <ToggleRight size={28} className="text-accent" />
                ) : (
                  <ToggleLeft size={28} className="text-slate-300" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────

export function HealthPageClient() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="font-sora text-2xl font-bold text-primary">Platform Health</h1>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
          Super Admin
        </span>
      </div>

      <ServiceStatusBar />
      <QueueDepthCards />
      <StuckFilesTable />
      <DlqTable />
      <UserSearchSection />
      <AiCostSection />
      <FeatureFlagsSection />
    </div>
  );
}
