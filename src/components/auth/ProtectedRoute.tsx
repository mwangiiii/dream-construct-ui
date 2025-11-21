import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('admin' | 'manager' | 'project_manager' | 'client')[];
  redirectTo?: string;
}

const ProtectedRoute = ({ 
  children, 
  allowedRoles, 
  redirectTo = '/login' 
}: ProtectedRouteProps) => {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      // If not authenticated, redirect to login
      if (!user) {
        navigate(redirectTo, { replace: true });
        return;
      }

      // If role requirements exist, check if user has permission
      if (allowedRoles && allowedRoles.length > 0) {
        if (!userRole || !allowedRoles.includes(userRole as any)) {
          // Redirect based on user role
          const roleRedirects: Record<string, string> = {
            admin: '/admin',
            manager: '/manager/dashboard',
            project_manager: '/pm/dashboard',
            client: '/client/dashboard',
          };
          
          const defaultRedirect = userRole ? roleRedirects[userRole] || '/' : '/';
          navigate(defaultRedirect, { replace: true });
        }
      }
    }
  }, [user, loading, userRole, allowedRoles, navigate, redirectTo]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user) {
    return null;
  }

  // Don't render if role check fails
  if (allowedRoles && allowedRoles.length > 0) {
    if (!userRole || !allowedRoles.includes(userRole as any)) {
      return null;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
