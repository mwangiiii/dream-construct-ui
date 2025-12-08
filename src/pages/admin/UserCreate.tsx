import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  UserPlus, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/GlassCard';

type AppRole = 'admin' | 'manager' | 'client';

interface CreateUserForm {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  companyName: string;
  jobTitle: string;
  role: AppRole;
}

const UserCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // === STRICT AUTH GUARD ===
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
        const returnTo = encodeURIComponent('/admin/create-user');
        navigate(`/login?redirectTo=${returnTo}`, { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!form.fullName.trim()) return false;
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return false;
    if (form.password.length < 6) return false;
    return true;
  };

  const createUser = async () => {
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim() || null,
        companyName: form.companyName.trim() || null,
        jobTitle: form.jobTitle.trim() || null,
        role: form.role,
      },
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to create user');
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      setError('Please fill in all required fields correctly');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createUser();
      setSuccess(true);
      setTimeout(() => {
        setForm({
          fullName: '', email: '', password: '', phone: '', companyName: '', jobTitle: '', role: 'client'
        });
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 'client', label: 'Client', description: 'Can view their own projects' },
    { value: 'manager', label: 'Manager', description: 'Can manage users and projects' },
    { value: 'admin', label: 'Admin', description: 'Full system access' },
    { value: 'project_manager', label: 'Project Manager', description: 'Project Manager Role' },
    { value: 'surveyor', label: 'Surveyor', description: 'Quantity surveyor role' },
    { value: 'finance', label: 'Finance', description: 'Finance role' },
    

  ] as const;

  if (checkingAuth || !session) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <span className="text-lg text-muted-foreground">Loading...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle animated gradient background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="container mx-auto px-2 sm:px-4 md:px-6 py-10 md:py-16 max-w-2xl md:max-w-3xl lg:max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-10 md:mb-16"
        >
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            Create
            <br />
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-glow">
              New User
            </span>
          </h1>
          <p className="mt-4 sm:mt-8 text-base sm:text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Add team members with secure, role-based access control
          </p>
        </motion.div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          <GlassCard className="p-4 sm:p-8 md:p-10 lg:p-16 backdrop-blur-xl">
            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8 md:space-y-10">

              {/* Full Name */}
              <div className="space-y-2 sm:space-y-3">
                <label className="text-base sm:text-lg font-medium text-foreground">Full Name <span className="text-primary">*</span></label>
                <input
                  type="text"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                  placeholder="John Doe"
                  className="w-full px-4 sm:px-6 py-4 sm:py-5 bg-background/50 border border-border rounded-2xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-base sm:text-lg"
                />
              </div>

              {/* Email */}
              <div className="space-y-2 sm:space-y-3">
                <label className="text-base sm:text-lg font-medium text-foreground">Email Address <span className="text-primary">*</span></label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="john@company.com"
                  className="w-full px-4 sm:px-6 py-4 sm:py-5 bg-background/50 border border-border rounded-2xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-base sm:text-lg"
                />
              </div>

              {/* Password */}
              <div className="space-y-2 sm:space-y-3">
                <label className="text-base sm:text-lg font-medium text-foreground">Password <span className="text-primary">*</span></label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full px-4 sm:px-6 py-4 sm:py-5 bg-background/50 border border-border rounded-2xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-base sm:text-lg"
                />
                <p className="text-xs sm:text-sm text-muted-foreground">Minimum 6 characters required</p>
              </div>

              {/* Phone & Company */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                <div className="space-y-2 sm:space-y-3">
                  <label className="text-base sm:text-lg font-medium text-foreground">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+254 700 000 000"
                    className="w-full px-4 sm:px-6 py-4 sm:py-5 bg-background/50 border border-border rounded-2xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-base sm:text-lg"
                  />
                </div>

                <div className="space-y-2 sm:space-y-3">
                  <label className="text-base sm:text-lg font-medium text-foreground">Company Name</label>
                  <input
                    type="text"
                    name="companyName"
                    value={form.companyName}
                    onChange={handleChange}
                    placeholder="Dream Construct Ltd"
                    className="w-full px-4 sm:px-6 py-4 sm:py-5 bg-background/50 border border-border rounded-2xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-base sm:text-lg"
                  />
                </div>
              </div>

              {/* Job Title */}
              <div className="space-y-2 sm:space-y-3">
                <label className="text-base sm:text-lg font-medium text-foreground">Job Title</label>
                <input
                  type="text"
                  name="jobTitle"
                  value={form.jobTitle}
                  onChange={handleChange}
                  placeholder="Site Engineer"
                  className="w-full px-4 sm:px-6 py-4 sm:py-5 bg-background/50 border border-border rounded-2xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-base sm:text-lg"
                />
              </div>

              {/* Role Selection – Apple-style cards */}
              <div className="space-y-2 sm:space-y-4">
                <label className="text-base sm:text-lg font-medium text-foreground">User Role <span className="text-primary">*</span></label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4">
                  {roleOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`relative block p-4 sm:p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 backdrop-blur-sm ${
                        form.role === option.value
                          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                          : 'border-border bg-background/30 hover:border-primary/30'
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
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`text-base sm:text-xl font-semibold ${form.role === option.value ? 'text-primary' : 'text-foreground'}`}>
                            {option.label}
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground mt-1">{option.description}</div>
                        </div>
                        {form.role === option.value && (
                          <CheckCircle2 className="w-6 sm:w-7 h-6 sm:h-7 text-primary" />
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Messages */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 sm:p-5 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center gap-3 sm:gap-4 text-destructive"
                >
                  <AlertCircle className="w-5 sm:w-6 h-5 sm:h-6 flex-shrink-0" />
                  <p className="text-base sm:text-lg">{error}</p>
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 sm:p-5 bg-green-500/10 border border-green-500/30 rounded-2xl flex items-center gap-3 sm:gap-4 text-green-400"
                >
                  <CheckCircle2 className="w-5 sm:w-6 h-5 sm:h-6 flex-shrink-0" />
                  <p className="text-base sm:text-lg">User created successfully and activated!</p>
                </motion.div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                size="lg"
                className="w-full h-14 sm:h-16 text-lg sm:text-xl font-semibold rounded-2xl bg-primary hover:bg-primary/90 text-background shadow-xl hover:shadow-primary/30 transition-all duration-300"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2 sm:gap-3">
                    <div className="w-5 sm:w-6 h-5 sm:h-6 border-2 sm:border-3 border-background/30 border-t-background rounded-full animate-spin" />
                    Creating User...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2 sm:gap-3">
                    <UserPlus className="w-5 sm:w-6 h-5 sm:h-6" />
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

export default UserCreate;