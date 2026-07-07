import React, { useState, useRef, useEffect } from "react";
import { Search, Shield, HardHat, X, Menu, LogOut } from "lucide-react";
import { AppState } from "../types";

interface HeaderProps {
  state: AppState;
  currentUsername?: string;
  onLogout: () => void;
  onSearchSelect: (type: string, id: string) => void;
  onMarkNotificationRead: (id: string) => void;
  onClearAllNotifications: () => void;
  onToggleSidebar?: () => void;
  isDbConnected?: boolean;
  isDbLoading?: boolean;
}

export default function Header({
  state,
  currentUsername,
  onLogout,
  onSearchSelect,
  onMarkNotificationRead,
  onClearAllNotifications,
  onToggleSidebar,
  isDbConnected = false,
  isDbLoading = false,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);

  // Close search popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search indexing
  const getSearchResults = () => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results: { type: string; label: string; sub: string; id: string }[] = [];

    // Search Customers
    state.customers.forEach((c) => {
      if (
        c.fullName.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.contactNumber.toLowerCase().includes(query)
      ) {
        results.push({
          type: "Customer",
          label: c.fullName,
          sub: `${c.id} • ${c.status}`,
          id: c.id,
        });
      }
    });

    // Search Invoices
    state.invoices.forEach((i) => {
      if (
        i.id.toLowerCase().includes(query) ||
        i.invoiceNumber.toLowerCase().includes(query) ||
        i.customerName.toLowerCase().includes(query)
      ) {
        results.push({
          type: "Invoice",
          label: i.invoiceNumber,
          sub: `${i.customerName} • ₱${i.amount} • ${i.status}`,
          id: i.id,
        });
      }
    });

    // Search Repair Tasks
    state.tasks.forEach((t) => {
      if (
        t.id.toLowerCase().includes(query) ||
        t.customerName.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
      ) {
        results.push({
          type: "Task",
          label: t.id,
          sub: `${t.customerName} • ${t.priority} Priority • ${t.status}`,
          id: t.id,
        });
      }
    });

    // Search Plans
    state.plans.forEach((p) => {
      if (p.name.toLowerCase().includes(query) || p.speed.toLowerCase().includes(query)) {
        results.push({
          type: "Plan",
          label: p.name,
          sub: `${p.speed} • ₱${p.monthlyPrice}/mo`,
          id: p.id,
        });
      }
    });

    // Search Expenses
    if (state.role === "ADMIN") {
      state.expenses.forEach((e) => {
        if (
          e.category.toLowerCase().includes(query) ||
          e.vendor.toLowerCase().includes(query) ||
          e.description.toLowerCase().includes(query)
        ) {
          results.push({
            type: "Expense",
            label: e.category,
            sub: `₱${e.amount} • ${e.vendor} • ${e.date}`,
            id: e.id,
          });
        }
      });
    }

    return results.slice(0, 6);
  };

  const results = getSearchResults();

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-800 bg-[#0a0f1d]/80 backdrop-blur px-4 md:px-6 shadow-sm">
      {/* Left side: Navigation / Breadcrumb or Search */}
      <div className="flex flex-1 items-center gap-2 md:gap-4">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 md:hidden cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        
        <div ref={searchRef} className="relative w-full max-w-md hidden md:block">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-slate-500" />
          </div>
          <input
            type="search"
            placeholder="Search customers, invoices, tasks, plans..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
            className="w-full rounded-full border border-slate-800 bg-slate-900/40 py-2 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all duration-150 placeholder:text-slate-500 focus:border-blue-500/60 focus:bg-slate-900/70 focus:ring-2 focus:ring-blue-500/10"
          />

          {/* Search Dropdown */}
          {showSearchResults && results.length > 0 && (
            <div className="absolute left-0 mt-2 w-full rounded-2xl border border-slate-800 bg-[#0c111d] p-2 shadow-2xl shadow-black/60">
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Matches Found
              </div>
              <div className="mt-1 divide-y divide-slate-800/40 max-h-80 overflow-y-auto">
                {results.map((res, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onSearchSelect(res.type, res.id);
                      setSearchQuery("");
                      setShowSearchResults(false);
                    }}
                    className="flex w-full flex-col items-start px-3 py-2.5 text-left rounded-xl hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-sm font-medium text-slate-200">
                        {res.label}
                      </span>
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xxs font-semibold text-blue-400 uppercase">
                        {res.type}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5">{res.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showSearchResults && searchQuery && results.length === 0 && (
            <div className="absolute left-0 mt-2 w-full rounded-2xl border border-slate-800 bg-[#0c111d] p-4 text-center shadow-2xl text-sm text-slate-400">
              No results match "{searchQuery}"
            </div>
          )}
        </div>
      </div>

      {/* Right side: Role Switcher, Notifications, User Profile */}
      <div className="flex items-center gap-1.5 md:gap-4 shrink-0">
        {/* Firebase Status Badge */}
        <div className="hidden sm:block">
          {isDbLoading ? (
            <span className="flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2.5 py-1 text-[10px] font-semibold text-yellow-500 border border-yellow-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
              Connecting...
            </span>
          ) : isDbConnected ? (
            <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-semibold text-green-400 border border-green-500/20" title="State synchronized in real-time with Firestore">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Firestore Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold text-red-400 border border-red-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Offline Cache
            </span>
          )}
        </div>

        {/* Logged-in role badge - reflects the server-verified session, not a toggle */}
        <div className="flex items-center gap-1 rounded-full border border-slate-800 bg-[#070b14] px-2.5 py-1 shrink-0">
          {state.role === "ADMIN" ? (
            <Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-400" />
          ) : (
            <HardHat className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-400" />
          )}
          <span className="text-[10px] sm:text-xs font-semibold text-blue-400">
            {state.role === "ADMIN" ? "Admin" : "Technician"}
          </span>
        </div>

        {/* User Identity + Logout */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 font-bold text-blue-400 text-sm border border-blue-500/20">
            {(currentUsername || "U").slice(0, 2).toUpperCase()}
          </div>
          <button
            onClick={onLogout}
            title="Log out"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
