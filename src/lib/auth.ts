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
  status_id: number;
  last_sign_in_at: string | null;
  company_id: string | null;
}

export interface UserRole {
  role_name: 'admin' | 'manager' | 'project_manager' | 'client';
  description: string | null;
  assigned_at: string;
}

export interface UserStatus {
  status_id: number;
  status_name: string;
  is_active: boolean;
  description: string | null;
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
    // Fetch profile with status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        *,
        user_statuses (
          status_id,
          status_name,
          is_active,
          description
        )
      `)
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      throw profileError;
    }

    // Fetch roles - user_roles has role_name (app_role enum), not role_id
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select(`
        role_name,
        assigned_at,
        roles (
          role_name,
          description
        )
      `)
      .eq('user_id', userId);

    if (rolesError) {
      console.error('Roles fetch error:', rolesError);
      throw rolesError;
    }

    // Transform roles data
    const roles: UserRole[] = userRoles?.map((ur: any) => ({
      role_name: ur.role_name,
      description: ur.roles?.description || null,
      assigned_at: ur.assigned_at,
    })) || [];

    // Get user email from auth
    const { data: { user } } = await supabase.auth.getUser();

    // Extract status from profile
    const status: UserStatus = profile.user_statuses || {
      status_id: profile.status_id,
      status_name: 'active',
      is_active: true,
      description: null,
    };

    return {
      id: userId,
      email: user?.email || '',
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        phone: profile.phone,
        company_name: profile.company_name,
        job_title: profile.job_title,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        status_id: profile.status_id,
        last_sign_in_at: profile.last_sign_in_at,
        company_id: profile.company_id,
      },
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
    admin: '/admin',
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

    // 2. Insert into profiles table (status_id defaults to 1 which should be 'active')
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name: data.fullName,
        phone: data.phone || null,
        company_name: data.companyName || null,
        job_title: data.jobTitle || null,
        status_id: 1, // Default to active status
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      throw new Error('Failed to create user profile');
    }

    // 3. Assign default role (client) in user_roles
    // user_roles has: user_id, role_name (app_role enum), assigned_at, assigned_by
    const { error: userRoleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role_name: 'client', // Direct enum value
        assigned_by: null,
      });

    if (userRoleError) {
      console.error('User role assignment error:', userRoleError);
      throw new Error('Failed to assign user role');
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

    // 2. Update last_sign_in_at
    await supabase
      .from('profiles')
      .update({ last_sign_in_at: new Date().toISOString() })
      .eq('id', authData.user.id);

    // 3. Fetch complete user profile with roles and status
    const userProfile = await getUserFullProfile(authData.user.id);
    
    if (!userProfile) {
      throw new Error('Failed to load user profile');
    }

    // 4. Check if user status is active
    if (!userProfile.status.is_active) {
      await supabase.auth.signOut();
      throw new Error(
        `Your account status is "${userProfile.status.status_name}". ${
          userProfile.status.description || 'Please contact support.'
        }`
      );
    }

    // 5. Check if user has at least one role assigned
    if (userProfile.roles.length === 0) {
      await supabase.auth.signOut();
      throw new Error('No roles assigned. Please contact an administrator.');
    }

    // 6. Return complete authentication data with dashboard route
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

/**
 * Update user profile
 */
export async function updateProfile(userId: string, updates: Partial<UserProfile>) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, profile: data };
  } catch (error: any) {
    console.error('Update profile error:', error);
    throw new Error(error.message || 'Failed to update profile');
  }
}