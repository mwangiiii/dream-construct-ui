// src/pages/admin/users/UserManagement.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Edit2, Trash2, UserCheck, UserX, Shield,
  Mail, Phone, Briefcase, Building2, X, CheckCircle2,
  AlertCircle, RefreshCw, UserCog, Clock, Archive, Eye, EyeOff, Ruler,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/GlassCard';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  show_on_team_page: boolean;
  user_roles?: Array<{ role_name: string }>;
}

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  job_title: string;
  status_id: number;
  role: string;
  show_on_team_page: boolean;
}

// ─── Static lookup tables ─────────────────────────────────────────────────────

const STATUSES: Record<number, { name: string; color: string; icon: React.ElementType }> = {
  1: { name: 'Active',    color: 'text-green-400 bg-green-400/10 border-green-400/30',                      icon: UserCheck },
  2: { name: 'Inactive',  color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',                   icon: Clock     },
  3: { name: 'Suspended', color: 'text-red-400 bg-red-400/10 border-red-400/30',                            icon: UserX     },
  4: { name: 'Pending',   color: 'text-blue-400 bg-blue-400/10 border-blue-400/30',                         icon: Clock     },
  5: { name: 'Archived',  color: 'text-muted-foreground bg-muted-foreground/10 border-muted-foreground/30', icon: Archive   },
};

// Ordered from LEAST to MOST privileged — matches ROLE_PRIORITY in src/lib/auth.ts.
// Object key-insertion order drives all dropdowns/legends below.
const ROLES: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  client:            { label: 'Client',            color: 'text-green-400',  icon: Users     },
  quantity_surveyor: { label: 'Quantity Surveyor', color: 'text-blue-400',   icon: Ruler     },
  project_manager:   { label: 'Project Manager',   color: 'text-yellow-400', icon: Briefcase },
  manager:           { label: 'Manager',           color: 'text-primary',    icon: UserCog   },
  finance:           { label: 'Finance',           color: 'text-green-400',  icon: Building2 },
  admin:             { label: 'Admin',             color: 'text-accent',     icon: Shield    },
};

// ─── EditModal ────────────────────────────────────────────────────────────────

interface EditModalProps {
  selectedUser: User;
  actionLoading: boolean;
  onClose: () => void;
  onSave: (userId: string, updates: Partial<FormData>) => void;
}

const EditModal: React.FC<EditModalProps> = ({ selectedUser, actionLoading, onClose, onSave }) => {
  const [formData, setFormData] = useState<FormData>({
    full_name:          selectedUser.full_name          || '',
    email:              selectedUser.email              || '',
    phone:              selectedUser.phone              || '',
    company_name:       selectedUser.company_name       || '',
    job_title:          selectedUser.job_title          || '',
    status_id:          selectedUser.status_id          || 1,
    role:               selectedUser.user_roles?.[0]?.role_name || 'client',
    // Read the current DB value. If the column hasn't been added yet it will be
    // undefined — we coerce to false so the toggle always has a defined state.
    show_on_team_page:  selectedUser.show_on_team_page  ?? false,
  });

  const handleSave = () => {
    const updates: Partial<FormData> = {
      full_name:         formData.full_name,
      email:             formData.email,
      phone:             formData.phone,
      company_name:      formData.company_name,
      job_title:         formData.job_title,
      status_id:         formData.status_id,
      // Always include show_on_team_page — it is always a known boolean here.
      show_on_team_page: formData.show_on_team_page,
    };

    if (formData.role && formData.role.trim() !== '') {
      updates.role = formData.role;
    }

    onSave(selectedUser.id, updates);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
      >
        <GlassCard className="p-6 sm:p-8 md:p-12 rounded-t-2xl sm:rounded-2xl">
          <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 sm:hidden" />

          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Edit User</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-5 sm:space-y-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Job Title</label>
                <input
                  type="text"
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Company</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Status</label>
                <select
                  value={formData.status_id}
                  onChange={(e) => setFormData({ ...formData, status_id: parseInt(e.target.value) })}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                >
                  {Object.entries(STATUSES).map(([id, status]) => (
                    <option key={id} value={id}>{status.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                >
                  {Object.entries(ROLES).map(([key, role]) => (
                    <option key={key} value={key}>{role.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Team Page Visibility Toggle ─────────────────────────────────── */}
            <div
              className={`
                flex items-center justify-between gap-4 px-4 sm:px-6 py-4 sm:py-5
                rounded-xl border transition-all cursor-pointer
                ${formData.show_on_team_page
                  ? 'bg-primary/10 border-primary/40'
                  : 'bg-background/50 border-border'}
              `}
              onClick={() => setFormData({ ...formData, show_on_team_page: !formData.show_on_team_page })}
            >
              <div className="flex items-center gap-3">
                {formData.show_on_team_page
                  ? <Eye className="w-5 h-5 text-primary flex-shrink-0" />
                  : <EyeOff className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                }
                <div>
                  <p className={`text-sm font-medium ${formData.show_on_team_page ? 'text-foreground' : 'text-muted-foreground'}`}>
                    Show on Team Page
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formData.show_on_team_page
                      ? 'This user is visible on the public team page'
                      : 'This user is hidden from the public team page'}
                  </p>
                </div>
              </div>

              {/* Toggle pill */}
              <div
                className={`
                  relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200
                  ${formData.show_on_team_page ? 'bg-primary' : 'bg-border'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm
                    transition-transform duration-200
                    ${formData.show_on_team_page ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </div>
            </div>

            <div className="flex gap-3 sm:gap-4 pt-4 sm:pt-6">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 h-12 sm:h-14 text-base sm:text-lg rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={actionLoading}
                className="flex-1 h-12 sm:h-14 text-base sm:text-lg rounded-xl bg-primary hover:bg-primary/90"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
};

// ─── DeleteModal ──────────────────────────────────────────────────────────────

interface DeleteModalProps {
  selectedUser: User;
  actionLoading: boolean;
  onClose: () => void;
  onSoftDelete: (statusId?: number) => void;
  onRestore: () => void;
  onHardDelete: () => void;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  selectedUser, actionLoading, onClose, onSoftDelete, onRestore, onHardDelete,
}) => {
  const isSuspended = selectedUser.status_id === 3;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl"
      >
        <GlassCard className="p-6 sm:p-8 border-destructive/30 rounded-t-2xl sm:rounded-2xl">
          <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 sm:hidden" />

          <div className="text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6">
              <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 text-destructive" />
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4">
              {isSuspended ? 'Restore or Delete User' : 'Suspend or Delete User'}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
              {isSuspended ? (
                <>
                  This user is currently <strong>suspended</strong>. You can restore them to active,
                  or permanently delete.<br />What would you like to do?
                </>
              ) : (
                <>
                  Are you sure you want to <strong>suspend</strong> (soft delete){' '}
                  <span className="text-foreground">{selectedUser.full_name}</span>?
                  <br />You can restore them later, or permanently delete.
                </>
              )}
            </p>
            <div className="flex flex-col gap-3">
              <Button onClick={onClose} variant="outline" className="h-12 sm:h-14 text-base sm:text-lg rounded-xl" disabled={actionLoading}>
                Cancel
              </Button>
              {!isSuspended && (
                <Button onClick={() => onSoftDelete(3)} disabled={actionLoading} className="h-12 sm:h-14 text-base sm:text-lg rounded-xl bg-yellow-500/80 hover:bg-yellow-600/90 text-yellow-900">
                  {actionLoading ? 'Suspending...' : 'Suspend (Soft Delete)'}
                </Button>
              )}
              {isSuspended && (
                <Button onClick={onRestore} disabled={actionLoading} className="h-12 sm:h-14 text-base sm:text-lg rounded-xl bg-green-500/80 hover:bg-green-600/90 text-green-900">
                  {actionLoading ? 'Restoring...' : 'Restore to Active'}
                </Button>
              )}
              <Button onClick={onHardDelete} disabled={actionLoading} className="h-12 sm:h-14 text-base sm:text-lg rounded-xl bg-destructive hover:bg-destructive/90">
                {actionLoading ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────

const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [users,           setUsers]           = useState<User[]>([]);
  const [filteredUsers,   setFilteredUsers]   = useState<User[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [searchTerm,      setSearchTerm]      = useState('');
  const [statusFilter,    setStatusFilter]    = useState('all');
  const [roleFilter,      setRoleFilter]      = useState('all');
  const [selectedUser,    setSelectedUser]    = useState<User | null>(null);
  const [showEditModal,   setShowEditModal]   = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notification,    setNotification]    = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [actionLoading,   setActionLoading]   = useState(false);
  const [session,         setSession]         = useState<any>(null);
  const [checkingAuth,    setCheckingAuth]    = useState(true);
  const [hasMounted,      setHasMounted]      = useState(false);

  // === AUTH GUARD ===
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setCheckingAuth(false);
      if (!session) {
        navigate(`/login?redirectTo=${encodeURIComponent(location.pathname)}`, { replace: true });
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_OUT') {
        navigate(`/login?redirectTo=${encodeURIComponent('/admin/users')}`, { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location]);

  useEffect(() => {
    if (session) {
      fetchUsers();
      setHasMounted(true);
    }
  }, [session]);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, statusFilter, roleFilter, users]);

  // ── Fetch users + merge auth emails ────────────────────────────────────────
  const fetchUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (profilesError) throw profilesError;

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role_name');
      if (rolesError) throw rolesError;

      let emailMap: Record<string, string> = {};
      try {
        const { data: emailData, error: emailError } = await supabase.functions.invoke('manage-user', {
          body: { action: 'list-emails' },
        });
        if (!emailError && emailData?.emails) {
          emailMap = emailData.emails;
        }
      } catch {
        /* email fetch is best-effort */
      }

      const usersWithRoles: User[] = (profilesData || []).map(profile => ({
        ...profile,
        email:             emailMap[profile.id] || profile.email || '',
        // Coerce null/undefined (pre-migration rows) to false so the UI is always defined
        show_on_team_page: profile.show_on_team_page ?? false,
        user_roles:        (rolesData || []).filter(role => role.user_id === profile.id),
      }));

      setUsers(usersWithRoles);
    } catch {
      showNotification('Failed to load users', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.full_name?.toLowerCase().includes(lower) ||
        u.email?.toLowerCase().includes(lower) ||
        u.company_name?.toLowerCase().includes(lower)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(u => u.status_id === parseInt(statusFilter));
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.user_roles?.some(r => r.role_name === roleFilter));
    }

    setFilteredUsers(filtered);
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleUpdateUser = async (userId: string, updates: Partial<FormData>) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'update', userId, updates },
      });
      if (error) throw error;

      await fetchUsers(true);
      showNotification('User updated successfully');
      setShowEditModal(false);
      setSelectedUser(null);
    } catch (err: any) {
      showNotification(err.message || 'Failed to update user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSoftDeleteUser = async (statusId = 3) => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'soft-delete', userId: selectedUser.id, updates: { statusId } },
      });
      if (error) throw error;

      await fetchUsers(true);
      showNotification('User suspended');
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (err: any) {
      showNotification(err.message || 'Failed to suspend user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'restore', userId: selectedUser.id },
      });
      if (error) throw error;

      await fetchUsers(true);
      showNotification('User restored to active');
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (err: any) {
      showNotification(err.message || 'Failed to restore user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleHardDeleteUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'delete', userId: selectedUser.id },
      });
      if (error) throw error;

      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      setShowDeleteModal(false);
      setSelectedUser(null);
      showNotification('User permanently deleted');
      fetchUsers(true);
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  if (checkingAuth || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-lg text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            }}
          />
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-8 md:py-16 max-w-7xl">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8 md:mb-16"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-2 sm:mb-4">
                User
                <br />
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-glow">
                  Management
                </span>
              </h1>
              <p className="text-base sm:text-xl md:text-2xl text-muted-foreground">
                Manage team members and access control
              </p>
            </div>
            <Button
              onClick={() => fetchUsers()}
              size="lg"
              variant="outline"
              className="glass rounded-xl h-12 sm:h-14 px-4 sm:px-6 self-start sm:self-auto"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
            {[
              { label: 'Total Users', value: users.length,                                icon: Users,     color: 'primary' },
              { label: 'Active',      value: users.filter(u => u.status_id === 1).length, icon: UserCheck, color: 'green'   },
              { label: 'Pending',     value: users.filter(u => u.status_id === 4).length, icon: Clock,     color: 'blue'    },
              { label: 'Suspended',   value: users.filter(u => u.status_id === 3).length, icon: UserX,     color: 'red'     },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.6 }}
                >
                  <GlassCard className="text-center p-4 sm:p-6">
                    <Icon className="w-7 sm:w-10 h-7 sm:h-10 mx-auto mb-2 sm:mb-4 text-primary" />
                    <div className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2 text-primary">{stat.value}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Filters ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          <GlassCard className="p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-background/50 border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm sm:text-base"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-3 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm sm:text-base"
              >
                <option value="all">All Statuses</option>
                {Object.entries(STATUSES).map(([id, status]) => (
                  <option key={id} value={id}>{status.name}</option>
                ))}
              </select>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-4 py-3 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm sm:text-base"
              >
                <option value="all">All Roles</option>
                {Object.entries(ROLES).map(([key, role]) => (
                  <option key={key} value={key}>{role.label}</option>
                ))}
              </select>
            </div>
          </GlassCard>
        </motion.div>

        {/* ── User list ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-12 h-12 text-primary animate-spin" />
          </div>
        ) : (
          <motion.div className="space-y-3 sm:space-y-4">
            <AnimatePresence mode="wait">
              {filteredUsers.map((user, i) => {
                const roleInfo = ROLES[user.user_roles?.[0]?.role_name as keyof typeof ROLES] || ROLES.client;

                return (
                  <motion.div
                    key={user.id}
                    layout
                    initial={hasMounted ? false : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{
                      layout:  { duration: 0.3 },
                      opacity: { duration: 0.3 },
                      y:       { duration: 0.4, delay: hasMounted ? 0 : i * 0.05 },
                    }}
                  >
                    <GlassCard className="p-4 sm:p-6 hover:border-primary/30 transition-all group">

                      {/* ── MOBILE layout ── */}
                      <div className="sm:hidden">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-11 h-11 bg-gradient-to-br from-primary via-accent to-primary rounded-xl flex items-center justify-center text-background text-base font-bold flex-shrink-0">
                            {user.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-base leading-tight truncate mb-1.5">
                              {user.full_name}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${STATUSES[user.status_id]?.color}`}>
                                {STATUSES[user.status_id]?.name}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${roleInfo.color} bg-background/50`}>
                                {roleInfo.label}
                              </span>
                              {/* Team page visibility badge */}
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 ${
                                user.show_on_team_page
                                  ? 'text-primary bg-primary/10 border border-primary/30'
                                  : 'text-muted-foreground bg-muted/10 border border-border'
                              }`}>
                                {user.show_on_team_page
                                  ? <><Eye className="w-3 h-3" /> Team</>
                                  : <><EyeOff className="w-3 h-3" /> Hidden</>
                                }
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => { setSelectedUser(user); setShowEditModal(true); }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-white/10 transition-colors"
                              aria-label="Edit user"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setSelectedUser(user); setShowDeleteModal(true); }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                              aria-label="Delete user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2 min-w-0">
                            <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </div>
                          {user.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{user.phone}</span>
                            </div>
                          )}
                          {user.company_name && (
                            <div className="flex items-center gap-2 min-w-0">
                              <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{user.company_name}</span>
                            </div>
                          )}
                          {user.job_title && (
                            <div className="flex items-center gap-2 min-w-0">
                              <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{user.job_title}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 pt-0.5 text-[11px]">
                            <span>Joined: {formatDate(user.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      {/* ── DESKTOP layout ── */}
                      <div className="hidden sm:flex items-center justify-between gap-6">
                        <div className="flex items-center gap-6 flex-1">
                          <div className="w-16 h-16 bg-gradient-to-br from-primary via-accent to-primary rounded-2xl flex items-center justify-center text-background text-xl font-bold flex-shrink-0">
                            {user.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="text-xl font-semibold truncate">{user.full_name}</h3>
                              <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${STATUSES[user.status_id]?.color}`}>
                                {STATUSES[user.status_id]?.name}
                              </span>
                              <span className={`px-3 py-1 rounded-lg text-xs font-medium ${roleInfo.color} bg-background/50`}>
                                {roleInfo.label}
                              </span>
                              {/* Team page visibility badge */}
                              <span className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                                user.show_on_team_page
                                  ? 'text-primary bg-primary/10 border border-primary/30'
                                  : 'text-muted-foreground bg-muted/10 border border-border'
                              }`}>
                                {user.show_on_team_page
                                  ? <><Eye className="w-3.5 h-3.5" /> On Team Page</>
                                  : <><EyeOff className="w-3.5 h-3.5" /> Hidden</>
                                }
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
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            onClick={() => { setSelectedUser(user); setShowEditModal(true); }}
                            variant="outline"
                            size="lg"
                            className="glass rounded-xl"
                          >
                            <Edit2 className="w-5 h-5" />
                          </Button>
                          <Button
                            onClick={() => { setSelectedUser(user); setShowDeleteModal(true); }}
                            variant="outline"
                            size="lg"
                            className="glass rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
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
          </motion.div>
        )}
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showEditModal && selectedUser && (
          <EditModal
            key="edit-modal"
            selectedUser={selectedUser}
            actionLoading={actionLoading}
            onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
            onSave={handleUpdateUser}
          />
        )}
        {showDeleteModal && selectedUser && (
          <DeleteModal
            key="delete-modal"
            selectedUser={selectedUser}
            actionLoading={actionLoading}
            onClose={() => { setShowDeleteModal(false); setSelectedUser(null); }}
            onSoftDelete={handleSoftDeleteUser}
            onRestore={handleRestoreUser}
            onHardDelete={handleHardDeleteUser}
          />
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-8 sm:w-auto z-50"
          >
            <div
              className={`px-5 py-4 rounded-2xl backdrop-blur-xl border flex items-center gap-3 ${
                notification.type === 'success'
                  ? 'bg-green-500/20 border-green-500/30 text-green-400'
                  : 'bg-destructive/20 border-destructive/30 text-destructive'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <p className="font-medium text-sm sm:text-base">{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagement;