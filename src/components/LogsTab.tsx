import React, { useState } from "react";
import { History, Search, ShieldCheck, Filter, Calendar, Cpu, Smartphone, Monitor } from "lucide-react";
import { AppState, ActivityLog, AuditRecord } from "../types";

interface LogsTabProps {
  state: AppState;
}

export default function LogsTab({ state }: LogsTabProps) {
  const [subTab, setSubTab] = useState<"activity" | "audit">("activity");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [timeFilter, setTimeFilter] = useState<string>("All"); // All, Today, Last 7, Last 30

  // Date filtering logic helpers
  const matchesTime = (timestampStr: string) => {
    if (timeFilter === "All") return true;

    const date = new Date(timestampStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (timeFilter === "Today") {
      return date.toDateString() === now.toDateString();
    }
    if (timeFilter === "7Days") {
      return diffDays <= 7;
    }
    if (timeFilter === "30Days") {
      return diffDays <= 30;
    }
    return true;
  };

  // Filter activities
  const filteredActivities = state.activityLogs.filter((log) => {
    const matchesSearch =
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.affectedRecord.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "All" || log.role === roleFilter;
    const matchesDate = matchesTime(log.timestamp);

    return matchesSearch && matchesRole && matchesDate;
  });

  // Filter audits
  const filteredAudits = state.auditRecords.filter((aud) => {
    const matchesSearch =
      aud.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      aud.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      aud.previousValue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      aud.newValue.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDate = matchesTime(aud.timestamp);

    return matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            <History className="h-5 w-5 text-blue-400" />
            Audit Trails & Logs
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time tracking of administrative interventions, payment post logs, and field engineer activities.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-slate-900/40 border border-slate-800 p-1 self-start">
          <button
            onClick={() => setSubTab("activity")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              subTab === "activity"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Activity Feed
          </button>
          <button
            onClick={() => setSubTab("audit")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              subTab === "audit"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Security Audit Trail
          </button>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/20 p-4 shadow-sm flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder={
              subTab === "activity"
                ? "Search by action, operator, affected record..."
                : "Search by changes, operator, parameters..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900/40 py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none focus:border-blue-500/60 focus:bg-slate-900/70 placeholder:text-slate-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {subTab === "activity" && (
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
            >
              <option value="All">All Roles</option>
              <option value="Administrator">Administrator</option>
              <option value="Technician">Technician</option>
            </select>
          )}

          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500/60"
          >
            <option value="All">All Timeframes</option>
            <option value="Today">Today</option>
            <option value="7Days">Last 7 Days</option>
            <option value="30Days">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Dynamic List */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c1222]/30 shadow-sm overflow-hidden">
        {subTab === "activity" ? (
          /* SYSTEM ACTIVITY FEED TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Operator</th>
                  <th className="px-6 py-4">User Role</th>
                  <th className="px-6 py-4">Action Event</th>
                  <th className="px-6 py-4">Affected Record</th>
                  <th className="px-6 py-4">IP Address & Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                      No system logs found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-800/10 transition-colors duration-150"
                    >
                      {/* Timestamp */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleString("en-US", {
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      {/* User */}
                      <td className="px-6 py-4 font-semibold text-slate-200">
                        {log.user}
                      </td>
                      {/* Role */}
                      <td className="px-6 py-4">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xxs font-bold uppercase tracking-wider ${
                          log.role === "Administrator"
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/10"
                            : "bg-orange-500/20 text-orange-400 border border-orange-500/10"
                        }`}>
                          {log.role}
                        </span>
                      </td>
                      {/* Action */}
                      <td className="px-6 py-4 font-medium text-slate-300">
                        {log.action}
                      </td>
                      {/* Affected Record */}
                      <td className="px-6 py-4 font-mono text-xs text-blue-400 font-bold">
                        {log.affectedRecord}
                      </td>
                      {/* IP and device icon */}
                      <td className="px-6 py-4 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                          {log.device.toLowerCase().includes("iphone") || log.device.toLowerCase().includes("pixel") ? (
                            <Smartphone className="h-3.5 w-3.5 text-slate-600" />
                          ) : log.device.toLowerCase().includes("automated") ? (
                            <Cpu className="h-3.5 w-3.5 text-slate-600 animate-spin" />
                          ) : (
                            <Monitor className="h-3.5 w-3.5 text-slate-600" />
                          )}
                          <span className="truncate max-w-xxs" title={log.device}>
                            {log.ipAddress} • {log.device.split(" / ")[0]}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* SECURITY AUDIT TRAIL TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Operator</th>
                  <th className="px-6 py-4">Intervention Change</th>
                  <th className="px-6 py-4">Previous State</th>
                  <th className="px-6 py-4">New Modified State</th>
                  <th className="px-6 py-4">Device / Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredAudits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                      No security audits recorded for this time range.
                    </td>
                  </tr>
                ) : (
                  filteredAudits.map((aud) => (
                    <tr
                      key={aud.id}
                      className="hover:bg-slate-800/10 transition-colors duration-150"
                    >
                      {/* Timestamp */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                        {new Date(aud.timestamp).toLocaleString("en-US", {
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      {/* User */}
                      <td className="px-6 py-4 font-bold text-slate-200">
                        {aud.user}
                      </td>
                      {/* Action */}
                      <td className="px-6 py-4 text-xs font-semibold text-slate-300">
                        <span className="flex items-center gap-1.5 pt-1">
                          <ShieldCheck className="h-4 w-4 text-green-400 shrink-0" />
                          {aud.action}
                        </span>
                      </td>
                      {/* Prev */}
                      <td className="px-6 py-4 max-w-xs">
                        <span className="font-mono text-xs bg-red-500/15 text-red-400 rounded-lg px-2 py-1 border border-red-500/25 block truncate">
                          {aud.previousValue}
                        </span>
                      </td>
                      {/* New */}
                      <td className="px-6 py-4 max-w-xs">
                        <span className="font-mono text-xs bg-green-500/15 text-green-400 rounded-lg px-2 py-1 border border-green-500/25 block truncate">
                          {aud.newValue}
                        </span>
                      </td>
                      {/* Device */}
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {aud.device}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
