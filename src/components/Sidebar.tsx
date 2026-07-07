import React from "react";
import {
  LayoutDashboard,
  Users,
  Wifi,
  Receipt,
  TrendingDown,
  Wrench,
  FileBarChart2,
  History,
  Activity,
  UserCheck,
  Signal,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { UserRole } from "../types";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: UserRole;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN"] },
  { id: "customers", label: "Customers", icon: Users, roles: ["ADMIN"] },
  { id: "plans", label: "Internet Plans", icon: Wifi, roles: ["ADMIN"] },
  { id: "billing", label: "Billing & Sales", icon: Receipt, roles: ["ADMIN"] },
  { id: "expenses", label: "Expenses", icon: TrendingDown, roles: ["ADMIN"] },
  { id: "technicians", label: "Technicians", icon: UserCheck, roles: ["ADMIN"] },
  { id: "tasks", label: "Repair Tasks", icon: Wrench, roles: ["ADMIN", "TECHNICIAN"] },
  { id: "reports", label: "Reports", icon: FileBarChart2, roles: ["ADMIN"] },
  { id: "logs", label: "Activity Logs", icon: History, roles: ["ADMIN"] },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  role,
  onLogout,
  isOpen = false,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const filteredItems = SIDEBAR_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className={`fixed bottom-0 left-0 top-0 z-50 flex flex-col border-r border-slate-800 bg-[#0c1222] transition-all duration-300 md:translate-x-0 ${
      isOpen ? "translate-x-0" : "-translate-x-full"
    } ${isCollapsed ? "w-20" : "w-64"}`}>
      
      {/* Collapse/Expand Toggle Button (Floating on edge) */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex absolute -right-3 top-6 z-50 h-6 w-6 items-center justify-center rounded-full border border-slate-800 bg-[#0c1222] text-slate-400 hover:text-slate-200 hover:bg-slate-800 hover:border-slate-700 shadow-lg transition-all duration-200 cursor-pointer"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      )}

      {/* Brand Logo Header */}
      <div className={`flex h-16 items-center border-b border-slate-800/60 px-4 relative ${
        isCollapsed ? "justify-center" : "justify-between px-6"
      }`}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
            <Signal className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col whitespace-nowrap animate-in fade-in duration-200">
              <span className="text-sm font-bold text-white tracking-tight leading-none">
                OptiFiber
              </span>
              <span className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-widest">
                ISP Portal
              </span>
            </div>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 md:hidden cursor-pointer"
            aria-label="Close Sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto">
        {!isCollapsed && (
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2 whitespace-nowrap animate-in fade-in duration-200">
            Navigation
          </div>
        )}
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex w-full items-center rounded-xl p-2.5 text-sm font-medium transition-all duration-150 cursor-pointer ${
                isCollapsed ? "justify-center" : "gap-3.5 px-3"
              } ${
                isActive
                  ? "bg-blue-500/10 text-blue-400 font-semibold"
                  : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-100"
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${
                  isActive ? "text-blue-400" : "text-slate-500"
                }`}
              />
              {!isCollapsed && (
                <span className="whitespace-nowrap animate-in fade-in duration-200">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-slate-800/60 shrink-0 text-center">
        {!isCollapsed && (
          <span className="text-[10px] text-slate-600 font-mono">
            OptiFiber Portal v1.0
          </span>
        )}
      </div>
    </aside>
  );
}
