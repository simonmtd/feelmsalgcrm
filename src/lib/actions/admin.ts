"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { runHubspotSync } from "@/lib/jobs/sync-hubspot";
import { runDailyAssignment } from "@/lib/jobs/assign-daily-leads";

export interface FormActionState {
  error?: string;
  success?: string;
}

export async function createSeller(
  _prevState: FormActionState | undefined,
  formData: FormData
): Promise<FormActionState> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "seller");

  if (!email || !password) {
    return { error: "E-post og passord er påkrevd." };
  }
  if (password.length < 8) {
    return { error: "Passordet må være minst 8 tegn." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || null, role },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/sellers");
  return { success: `${email} ble opprettet.` };
}

export async function setSellerActive(sellerId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", sellerId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/sellers");
}

export async function createNiche(
  _prevState: FormActionState | undefined,
  formData: FormData
): Promise<FormActionState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Navn er påkrevd." };

  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const supabase = createAdminClient();
  const { error } = await supabase.from("niches").insert({ name, slug });
  if (error) return { error: error.message };

  revalidatePath("/admin/niches");
  return { success: `Niche "${name}" ble opprettet.` };
}

export async function reassignLead(leadId: string, sellerId: string | null) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("leads")
    .update({
      assigned_to: sellerId,
      status: sellerId ? "assigned" : "new",
      assigned_date: sellerId ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", leadId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/leads");
}

export async function classifyLeadNiche(leadId: string, nicheId: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("leads")
    .update({ niche_id: nicheId })
    .eq("id", leadId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/leads");
}

export async function updateDailyLeadCount(value: number) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("app_settings")
    .update({ value })
    .eq("key", "daily_lead_count");
  if (error) throw new Error(error.message);

  revalidatePath("/admin/settings");
}

export async function triggerHubspotSync() {
  await requireAdmin();
  const result = await runHubspotSync();
  revalidatePath("/admin/sync");
  return result;
}

export async function triggerDailyAssignment() {
  await requireAdmin();
  const result = await runDailyAssignment();
  revalidatePath("/admin/leads");
  return result;
}
