import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  UserCheck, 
  UserX, 
  Shield, 
  Mail,
  Phone,
  Briefcase,
  Building2,
  MoreVertical,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UserCog,
  Clock,
  Archive,
  ArrowRight
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
}

const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [hasMounted, setHasMounted] = useState(false); // Track first mount

  const statuses = {
    1: { name: 'Active', color: 'text-green-400 bg-green-400/10 border-green-400/30', icon: UserCheck },
    2: { name: 'Inactive', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', icon: Clock },
    3: { name: 'Suspended', color: 'text-red-400 bg-red-400/10 border-red-400/30', icon: UserX },
    4: { name: 'Pending', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30', icon: Clock },
    5: { name: 'Archived', color: 'text-muted-foreground bg-muted-foreground/10 border-muted-foreground/30', icon: Archive }
  };

  const roles = {
    admin: { label: 'Admin', color: 'text-accent', icon: Shield },
    manager: { label: 'Manager', color: 'text-primary', icon: UserCog },
    client: { label: 'Client', color: 'text-green-400', icon: Users }
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
      setHasMounted(true); // Mark as mounted after first load
    }
  }, [session]);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, statusFilter, roleFilter, users]);

  const fetchUsers = async () => {
    setLoading(true);
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

      const usersWithRoles = profilesData?.map(profile => ({
        ...profile,
        user_roles: rolesData?.filter(role => role.user_id === profile.id) || []
      })) || [];

      setUsers(usersWithRoles);
    } catch (err: any) {
      console.error('Fetch users error:', err);
      showNotification('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status_id === parseInt(statusFilter));
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => 
        user.user_roles?.some(r => r.role_name === roleFilter)
      );
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
        body: { action: 'update', userId, updates }
      });

      if (error) throw error;
      
      await fetchUsers();
      showNotification('User updated successfully');
      setShowEditModal(false);
      setSelectedUser(null);
    } catch (err: any) {
      showNotification(err.message || 'Failed to update user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'delete', userId: selectedUser.id }
      });

      if (error) throw error;
      
      await fetchUsers();
      showNotification('User deleted successfully');
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete user', 'error');
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

  const EditModal = () => {
    const [formData, setFormData] = useState<FormData>({
      full_name: selectedUser?.full_name || '',
      email: selectedUser?.email || '',
      phone: selectedUser?.phone || '',
      company_name: selectedUser?.company_name || '',
      job_title: selectedUser?.job_title || '',
      status_id: selectedUser?.status_id || 1,
      role: selectedUser?.user_roles?.[0]?.role_name || 'client'
    });

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
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className="w-full px-6 py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-6 py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-6 py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Job Title</label>
                  <input
                    type="text"
                    value={formData.job_title}
                    onChange={(e) => setFormData({...formData, job_title: e.target.value})}
                    className="w-full px-6 py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Company</label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  className="w-full px-6 py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Status</label>
                  <select
                    value={formData.status_id}
                    onChange={(e) => setFormData({...formData, status_id: parseInt(e.target.value)})}
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
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-6 py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  >
                    {Object.entries(roles).map(([key, role]) => (
                      <option key={key} value={key}>{role.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <Button
                  onClick={() => setShowEditModal(false)}
                  variant="outline"
                  className="flex-1 h-14 text-lg rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => selectedUser && handleUpdateUser(selectedUser.id, formData)}
                  disabled={actionLoading}
                  className="flex-1 h-14 text-lg rounded-xl bg-primary hover:bg-primary/90"
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
          <div className="text-center">
            <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Delete User</h2>
            <p className="text-muted-foreground mb-8">
              Are you sure you want to delete <strong className="text-foreground">{selectedUser?.full_name}</strong>? This action cannot be undone.
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
                onClick={handleDeleteUser}
                disabled={actionLoading}
                className="flex-1 h-14 text-lg rounded-xl bg-destructive hover:bg-destructive/90"
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );

  if (checkingAuth || !session) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <span className="text-lg text-muted-foreground">Loading...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }} />
        </div>
      </div>

      <div className="container mx-auto px-2 sm:px-4 md:px-6 py-8 md:py-16 max-w-2xl md:max-w-4xl lg:max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8 md:mb-16"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
            <div>
              <h1 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-2 sm:mb-4">
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
              onClick={fetchUsers}
              size="lg"
              variant="outline"
              className="glass rounded-xl h-12 sm:h-14 px-4 sm:px-6"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {[
              { label: 'Total Users', value: users.length, icon: Users, color: 'primary' },
              { label: 'Active', value: users.filter(u => u.status_id === 1).length, icon: UserCheck, color: 'green' },
              { label: 'Pending', value: users.filter(u => u.status_id === 4).length, icon: Clock, color: 'blue' },
              { label: 'Suspended', value: users.filter(u => u.status_id === 3).length, icon: UserX, color: 'red' }
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.6 }}
                >
                  <GlassCard className="text-center">
                    <Icon className="w-8 sm:w-10 h-8 sm:h-10 mx-auto mb-2 sm:mb-4 text-primary" />
                    <div className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2 text-primary">{stat.value}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          <GlassCard className="p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
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

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 sm:px-4 py-3 sm:py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-base sm:text-lg"
              >
                <option value="all">All Statuses</option>
                {Object.entries(statuses).map(([id, status]) => (
                  <option key={id} value={id}>{status.name}</option>
                ))}
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 sm:px-4 py-3 sm:py-4 bg-background/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-base sm:text-lg"
              >
                <option value="all">All Roles</option>
                {Object.entries(roles).map(([key, role]) => (
                  <option key={key} value={key}>{role.label}</option>
                ))}
              </select>
            </div>
          </GlassCard>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-12 h-12 text-primary animate-spin" />
          </div>
        ) : (
          <motion.div className="space-y-4">
            <AnimatePresence mode="wait">
              {filteredUsers.map((user, i) => {
                const StatusIcon = statuses[user.status_id]?.icon || UserCheck;
                const roleInfo = roles[user.user_roles?.[0]?.role_name as keyof typeof roles] || roles.client;
                const RoleIcon = roleInfo.icon;

                return (
                  <motion.div
                    key={user.id}
                    layout
                    initial={hasMounted ? false : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ 
                      layout: { duration: 0.3 },
                      opacity: { duration: 0.3 },
                      y: { duration: 0.4, delay: hasMounted ? 0 : i * 0.05 }
                    }}
                    className="relative"
                  >
                    <GlassCard className="p-6 hover:border-primary/30 transition-all group">
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
                              setShowDeleteModal(true);
                            }}
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

      <AnimatePresence>
        {showEditModal && <EditModal />}
        {showDeleteModal && <DeleteModal />}
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