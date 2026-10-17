"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/messages";
import { Button } from "@/components/ui/button";
import { defaultSharingPreferences, sharingLabels, type SharingPreferences } from "@/lib/sharing";

type Props = { familyId: string; role: "parent" | "student" };
const columns = { budgetSummaryShared: "budget_summary_shared", collegeComparisonsShared: "college_comparisons_shared", scholarshipProgressShared: "scholarship_progress_shared", professionalDevelopmentShared: "professional_development_shared" } as const;

export function FamilySharing({ familyId, role }: Props) {
  const [preferences, setPreferences] = useState<SharingPreferences>(defaultSharingPreferences);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function load() {
    setLoading(true); setMessage(null); const supabase = createClient(); const { data: auth } = await supabase.auth.getUser();
    let query = supabase.from("family_sharing_preferences").select("budget_summary_shared, college_comparisons_shared, scholarship_progress_shared, professional_development_shared").eq("family_id", familyId);
    if (role === "student" && auth.user) query = query.eq("student_id", auth.user.id);
    const { data, error } = await query;
    if (error) setMessage("Sharing settings are unavailable until the Phase 7 migration is applied.");
    if (data?.length) setPreferences({ budgetSummaryShared: data.some((row) => row.budget_summary_shared), collegeComparisonsShared: data.some((row) => row.college_comparisons_shared), scholarshipProgressShared: data.some((row) => row.scholarship_progress_shared), professionalDevelopmentShared: data.some((row) => row.professional_development_shared) });
    setLoading(false);
  }
  useEffect(() => { void load(); }, [familyId]);
  async function save(next: SharingPreferences) {
    setPreferences(next); setSaving(true); setMessage(null); const { data: auth } = await createClient().auth.getUser();
    if (!auth.user) { setMessage("Your session expired. Please sign in again."); setSaving(false); return; }
    const { error } = await createClient().from("family_sharing_preferences").upsert({ family_id: familyId, student_id: auth.user.id, budget_summary_shared: next.budgetSummaryShared, college_comparisons_shared: next.collegeComparisonsShared, scholarship_progress_shared: next.scholarshipProgressShared, professional_development_shared: next.professionalDevelopmentShared }, { onConflict: "family_id,student_id" });
    if (error) { setMessage(friendlyError(error)); await load(); } setSaving(false);
  }
  if (loading) return <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600" aria-busy="true">Loading sharing settings…</section>;
  if (role === "parent") return <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6"><h3 className="text-xl font-semibold text-slate-950">Shared family overview</h3><p className="mt-1 text-sm text-slate-600">You can see only categories the student has explicitly shared. Revocation blocks future database access; it cannot erase information already viewed or copied.</p><ul className="mt-4 grid gap-2 sm:grid-cols-2">{(Object.keys(columns) as Array<keyof SharingPreferences>).map((key) => <li key={key} className="rounded-md bg-slate-50 px-3 py-2 text-sm"><span className="font-medium">{sharingLabels[key]}</span>: {preferences[key] ? "Shared" : "Not shared"}</li>)}</ul><p className="mt-4 text-xs text-slate-500">Detailed expenses, personal notes, documents and sensitive profile fields are not included in these sharing switches.</p></section>;
  return <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6"><h3 className="text-xl font-semibold text-slate-950">Student sharing controls</h3><p className="mt-1 text-sm text-slate-600">Choose exactly what an active parent in this family may read. Everything is private by default. Turning a switch off revokes future database reads but cannot erase anything previously viewed or copied.</p><div className="mt-4 space-y-3">{(Object.keys(columns) as Array<keyof SharingPreferences>).map((key) => <label key={key} className="flex items-start gap-3 rounded-md border border-slate-200 p-3"><input className="mt-1" type="checkbox" checked={preferences[key]} disabled={saving} onChange={(event) => void save({ ...preferences, [key]: event.target.checked })} /><span><span className="block font-medium text-slate-900">{sharingLabels[key]}</span><span className="block text-sm text-slate-600">{key === "budgetSummaryShared" ? "Allows the family budget summary and related shared affordability information." : key === "collegeComparisonsShared" ? "Allows saved college and branch comparisons." : key === "scholarshipProgressShared" ? "Allows scholarship records and application progress." : "No professional-development module exists yet; this switch is reserved and shares nothing currently."}</span></span></label>)}</div>{message && <p className="mt-3 text-sm text-rose-700" role="alert">{message}</p>}<Button className="mt-4" type="button" disabled={saving} onClick={() => void load()}>Refresh sharing state</Button></section>;
}
