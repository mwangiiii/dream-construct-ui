import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  UserPlus, 
  Mail, 
  Lock, 
  Phone, 
  Building2, 
  Briefcase, 
  Shield, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/GlassCard';

// Types matching your database schema
type AppRole = 'admin' | 'manager' | 'project_manager' | 'client';

interface CreateUserForm {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  companyName: string;
  jobTitle: string;
  role: AppRole;
}

const AdminUserCreate: React.FC = () => {
  const [form, setForm] = useState<CreateUserForm>({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    companyName: '',
    jobTitle: '',
    role: 'client',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Debug: Check environment variables on mount
  useEffect(() => {
    console.log('🔍 Environment check:');
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('VITE_SUPABASE_ANON_KEY exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
    
    // Test Supabase connection
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('❌ Supabase connection test failed:', error);
      } else {
        console.log('✅ Supabase connection test successful');
      }
    } catch (err) {
      console.error('❌ Supabase connection error:', err);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
    if (success) setSuccess(false);
  };

  const validateForm = (): boolean => {
    console.log('🔍 Validating form...');
    
    if (!form.fullName.trim()) {
      console.error('❌ Validation failed: Full name is required');
      setError('Full name is required');
      return false;
    }
    
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      console.error('❌ Validation failed: Valid email is required');
      setError('Valid email is required');
      return false;
    }
    
    if (form.password.length < 6) {
      console.error('❌ Validation failed: Password must be at least 6 characters');
      setError('Password must be at least 6 characters');
      return false;
    }
    
    console.log('✅ Form validation passed');
    return true;
  };

  const createUser = async (userData: CreateUserForm) => {
    console.log('🚀 Starting user creation process...');
    console.log('📋 User data:', {
      fullName: userData.fullName,
      email: userData.email,
      role: userData.role,
      phone: userData.phone || 'none',
      companyName: userData.companyName || 'none',
      jobTitle: userData.jobTitle || 'none',
    });

    try {
      // Get session
      console.log('🔐 Getting session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Session error:', sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }
      
      if (!session) {
        console.error('❌ No active session found');
        throw new Error('No active session. Please log in again.');
      }
      
      console.log('✅ Session obtained:', {
        userId: session.user.id,
        email: session.user.email,
        expiresAt: session.expires_at,
      });

      // Prepare request body
      const requestBody = {
        fullName: userData.fullName,
        email: userData.email,
        password: userData.password,
        phone: userData.phone || null,
        companyName: userData.companyName || null,
        jobTitle: userData.jobTitle || null,
        role: userData.role,
      };

      console.log('📡 Calling Edge Function: create-user');
      console.log('📤 Request body:', requestBody);

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: requestBody,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('📥 Edge Function response received');
      console.log('Response data:', data);
      console.log('Response error:', error);

      if (error) {
        console.error('❌ Edge Function error:', error);
        throw new Error(error.message || 'Failed to create user');
      }

      if (!data) {
        console.error('❌ No data returned from Edge Function');
        throw new Error('No response from server');
      }

      if (!data.success) {
        console.error('❌ Edge Function returned failure:', data);
        throw new Error(data.error || 'Failed to create user');
      }

      console.log('✅ User created successfully:', data);
      return data;

    } catch (err: any) {
      console.error('❌ Error in createUser:', err);
      throw err;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('\n========================================');
    console.log('🎯 SUBMIT BUTTON CLICKED');
    console.log('========================================\n');

    if (!validateForm()) {
      console.log('❌ Form validation failed, aborting submission');
      return;
    }

    console.log('✅ Form validation passed, proceeding with user creation');
    
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log('⏳ Starting createUser function...');
      const result = await createUser(form);
      
      console.log('✅ User creation completed successfully!');
      console.log('Result:', result);
      
      setSuccess(true);
      
      console.log('🔄 Resetting form in 3 seconds...');
      setTimeout(() => {
        setForm({
          fullName: '',
          email: '',
          password: '',
          phone: '',
          companyName: '',
          jobTitle: '',
          role: 'client',
        });
        setSuccess(false);
        console.log('✅ Form reset complete');
      }, 3000);

    } catch (err: any) {
      console.error('\n========================================');
      console.error('❌ ERROR CREATING USER');
      console.error('========================================');
      console.error('Error object:', err);
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
      console.error('========================================\n');
      
      setError(err.message || 'Failed to create user. Please try again.');
    } finally {
      console.log('🏁 Setting loading to false');
      setLoading(false);
    }
  };

  const roleOptions = [
    { 
      value: 'client', 
      label: 'Client', 
      description: 'View own projects only' 
    },
    { 
      value: 'project_manager', 
      label: 'Project Manager', 
      description: 'Manage specific projects' 
    },
    { 
      value: 'manager', 
      label: 'Manager', 
      description: 'Manage users and projects' 
    },
    { 
      value: 'admin', 
      label: 'Admin', 
      description: 'Full system access' 
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      {/* Background effects */}
      <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      
      <div className="relative max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-500/20 rounded-xl backdrop-blur-sm border border-purple-500/20">
              <UserPlus className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Create New User</h1>
              <p className="text-slate-400 mt-1">
                Add a new team member with the appropriate access level and permissions
              </p>
            </div>
          </div>
        </motion.div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Full Name *
                </label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="john@example.com"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Must be at least 6 characters long
                </p>
              </div>

              {/* Phone & Company - Two Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Company Name
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      name="companyName"
                      value={form.companyName}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      placeholder="Acme Inc."
                    />
                  </div>
                </div>
              </div>

              {/* Job Title */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Job Title
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    name="jobTitle"
                    value={form.jobTitle}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="Project Coordinator"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  User Role *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {roleOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`relative flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        form.role === option.value
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={option.value}
                        checked={form.role === option.value}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      <Shield className={`w-5 h-5 mt-0.5 mr-3 ${
                        form.role === option.value ? 'text-purple-400' : 'text-slate-400'
                      }`} />
                      <div className="flex-1">
                        <div className={`font-medium ${
                          form.role === option.value ? 'text-white' : 'text-slate-300'
                        }`}>
                          {option.label}
                        </div>
                        <div className="text-sm text-slate-400">
                          {option.description}
                        </div>
                      </div>
                      {form.role === option.value && (
                        <CheckCircle2 className="w-5 h-5 text-purple-400 ml-2" />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-red-400">Error</div>
                    <div className="text-sm text-red-300">{error}</div>
                  </div>
                </motion.div>
              )}

              {/* Success Message */}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-green-400">Success!</div>
                    <div className="text-sm text-green-300">
                      User created successfully and role assigned.
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating User...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Create User Account
                  </span>
                )}
              </Button>
            </form>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminUserCreate;