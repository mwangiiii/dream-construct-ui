import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Search, 
  Edit2, 
  Trash2, 
  UserCheck, 
  UserX, 
  Shield, 
  Mail,
  Phone,
  Briefcase,
  Building2,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UserCog,
  Clock,
  Archive,
  Ban,
  RotateCcw
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/GlassCard';

interface User {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  job_title?: string;
  created_at: string;
  last_sign_in_at?: string;
  status_id: number;
  user_roles: Array<{ role_name: string; assigned_at: string }>;
  primary_role?: string;
}

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  job_title: string;
  status_id: number;
  role: string;
}

const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('manager');
  const [searchTerm, setSearchTerm] = useState('');

  const statuses = {
    1: { name: 'Active', color: 'text-green-400 bg-green-400/10 border-green-400/30', icon: UserCheck },
    2: { name: 'Inactive', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', icon: Clock },
    3: { name: 'Suspended', color: 'text-red-400 bg-red-400/10 border-red-400/30', icon: UserX },
    4: { name: 'Pending', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30', icon: Clock },
    5: { name: 'Archived', color: 'text-muted-foreground bg-muted-foreground/10 border-muted-foreground/30', icon: Archive }
  };

  const roles = {
    manager: { label: 'Managers', color: 'text-primary', icon: UserCog },
    client: { label: 'Clients', color: 'text-green-400', icon: Users },
    admin: { label: 'Admins', color: 'text-accent', icon: Shield },
    surveyor: { label: 'Surveyors', color: 'text-blue-400', icon: Briefcase },
    project_manager: { label: 'Project Managers', color: 'text-purple-400', icon: UserCog },
    suspended: { label: 'Suspended', color: 'text-red-400', icon: Ban },
    archived: { label: 'Archived', color: 'text-muted-foreground', icon: Archive }
  };

  // === AUTH GUARD ===
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setCheckingAuth(false);

      if (!session) {
        const returnTo = encodeURIComponent(location.pathname);
        navigate(`/login?redirectTo=${returnTo}`, { replace: true });
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_OUT') {
        const returnTo = encodeURIComponent('/admin/users');
        navigate(`/login?redirectTo=${returnTo}`, { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location]);

  useEffect(() => {
    if (session) {
      fetchUsers();
    }
  }, [session]);

  // ✅ FIXED v2: Fetch email from auth.users via Edge Function ONLY (no direct admin API calls)
  const fetchUsers = async () => {
    setLoading(true);
    try {
      console.log('=== FETCH USERS v2 - USING EDGE FUNCTION ONLY ===');
      
      // Get profiles data
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, phone, company_name, job_title, created_at, status_id')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;
      console.log('Profiles fetched:', profilesData?.length);

      // Get roles data
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role_name, assigned_at')
        .order('assigned_at', { ascending: true });

      if (rolesError) throw rolesError;
      console.log('Roles fetched:', rolesData?.length);

      // Get auth data (email, last_sign_in_at) via Edge Function ONLY
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      let authUsersMap = new Map();
      
      if (token) {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const edgeFunctionUrl = `${supabaseUrl}/functions/v1/get-auth-users`;
          
          console.log('Calling Edge Function:', edgeFunctionUrl);
          
          const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            }
          });

          console.log('Edge Function response status:', response.status);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Edge Function error response:', errorText);
            throw new Error(`Edge Function failed: ${response.status}`);
          }

          const result = await response.json();
          console.log('Edge Function success! Users returned:', result.users?.length);
          
          if (result.success && result.users) {
            result.users.forEach((authUser: any) => {
              authUsersMap.set(authUser.id, {
                email: authUser.email,
                last_sign_in_at: authUser.last_sign_in_at
              });
            });
            console.log('Auth users map populated with', authUsersMap.size, 'entries');
          } else {
            console.warn('Edge Function returned unexpected format:', result);
          }
        } catch (err: any) {
          console.error('Edge Function call failed:', err.message);
          showNotification('Could not fetch emails. Ensure get-auth-users Edge Function is deployed: supabase functions deploy get-auth-users', 'error');
        }
      } else {
        console.error('No auth token available!');
      }

      // Combine all data
      const usersWithRoles = profilesData?.map(profile => {
        const userRoles = rolesData?.filter(role => role.user_id === profile.id) || [];
        const authData = authUsersMap.get(profile.id);
        
        if (!authData) {
          console.warn(`No auth data found for user ${profile.id} (${profile.full_name})`);
        }
        
        return {
          ...profile,
          email: authData?.email || 'Email not found',
          last_sign_in_at: authData?.last_sign_in_at,
          user_roles: userRoles,
          primary_role: userRoles[0]?.role_name || 'client'
        };
      }) || [];

      console.log('Final users with complete data:', usersWithRoles.length);
      setUsers(usersWithRoles);
    } catch (err: any) {
      console.error('Fetch users error:', err);
      showNotification('Failed to load users: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // ✅ Update user with proper handling
  const handleUpdateUser = async (userId: string, updates: Partial<FormData>) => {
    setActionLoading(true);
    try {
      const { role, ...profileUpdates } = updates;

      // Update profile table
      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', userId);

        if (profileError) throw new Error('Failed to update profile: ' + profileError.message);
      }

      // Update role if changed
      if (role && role !== selectedUser?.primary_role) {
        const { error: deleteError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId);

        if (deleteError) throw new Error('Failed to delete old roles: ' + deleteError.message);

        const { data: sessionData } = await supabase.auth.getSession();
        const currentUserId = sessionData.session?.user.id;

        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role_name: role,
            assigned_by: currentUserId
          });

        if (insertError) throw new Error('Failed to assign new role: ' + insertError.message);
      }

      await fetchUsers();
      
      showNotification('User updated successfully');
      setShowEditModal(false);
      setSelectedUser(null);
    } catch (err: any) {
      console.error('Update error:', err);
      showNotification(err.message || 'Failed to update user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ Soft delete - Archive user
  const handleArchiveUser = async () => {
    if (!selectedUser) return;
    
    setActionLoading(true);
    try {
      // Update status to archived (5)
      const { error: archiveError } = await supabase
        .from('profiles')
        .update({ status_id: 5 })
        .eq('id', selectedUser.id);

      if (archiveError) throw new Error('Failed to archive user: ' + archiveError.message);

      // Update local state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === selectedUser.id 
            ? { ...user, status_id: 5 } 
            : user
        )
      );
      
      showNotification('User archived successfully');
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (err: any) {
      console.error('Archive error:', err);
      showNotification(err.message || 'Failed to archive user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ Suspend user
  const handleSuspendUser = async () => {
    if (!selectedUser) return;
    
    setActionLoading(true);
    try {
      // Update status to suspended (3)
      const { error: suspendError } = await supabase
        .from('profiles')
        .update({ status_id: 3 })
        .eq('id', selectedUser.id);

      if (suspendError) throw new Error('Failed to suspend user: ' + suspendError.message);

      // Update local state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === selectedUser.id 
            ? { ...user, status_id: 3 } 
            : user
        )
      );
      
      showNotification('User suspended successfully');
      setShowSuspendModal(false);
      setSelectedUser(null);
    } catch (err: any) {
      console.error('Suspend error:', err);
      showNotification(err.message || 'Failed to suspend user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ Restore user (from suspended or archived)
  const handleRestoreUser = async () => {
    if (!selectedUser) return;
    
    setActionLoading(true);
    try {
      // Update status to active (1)
      const { error: restoreError } = await supabase
        .from('profiles')
        .update({ status_id: 1 })
        .eq('id', selectedUser.id);

      if (restoreError) throw new Error('Failed to restore user: ' + restoreError.message);

      // Update local state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === selectedUser.id 
            ? { ...user, status_id: 1 } 
            : user
        )
      );
      
      showNotification('User restored successfully');
      setShowRestoreModal(false);
      setSelectedUser(null);
    } catch (err: any) {
      console.error('Restore error:', err);
      showNotification(err.message || 'Failed to restore user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // ✅ Filter logic for different tabs
  const getFilteredUsers = () => {
    if (activeTab === 'suspended') {
      return users.filter(user => user.status_id === 3);
    } else if (activeTab === 'archived') {
      return users.filter(user => user.status_id === 5);
    } else {
      // Regular role tabs - show only active users
      return users.filter(user => 
        user.primary_role === activeTab && 
        user.status_id !== 3 && 
        user.status_id !== 5
      );
    }
  };

  const EditModal = () => {
    const [formData, setFormData] = useState<FormData>({
      full_name: selectedUser?.full_name || '',
      email: selectedUser?.email || '',
      phone: selectedUser?.phone || '',
      company_name: selectedUser?.company_name || '',
      job_title: selectedUser?.job_title || '',
      status_id: selectedUser?.status_id || 1,
      role: selectedUser?.primary_role || 'client'
    });

    const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());

    const handleFieldChange = (field: keyof FormData, value: string | number) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      
      const originalValue = selectedUser?.[field as keyof User] || '';
      if (field === 'role') {
        if (value !== selectedUser?.primary_role) {
          setModifiedFields(prev => new Set(prev).add(field));
        } else {
          setModifiedFields(prev => {
            const next = new Set(prev);
            next.delete(field);
            return next;
          });
        }
      } else if (value !== originalValue) {
        setModifiedFields(prev => new Set(prev).add(field));
      } else {
        setModifiedFields(prev => {
          const next = new Set(prev);
          next.delete(field);
          return next;
        });
      }
    };

    const handleSave = () => {
      if (!selectedUser || modifiedFields.size === 0) return;

      const updates: Partial<FormData> = {};
      modifiedFields.forEach(field => {
        updates[field as keyof FormData] = formData[field as keyof FormData];
      });

      handleUpdateUser(selectedUser.id, updates);
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-6"
        onClick={() => setShowEditModal(false)}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <GlassCard className="p-8 md:p-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl md:text-4xl font-bold">Edit User</h2>
              <button 
                onClick={() => setShowEditModal(false)} 
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => handleFieldChange('full_name', e.target.value)}
                  className="w-full px-6 py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  className="w-full px-6 py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    placeholder="Optional"
                    className="w-full px-6 py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Job Title</label>
                  <input
                    type="text"
                    value={formData.job_title}
                    onChange={(e) => handleFieldChange('job_title', e.target.value)}
                    placeholder="Optional"
                    className="w-full px-6 py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Company</label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => handleFieldChange('company_name', e.target.value)}
                  placeholder="Optional"
                  className="w-full px-6 py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Status</label>
                  <select
                    value={formData.status_id}
                    onChange={(e) => handleFieldChange('status_id', parseInt(e.target.value))}
                    className="w-full px-6 py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  >
                    {Object.entries(statuses).map(([id, status]) => (
                      <option key={id} value={id}>{status.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleFieldChange('role', e.target.value)}
                    className="w-full px-6 py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  >
                    {Object.entries(roles)
                      .filter(([key]) => key !== 'suspended' && key !== 'archived')
                      .map(([key, role]) => (
                        <option key={key} value={key}>{role.label}</option>
                      ))}
                  </select>
                </div>
              </div>

              {modifiedFields.size > 0 && (
                <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl">
                  <p className="text-sm text-primary font-medium">
                    Modified fields: {Array.from(modifiedFields).join(', ')}
                  </p>
                </div>
              )}

              <div className="flex gap-4 pt-6">
                <Button
                  onClick={() => setShowEditModal(false)}
                  variant="outline"
                  className="flex-1 h-14 text-lg rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={actionLoading || modifiedFields.size === 0}
                  className="flex-1 h-14 text-lg rounded-xl bg-primary hover:bg-primary/90"
                >
                  {actionLoading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    );
  };

  const DeleteModal = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-6"
      onClick={() => setShowDeleteModal(false)}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md"
      >
        <GlassCard className="p-8 border-destructive/30">
          <div className="flex items-center justify-center w-16 h-16 bg-destructive/20 rounded-2xl mx-auto mb-6">
            <Archive className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-center mb-4">Archive User</h2>
          <p className="text-muted-foreground text-center mb-8">
            Are you sure you want to archive <span className="font-semibold text-foreground">{selectedUser?.full_name}</span>? The user will be moved to archived status and can be restored later.
          </p>
          <div className="flex gap-4">
            <Button
              onClick={() => setShowDeleteModal(false)}
              variant="outline"
              className="flex-1 h-14 text-lg rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleArchiveUser}
              disabled={actionLoading}
              className="flex-1 h-14 text-lg rounded-xl bg-destructive hover:bg-destructive/90"
            >
              {actionLoading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Archiving...
                </span>
              ) : (
                'Archive User'
              )}
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );

  const SuspendModal = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-6"
      onClick={() => setShowSuspendModal(false)}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md"
      >
        <GlassCard className="p-8 border-red-400/30">
          <div className="flex items-center justify-center w-16 h-16 bg-red-400/20 rounded-2xl mx-auto mb-6">
            <Ban className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-center mb-4">Suspend User</h2>
          <p className="text-muted-foreground text-center mb-8">
            Are you sure you want to suspend <span className="font-semibold text-foreground">{selectedUser?.full_name}</span>? They will lose access to the system until restored.
          </p>
          <div className="flex gap-4">
            <Button
              onClick={() => setShowSuspendModal(false)}
              variant="outline"
              className="flex-1 h-14 text-lg rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSuspendUser}
              disabled={actionLoading}
              className="flex-1 h-14 text-lg rounded-xl bg-red-500 hover:bg-red-600"
            >
              {actionLoading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Suspending...
                </span>
              ) : (
                'Suspend User'
              )}
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );

  const RestoreModal = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-6"
      onClick={() => setShowRestoreModal(false)}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md"
      >
        <GlassCard className="p-8 border-green-400/30">
          <div className="flex items-center justify-center w-16 h-16 bg-green-400/20 rounded-2xl mx-auto mb-6">
            <RotateCcw className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-center mb-4">Restore User</h2>
          <p className="text-muted-foreground text-center mb-8">
            Restore <span className="font-semibold text-foreground">{selectedUser?.full_name}</span> to active status? They will regain full access to the system.
          </p>
          <div className="flex gap-4">
            <Button
              onClick={() => setShowRestoreModal(false)}
              variant="outline"
              className="flex-1 h-14 text-lg rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestoreUser}
              disabled={actionLoading}
              className="flex-1 h-14 text-lg rounded-xl bg-green-500 hover:bg-green-600"
            >
              {actionLoading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Restoring...
                </span>
              ) : (
                'Restore User'
              )}
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );

  if (checkingAuth || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const filteredUsers = getFilteredUsers().filter(user =>
    searchTerm === '' ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      </div>

      <div className="container mx-auto px-2 sm:px-4 md:px-6 py-8 md:py-16 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 md:mb-16"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
            <div>
              <h1 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-2 sm:mb-4">
                User
                <br />
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Management
                </span>
              </h1>
              <p className="text-base sm:text-xl md:text-2xl text-muted-foreground">
                Manage team members and access control
              </p>
            </div>
            <Button
              onClick={fetchUsers}
              size="lg"
              variant="outline"
              className="glass rounded-xl h-12 sm:h-14 px-4 sm:px-6"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>

        <GlassCard className="p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex gap-2 sm:gap-4 mb-4 overflow-x-auto pb-2">
            {Object.entries(roles).map(([key, role]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 sm:px-6 py-3 rounded-xl font-semibold text-base sm:text-lg transition-all border-b-2 focus:outline-none whitespace-nowrap ${
                  activeTab === key
                    ? 'border-primary text-primary bg-background/80'
                    : 'border-transparent text-muted-foreground bg-background/40 hover:bg-background/60'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <role.icon className={`w-5 h-5 ${role.color}`} />
                  {role.label}
                </span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 sm:py-4 bg-background/50 border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-base sm:text-lg"
            />
          </div>
        </GlassCard>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-12 h-12 text-primary animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {filteredUsers.map((user, i) => {
                const StatusIcon = statuses[user.status_id]?.icon || UserCheck;
                const roleInfo = roles[user.primary_role as keyof typeof roles] || roles.client;

                return (
                  <motion.div
                    key={user.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <GlassCard className="p-6 hover:border-primary/30 transition-all">
                      <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-6 flex-1">
                          <div className="w-16 h-16 bg-gradient-to-br from-primary via-accent to-primary rounded-2xl flex items-center justify-center text-background text-xl font-bold flex-shrink-0">
                            {user.full_name?.charAt(0) || '?'}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="text-xl font-semibold truncate">{user.full_name}</h3>
                              <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${statuses[user.status_id]?.color}`}>
                                {statuses[user.status_id]?.name}
                              </span>
                              <span className={`px-3 py-1 rounded-lg text-xs font-medium ${roleInfo.color} bg-background/50`}>
                                {roleInfo.label}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{user.email}</span>
                              </div>
                              {user.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 flex-shrink-0" />
                                  <span>{user.phone}</span>
                                </div>
                              )}
                              {user.company_name && (
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 flex-shrink-0" />
                                  <span className="truncate">{user.company_name}</span>
                                </div>
                              )}
                              {user.job_title && (
                                <div className="flex items-center gap-2">
                                  <Briefcase className="w-4 h-4 flex-shrink-0" />
                                  <span className="truncate">{user.job_title}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>Joined: {formatDate(user.created_at)}</span>
                              <span>Last login: {formatDate(user.last_sign_in_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {user.status_id === 3 || user.status_id === 5 ? (
                            <Button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowRestoreModal(true);
                              }}
                              variant="outline"
                              size="lg"
                              className="glass rounded-xl text-green-400 border-green-400/30 hover:bg-green-400/10"
                            >
                              <RotateCcw className="w-5 h-5" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowEditModal(true);
                                }}
                                variant="outline"
                                size="lg"
                                className="glass rounded-xl"
                              >
                                <Edit2 className="w-5 h-5" />
                              </Button>
                              <Button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowSuspendModal(true);
                                }}
                                variant="outline"
                                size="lg"
                                className="glass rounded-xl text-red-400 border-red-400/30 hover:bg-red-400/10"
                              >
                                <Ban className="w-5 h-5" />
                              </Button>
                              <Button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowDeleteModal(true);
                                }}
                                variant="outline"
                                size="lg"
                                className="glass rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10"
                              >
                                <Archive className="w-5 h-5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredUsers.length === 0 && (
              <div className="text-center py-20">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-xl text-muted-foreground">No users found</p>
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showEditModal && <EditModal />}
        {showDeleteModal && <DeleteModal />}
        {showSuspendModal && <SuspendModal />}
        {showRestoreModal && <RestoreModal />}
      </AnimatePresence>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 z-50"
          >
            <div className={`px-6 py-4 rounded-2xl backdrop-blur-xl border flex items-center gap-3 ${
              notification.type === 'success' 
                ? 'bg-green-500/20 border-green-500/30 text-green-400' 
                : 'bg-destructive/20 border-destructive/30 text-destructive'
            }`}>
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
              <p className="font-medium">{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagement;