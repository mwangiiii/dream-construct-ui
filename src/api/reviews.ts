import { supabase } from "../lib/supabaseClient";

export async function addReview(text: string, userId: string) {
  return await supabase.from("reviews").insert([{ text, user_id: userId }]);
}

export async function getReviews() {
  return await supabase.from("reviews").select("id, text, user_id, created_at").order("created_at", { ascending: false });
}

export async function deleteReview(id: number) {
  return await supabase.from("reviews").delete().eq("id", id);
}
