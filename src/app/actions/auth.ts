"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAllowedEmails } from "@/lib/env";
import { messageUrl } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(messageUrl("/login", "error", "Enter a valid email and password."));
  }

  if (!getAllowedEmails().includes(parsed.data.email.toLowerCase())) {
    redirect(messageUrl("/login", "error", "This account is not authorized."));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    redirect(messageUrl("/login", "error", error.message));
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
