// lib/auth.ts
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
// Core: Reliable User & Session Handling (FIXED)
// ============================================

/**
 * Get current authenticated user with full profile
 * FIXED: Now reliably detects logged-in state even after page refresh
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    // Step 1: Get session first — this restores from localStorage reliably
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session error:', sessionError);
      return null;
    }

    if (!session?.user) {
      return null;
    }

    // Step 2: Fetch full profile using valid user ID
    const userProfile = await getUserFullProfile(session.user.id);

    if (!userProfile) {
      console.warn('Session exists but profile not found');
      return null;
    }

    // Optional: Enforce active status
    if (!userProfile.status.is_active) {
      console.warn('Inactive user attempted access:', userProfile.status.status_name);
      await supabase.auth.signOut();
      return null;
    }

    return userProfile;
  } catch (error) {
    console.error('getCurrentUser failed:', error);
    return null;
  }
}

/**
 * Fetch complete user profile including roles and status
 */
export async function getUserFullProfile(userId: string): Promise<AuthUser | null> {
  try {
    // Get email from auth (safe fallback)
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email || '';

    // Fetch profile + status
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

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return null;
    }

    // Fetch roles
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
      return null;
    }

    const roles: UserRole[] = (userRoles || []).map((ur: any) => ({
      role_name: ur.role_name,
      description: ur.roles?.description || null,
      assigned_at: ur.assigned_at,
    }));

    const status: UserStatus = profile.user_statuses || {
      status_id: profile.status_id,
      status_name: 'active',
      is_active: true,
      description: null,
    };

    return {
      id: userId,
      email,
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
    console.error('getUserFullProfile error:', error);
    return null;
  }
}

// ============================================
// Dashboard Routing
// ============================================

export function getPrimaryRole(roles: UserRole[]): UserRole['role_name'] {
  const priority: UserRole['role_name'][] = ['admin', 'manager', 'project_manager', 'client'];
  for (const role of priority) {
    if (roles.some(r => r.role_name === role)) return role;
  }
  return 'client';
}

export function getDashboardRoute(roles: UserRole[]): string {
  const role = getPrimaryRole(roles);
  const map: Record<UserRole['role_name'], string> = {
    admin: '/admin',
    manager: '/manager/dashboard',
    project_manager: '/projects/dashboard',
    client: '/client/dashboard',
  };
  return map[role] || '/client/dashboard';
}

// ============================================
// Authentication Functions
// ============================================

export async function signIn({ email, password }: { email: string; password: string }) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) throw error || new Error('Login failed');

    // Update last sign in
    await supabase
      .from('profiles')
      .update({ last_sign_in_at: new Date().toISOString() })
      .eq('id', data.user.id);

    const userProfile = await getCurrentUser();

    if (!userProfile) throw new Error('Failed to load user profile');
    if (!userProfile.status.is_active) {
      await supabase.auth.signOut();
      throw new Error(`Account is ${userProfile.status.status_name}. Contact support.`);
    }
    if (userProfile.roles.length === 0) {
      await supabase.auth.signOut();
      throw new Error('No roles assigned. Contact administrator.');
    }

    return {
      success: true,
      user: userProfile,
      session: data.session,
      dashboardRoute: getDashboardRoute(userProfile.roles),
      primaryRole: getPrimaryRole(userProfile.roles),
    };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw new Error(error.message || 'Sign in failed');
  }
}

export async function signUp(data: SignupData) {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.fullName },
      },
    });

    if (authError || !authData.user) throw authError || new Error('Signup failed');

    const userId = authData.user.id;

    await supabase.from('profiles').insert({
      id: userId,
      full_name: data.fullName,
      phone: data.phone || null,
      company_name: data.companyName || null,
      job_title: data.jobTitle || null,
      status_id: 1,
    });

    await supabase.from('user_roles').insert({
      user_id: userId,
      role_name: 'client',
      assigned_by: null,
    });

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

export async function updatePassword(newPassword: string) {
  try {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return { success: true, user: data.user };
  } catch (error: any) {
    throw new Error(error.message || 'Password update failed');
  }
}

export async function resetPassword(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || 'Failed to send reset email');
  }
}

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
    throw new Error(error.message || 'Profile update failed');
  }
}