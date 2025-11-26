import { supabase } from './supabaseClient';

export async function signUp({ email, password, fullName }: { email: string; password: string; fullName: string }) {
  // Sign up user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  if (error) throw error;
  // Optionally, insert into profiles table (if not handled by trigger)
  // await supabase.from('profiles').insert({ id: data.user?.id, full_name: fullName });
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
