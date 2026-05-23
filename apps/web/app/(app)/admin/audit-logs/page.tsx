"use client";

import { useState, useDeferredValue } from "react";
import { format } from "date-fns";
import { Download, ChevronDown, ChevronRight, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAuditLogs,
  type AuditLog,
  type AuditLogFilters,
} from "@/hooks/use-admin-health";

// ── constants ─────────────────────────────────────────────────────────────────

const RESOURCE_TYPES = ["user", "feature_flag", "system"] as const;

const ACTION_COLOR: Record<string, string> = {
  suspend_user: "bg-red-50 text-red-700",
  override_plan: "bg-amber-50 text-amber-700",
  update_feature_flag: "bg-blue-50 text-blue-700",
};

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCsv(logs: AuditLog[]) {
  const header = ["id", "timestamp", "actor_email", "action", "resource_type", "resource_id", "ip", "reason"];
  const rows = logs.map((l) => [
    l.id,
    l.created_at,
    l.actor_email ?? "",
    l.action,
    l.resource_type,
    l.resource_id ?? "",
    l.ip ?? "",
    l.reason ?? "",
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── expandable row ────────────────────────────────────────────────────────────

function LogRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const actionColor = ACTION_COLOR[log.action] ?? "bg-slate-100 text-slate-600";

  return (
    <>
      <tr
        className={cn("border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors", open && "bg-slate-50")}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap font-mono">
          {format(new Date(log.created_at), "dd MMM yyyy HH:mm:ss")}
        </td>
        <td className="px-4 py-3 text-sm text-slate-700 max-w-[160px] truncate">
          {log.actor_email ?? <span className="text-slate-400 text-xs">{log.actor_id.slice(0, 8)}…</span>}
        </td>
        <td className="px-4 py-3">
          <span className={cn("px-2 py-0.5 rounded text-[11px] font-medium", actionColor)}>
            {log.action}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-slate-500">{log.resource_type}</td>
        <td className="px-4 py-3 text-xs font-mono text-slate-500 truncate max-w-[120px]">
          {log.resource_id ?? "—"}
        </td>
        <td className="px-4 py-3 text-xs text-slate-400">{log.ip ?? "—"}</td>
        <td className="px-4 py-3 text-slate-400">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
      </tr>
      {open && (
        <tr className="bg-slate-50 border-b border-slate-100">
          <td colSpan={7} className="px-4 pb-4 pt-2">
            <div className="rounded-lg bg-slate-900 text-slate-100 p-4 text-xs font-mono overflow-x-auto">
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(
                  {
                    metadata: log.metadata,
                    reason: log.reason,
                    actor_id: log.actor_id,
                    resource_id: log.resource_id,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const [emailSearch, setEmailSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const deferredEmail = useDeferredValue(emailSearch);
  const deferredAction = useDeferredValue(actionFilter);

  const filters: AuditLogFilters = {
    actor_email: deferredEmail || undefined,
    action: deferredAction || undefined,
    resource_type: resourceTypeFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  };

  const { allLogs, total, isFetching, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useAuditLogs(filters);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-sora text-xl font-bold text-primary">Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total.toLocaleString()} events</p>
        </div>
        <button
          type="button"
          onClick={() => exportCsv(allLogs)}
          disabled={allLogs.length === 0}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={13} className="text-slate-400" />
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Email search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Actor email…"
              value={emailSearch}
              onChange={(e) => setEmailSearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>

          {/* Action filter */}
          <input
            type="text"
            placeholder="Action (e.g. suspend_user)…"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/40"
          />

          {/* Resource type dropdown */}
          <select
            value={resourceTypeFilter}
            onChange={(e) => setResourceTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/40 bg-white"
          >
            <option value="">All resource types</option>
            {RESOURCE_TYPES.map((rt) => (
              <option key={rt} value={rt}>{rt}</option>
            ))}
          </select>

          {/* Date from */}
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
        </div>

        {/* Clear filters */}
        {(emailSearch || actionFilter || resourceTypeFilter || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { setEmailSearch(""); setActionFilter(""); setResourceTypeFilter(""); setDateFrom(""); setDateTo(""); }}
            className="mt-2 text-xs text-accent hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isFetching && allLogs.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-400">Loading audit logs…</p>
          </div>
        ) : allLogs.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
            No audit log entries match these filters.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap">Timestamp</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Actor</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Action</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Resource type</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Resource ID</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">IP</th>
                    <th className="px-4 py-2.5 w-6" />
                  </tr>
                </thead>
                <tbody>
                  {allLogs.map((log) => (
                    <LogRow key={log.id} log={log} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load more */}
            {hasNextPage && (
              <div className="px-4 py-3 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="text-sm text-accent hover:underline disabled:opacity-50"
                >
                  {isFetchingNextPage ? "Loading…" : `Load more (${total - allLogs.length} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
