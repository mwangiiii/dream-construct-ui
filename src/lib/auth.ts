import { supabase } from './supabaseClient';

// ============================================
// Type Definitions
// ============================================
export interface SignupData {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  companyName?: string;
  jobTitle?: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  company_name: string | null;
  job_title: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  role_name: 'admin' | 'manager' | 'project_manager' | 'client';
  description: string | null;
}

export interface UserStatus {
  status: 'active' | 'inactive' | 'suspended' | 'pending' | 'archived';
  status_changed_at: string;
  status_changed_by: string | null;
  status_reason: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: UserProfile;
  roles: UserRole[];
  status: UserStatus;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get user's complete profile including roles and status
 */
export async function getUserFullProfile(userId: string): Promise<AuthUser | null> {
  try {
    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      throw profileError;
    }

    // Fetch roles - corrected query based on your schema
    // user_roles has: user_id (uuid), role_id (app_role enum)
    // We need to join with roles table to get full role info
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles!inner (
          role_name,
          description
        )
      `)
      .eq('user_id', userId);

    if (rolesError) {
      console.error('Roles fetch error:', rolesError);
      throw rolesError;
    }

    // Fetch status
    const { data: status, error: statusError } = await supabase
      .from('user_statuses')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (statusError) {
      console.error('Status fetch error:', statusError);
      throw statusError;
    }

    // Transform roles data
    const roles: UserRole[] = userRoles?.map((ur: any) => ({
      role_name: ur.roles.role_name,
      description: ur.roles.description,
    })) || [];

    // Get user email from auth
    const { data: { user } } = await supabase.auth.getUser();

    return {
      id: userId,
      email: user?.email || profile.id || '',
      profile,
      roles,
      status,
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Get the primary role for dashboard routing
 * Priority: admin > manager > project_manager > client
 */
export function getPrimaryRole(roles: UserRole[]): UserRole['role_name'] {
  const rolePriority: UserRole['role_name'][] = ['admin', 'manager', 'project_manager', 'client'];
  
  for (const priority of rolePriority) {
    if (roles.some(role => role.role_name === priority)) {
      return priority;
    }
  }
  
  return 'client'; // Default fallback
}

/**
 * Get dashboard route based on user role
 */
export function getDashboardRoute(roles: UserRole[]): string {
  const primaryRole = getPrimaryRole(roles);
  
  const routeMap: Record<UserRole['role_name'], string> = {
    admin: '/admin/dashboard',
    manager: '/manager/dashboard',
    project_manager: '/projects/dashboard',
    client: '/client/dashboard',
  };
  
  return routeMap[primaryRole] || '/client/dashboard';
}

// ============================================
// Authentication Functions
// ============================================

/**
 * Sign up a new user with complete profile setup
 */
export async function signUp(data: SignupData) {
  try {
    // 1. Sign up user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { 
          full_name: data.fullName 
        },
      },
    });

    if (authError) throw authError;
    
    const user = authData.user;
    if (!user) throw new Error('User not returned from signUp');

    const userId = user.id;

    // 2. Insert into profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name: data.fullName,
        phone: data.phone || null,
        company_name: data.companyName || null,
        job_title: data.jobTitle || null,
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      throw new Error('Failed to create user profile');
    }

    // 3. Assign default role (client) in user_roles
    // Note: role_id is an app_role enum, not a foreign key to roles table
    const { error: userRoleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: 'client', // Direct enum value
        assigned_by: null,
      });

    if (userRoleError) {
      console.error('User role assignment error:', userRoleError);
      throw new Error('Failed to assign user role');
    }

    // 4. Set user status to 'active'
    const { error: statusError } = await supabase
      .from('user_statuses')
      .insert({
        user_id: userId,
        status: 'active',
        status_changed_by: null,
        status_reason: 'New user registration',
      });

    if (statusError) {
      console.error('Status creation error:', statusError);
      throw new Error('Failed to set user status');
    }

    return {
      success: true,
      user: authData.user,
      session: authData.session,
    };
  } catch (error: any) {
    console.error('Sign up error:', error);
    throw new Error(error.message || 'Sign up failed');
  }
}

/**
 * Sign in a user and return complete profile with role-based routing
 */
export async function signIn({ 
  email, 
  password 
}: { 
  email: string; 
  password: string; 
}) {
  try {
    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Authentication failed');

    // 2. Fetch complete user profile with roles and status
    const userProfile = await getUserFullProfile(authData.user.id);
    
    if (!userProfile) {
      throw new Error('Failed to load user profile');
    }

    // 3. Check if user status is active
    if (userProfile.status.status !== 'active') {
      await supabase.auth.signOut();
      
      const statusMessages: Record<string, string> = {
        inactive: 'Your account is inactive. Please contact support.',
        suspended: 'Your account has been suspended. Please contact support.',
        pending: 'Your account is pending approval. Please wait for administrator approval.',
        archived: 'Your account has been archived. Please contact support to reactivate.',
      };
      
      const message = statusMessages[userProfile.status.status] || 
                     `Account is ${userProfile.status.status}. ${userProfile.status.status_reason || 'Please contact support.'}`;
      
      throw new Error(message);
    }

    // 4. Check if user has at least one role assigned
    if (userProfile.roles.length === 0) {
      await supabase.auth.signOut();
      throw new Error('No roles assigned. Please contact an administrator.');
    }

    // 5. Return complete authentication data with dashboard route
    return {
      success: true,
      user: userProfile,
      session: authData.session,
      dashboardRoute: getDashboardRoute(userProfile.roles),
      primaryRole: getPrimaryRole(userProfile.roles),
    };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw new Error(error.message || 'Sign in failed');
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    return { success: true };
  } catch (error: any) {
    console.error('Sign out error:', error);
    throw new Error(error.message || 'Sign out failed');
  }
}

/**
 * Get current session
 */
export async function getSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error) {
    console.error('Get session error:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session;
}

/**
 * Get current authenticated user with full profile
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) return null;
    
    return await getUserFullProfile(user.id);
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * Refresh user session
 */
export async function refreshSession() {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    return data.session;
  } catch (error) {
    console.error('Refresh session error:', error);
    return null;
  }
}

/**
 * Update user password
 */
export async function updatePassword(newPassword: string) {
  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    
    if (error) throw error;
    
    return { success: true, user: data.user };
  } catch (error: any) {
    console.error('Update password error:', error);
    throw new Error(error.message || 'Failed to update password');
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    
    if (error) throw error;
    
    return { success: true };
  } catch (error: any) {
    console.error('Reset password error:', error);
    throw new Error(error.message || 'Failed to send reset email');
  }
}