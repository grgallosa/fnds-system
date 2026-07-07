import React, { Suspense, lazy } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";

// Real code-splitting: an admin session never downloads technician-only
// code and vice versa (there isn't any technician-only code besides
// TasksTab, but this pattern is what actually enforces the separation
// the old client-side role toggle only pretended to).
const AdminShell = lazy(() => import("./shells/AdminShell"));
const TechnicianShell = lazy(() => import("./shells/TechnicianShell"));

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070b15] text-slate-400 text-sm">
      Loading...
    </div>
  );
}

function AuthGate() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <LoginPage />;

  return (
    <Suspense fallback={<LoadingScreen />}>
      {user.role === "ADMIN" ? <AdminShell /> : <TechnicianShell />}
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
