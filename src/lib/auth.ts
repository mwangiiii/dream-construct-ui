import { supabase } from './supabaseClient';


export async function signUp({ email, password, fullName }: { email: string; password: string; fullName: string }) {
  // 1. Sign up user in Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error('User not returned from signUp');

  // 2. Insert into profiles table
  const { error: profileError } = await supabase.from('profiles').insert({
    id: user.id,
    full_name: fullName,
  });
  if (profileError) throw profileError;

  // 3. Assign default role (client) in user_roles
  // First, get the role_id for 'client' from roles table
  const { data: roleRows, error: roleError } = await supabase
    .from('roles')
    .select('role_id')
    .eq('role_name', 'client')
    .single();
  if (roleError) throw roleError;
  const roleId = roleRows.role_id;
  const { error: userRoleError } = await supabase.from('user_roles').insert({
    user_id: user.id,
    role_id: roleId,
  });
  if (userRoleError) throw userRoleError;

  // 4. (Optional) Set user status to 'active' if you have a user_statuses join table
  // If you have a user_statuses join table, insert here. If not, skip this step.

  return data;
}

export async function signIn({ email, password }: { email: string; password: string }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
