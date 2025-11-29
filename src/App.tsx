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
// import Contact from "./pages/contact;
import Contact from "@/pages/contact";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/admin/Dashboard";
import AdminUserCreate from "./pages/admin/UserCreate";
import NotFound from "./pages/NotFound";

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
          
          {/* Admin Routes with Admin Layout */}
          <Route path="/admin" element={<AdminLayout><Dashboard /></AdminLayout>} />
          <Route path="/admin/users" element={<AdminLayout><div className="p-8"><h1 className="text-4xl font-bold">Users Management</h1><p className="text-muted-foreground mt-2">Manage users, roles, and permissions</p></div></AdminLayout>} />
          <Route path="/admin/users/create" element={<AdminLayout><AdminUserCreate /></AdminLayout>} />
          <Route path="/admin/projects" element={<AdminLayout><div className="p-8"><h1 className="text-4xl font-bold">Projects Management</h1><p className="text-muted-foreground mt-2">Oversee all construction projects</p></div></AdminLayout>} />
          <Route path="/admin/content" element={<AdminLayout><div className="p-8"><h1 className="text-4xl font-bold">Content Management</h1><p className="text-muted-foreground mt-2">Update website content and media</p></div></AdminLayout>} />
          <Route path="/admin/settings" element={<AdminLayout><div className="p-8"><h1 className="text-4xl font-bold">Settings</h1><p className="text-muted-foreground mt-2">Configure system settings</p></div></AdminLayout>} />
          
          {/* 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
