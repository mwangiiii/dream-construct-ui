import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import AdminLayout from "./components/layout/AdminLayout";
import Index from "./pages/Index";
import Services from "./pages/Services";
import Projects from "./pages/Projects";
import Team from "./pages/Team";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/admin/Dashboard";
import NotFound from "./pages/NotFound";

// Dashboard imports
import ClientDashboard from "./pages/dashboards/ClientDashboard";
import ManagerDashboard from "./pages/dashboards/ManagerDashboard";
import PMDashboard from "./pages/dashboards/PMDashboard";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import Users from "./pages/admin/Users";
import AdminProjects from "./pages/admin/Projects";
import HeroManagement from "./pages/admin/HeroManagement";
import Inquiries from "./pages/admin/Inquiries";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes with Main Layout */}
          <Route path="/" element={<MainLayout><Index /></MainLayout>} />
          <Route path="/services" element={<MainLayout><Services /></MainLayout>} />
          <Route path="/projects" element={<MainLayout><Projects /></MainLayout>} />
          <Route path="/team" element={<MainLayout><Team /></MainLayout>} />
          <Route path="/contact" element={<MainLayout><Contact /></MainLayout>} />
          
          {/* Auth Routes (No Layout) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Client Dashboard Routes */}
          <Route path="/client" element={<ClientDashboard />} />
          
          {/* Manager Dashboard Routes */}
          <Route path="/manager" element={<ManagerDashboard />} />
          
          {/* PM Dashboard Routes */}
          <Route path="/pm" element={<PMDashboard />} />
          
          {/* Admin Dashboard Routes */}
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          
          {/* Admin Routes with Admin Layout */}
          <Route path="/admin" element={<AdminLayout><Dashboard /></AdminLayout>} />
          <Route path="/admin/users" element={<AdminLayout><Users /></AdminLayout>} />
          <Route path="/admin/projects" element={<AdminLayout><AdminProjects /></AdminLayout>} />
          <Route path="/admin/hero" element={<AdminLayout><HeroManagement /></AdminLayout>} />
          <Route path="/admin/inquiries" element={<AdminLayout><Inquiries /></AdminLayout>} />
          
          {/* 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
