import { redirect } from "next/navigation";
import { getAdminEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function getAdminUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  const adminEmail = getAdminEnv().ADMIN_EMAIL.toLowerCase();
  if (data.user.email?.toLowerCase() !== adminEmail) {
    return null;
  }

  return { user: data.user, supabase };
}

export async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/login");
  }
  return admin;
}
