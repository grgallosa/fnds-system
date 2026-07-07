import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import DashboardTab from "../components/DashboardTab";
import CustomersTab from "../components/CustomersTab";
import PlansTab from "../components/PlansTab";
import BillingTab from "../components/BillingTab";
import ExpensesTab from "../components/ExpensesTab";
import TechniciansTab from "../components/TechniciansTab";
import TasksTab from "../components/TasksTab";
import LogsTab from "../components/LogsTab";
import ReportsTab from "../components/ReportsTab";
import { useAuth } from "../context/AuthContext";
import { useAppData } from "../hooks/useAppData";
import { Customer } from "../types";

export default function AdminShell() {
  const { user, logout } = useAuth();
  const data = useAppData();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem("optifiber_sidebar_collapsed") === "true";
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    localStorage.setItem("optifiber_sidebar_collapsed", String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  React.useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [activeTab]);

  const handleTriggerTaskForCustomer = (_cust: Customer) => {
    setActiveTab("tasks");
  };

  const handleGlobalSearchSelect = (type: string, id: string) => {
    if (type === "Customer") {
      setActiveTab("customers");
      setSelectedCustomerId(id);
    } else if (type === "Task") {
      setActiveTab("tasks");
      setSelectedTaskId(id);
    } else if (type === "Invoice") {
      setActiveTab("billing");
    } else if (type === "Plan") {
      setActiveTab("plans");
    } else if (type === "Expense") {
      setActiveTab("expenses");
    }
  };

  return (
    <div className="min-h-screen bg-[#070b15] text-slate-100 font-sans antialiased overflow-x-hidden">
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role="ADMIN"
        onLogout={logout}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className={`pl-0 ${isSidebarCollapsed ? "md:pl-20" : "md:pl-64"} flex flex-col min-h-screen transition-all duration-300`}>
        <Header
          state={data.state}
          currentUsername={user?.username}
          onLogout={logout}
          onSearchSelect={handleGlobalSearchSelect}
          onMarkNotificationRead={data.markNotificationRead}
          onClearAllNotifications={data.clearAllNotifications}
          onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          isDbConnected={data.isConnected}
          isDbLoading={data.isLoading}
        />

        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto pb-16">
          {activeTab === "dashboard" && (
            <DashboardTab
              state={data.state}
              billingSummary={data.billingSummary}
              onNavigateToTab={setActiveTab}
              onOpenCustomer={(id) => {
                setActiveTab("customers");
                setSelectedCustomerId(id);
              }}
              onOpenTask={(id) => {
                setActiveTab("tasks");
                setSelectedTaskId(id);
              }}
            />
          )}

          {activeTab === "customers" && (
            <CustomersTab
              state={data.state}
              onAddCustomer={data.addCustomer}
              onUpdateCustomer={data.updateCustomer}
              onAddTimelineEvent={data.addTimelineEvent}
              onTriggerTaskForCustomer={handleTriggerTaskForCustomer}
              onDeleteCustomer={data.deleteCustomer}
              selectedCustomerId={selectedCustomerId}
              onCloseDetailView={() => setSelectedCustomerId(undefined)}
            />
          )}

          {activeTab === "plans" && (
            <PlansTab
              state={data.state}
              onAddPlan={data.addPlan}
              onUpdatePlan={data.updatePlan}
              onDeletePlan={data.deletePlan}
            />
          )}

          {activeTab === "billing" && (
            <BillingTab
              state={data.state}
              onAddInvoice={data.addInvoice}
              onRecordPayment={data.recordPayment}
              onCancelInvoice={data.cancelInvoice}
              onGenerateMonthlyInvoices={data.generateMonthlyInvoices}
            />
          )}

          {activeTab === "expenses" && (
            <ExpensesTab state={data.state} onAddExpense={data.addExpense} />
          )}

          {activeTab === "technicians" && (
            <TechniciansTab
              state={data.state}
              onAddTechnician={data.addTechnician}
              onUpdateTechnicianStatus={data.updateTechnicianStatus}
              onUpdateTechnician={data.updateTechnician}
              onSetTechnicianCredentials={data.setTechnicianCredentials}
            />
          )}

          {activeTab === "tasks" && (
            <TasksTab
              state={data.state}
              onAddTask={data.addTask}
              onUpdateTaskStatus={data.updateTaskStatus}
              onAddTaskCompletion={data.addTaskCompletion}
              onEditTask={data.updateTask}
              onDeleteTask={data.deleteTask}
              selectedTaskId={selectedTaskId}
              onCloseDetailView={() => setSelectedTaskId(undefined)}
            />
          )}

          {activeTab === "reports" && <ReportsTab state={data.state} />}

          {activeTab === "logs" && <LogsTab state={data.state} />}
        </main>
      </div>
    </div>
  );
}
