import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Services from "./pages/Services";
import Projects from "./pages/Projects";
import Team from "./pages/Team";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";
import MainLayout from "./components/layout/MainLayout";
import AdminLayout from "./components/layout/AdminLayout";
import ClientDashboard from "./pages/dashboards/ClientDashboard";
import ManagerDashboard from "./pages/dashboards/ManagerDashboard";
import PMDashboard from "./pages/dashboards/PMDashboard";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import AdminProjects from "./pages/admin/Projects";
import AdminUsers from "./pages/admin/Users";
import AdminInquiries from "./pages/admin/Inquiries";
import AdminHeroManagement from "./pages/admin/HeroManagement";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<MainLayout><Index /></MainLayout>} />
            <Route path="/services" element={<MainLayout><Services /></MainLayout>} />
            <Route path="/projects" element={<MainLayout><Projects /></MainLayout>} />
            <Route path="/team" element={<MainLayout><Team /></MainLayout>} />
            <Route path="/contact" element={<MainLayout><Contact /></MainLayout>} />

            {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/change-password" element={<ChangePassword />} />

            {/* Dashboard Routes - Protected */}
            <Route 
              path="/client/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['client', 'admin']}>
                  <ClientDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/manager/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['manager', 'admin']}>
                  <ManagerDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/pm/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['project_manager', 'admin']}>
                  <PMDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/pm/project/:id" 
              element={
                <ProtectedRoute allowedRoles={['project_manager', 'admin']}>
                  <PMDashboard />
                </ProtectedRoute>
              } 
            />

            {/* Admin Routes - Protected */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout><AdminDashboard /></AdminLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/users" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout><AdminUsers /></AdminLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/projects" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout><AdminProjects /></AdminLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/inquiries" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout><AdminInquiries /></AdminLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/hero-management" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout><AdminHeroManagement /></AdminLayout>
                </ProtectedRoute>
              } 
            />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
