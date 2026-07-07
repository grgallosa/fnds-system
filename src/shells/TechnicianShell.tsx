import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import TasksTab from "../components/TasksTab";
import { useAuth } from "../context/AuthContext";
import { useAppData } from "../hooks/useAppData";

// This shell intentionally does NOT import CustomersTab, PlansTab, BillingTab,
// ExpensesTab, TechniciansTab, ReportsTab, or LogsTab - a technician session
// never even downloads that code, let alone renders it. Combined with the
// server-side role checks in every API route, this is the real separation
// the client-side role toggle used to fake.
export default function TechnicianShell() {
  const { user, logout } = useAuth();
  const data = useAppData();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#070b15] text-slate-100 font-sans antialiased overflow-x-hidden">
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        activeTab="tasks"
        setActiveTab={() => {}}
        role="TECHNICIAN"
        onLogout={logout}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="pl-0 md:pl-64 flex flex-col min-h-screen transition-all duration-300">
        <Header
          state={data.state}
          currentUsername={user?.username}
          onLogout={logout}
          onSearchSelect={() => {}}
          onMarkNotificationRead={data.markNotificationRead}
          onClearAllNotifications={data.clearAllNotifications}
          onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          isDbConnected={data.isConnected}
          isDbLoading={data.isLoading}
        />

        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto pb-16">
          <TasksTab
            state={data.state}
            onAddTask={data.addTask}
            onUpdateTaskStatus={data.updateTaskStatus}
            onAddTaskCompletion={data.addTaskCompletion}
            onAddTaskNote={data.addTaskNote}
          />
        </main>
      </div>
    </div>
  );
}
