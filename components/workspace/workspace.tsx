"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/messages";
import { validateEmail, validateWorkspaceName } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { AffordabilityPlanner } from "@/components/affordability/planner";
import { CollegeSimulator } from "@/components/colleges/simulator";
import { ScholarshipNavigator } from "@/components/scholarships/navigator";
import { FamilySharing } from "@/components/sharing/family-sharing";
import { CareerRoadmap } from "@/components/roadmap/roadmap";
import { DecisionDashboard } from "@/components/dashboard/decision-dashboard";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useLanguage } from "@/components/i18n/language-provider";

export type FamilyMembership = {
  familyId: string;
  familyName: string;
  role: "parent" | "student";
  members: Array<{ userId: string; role: "parent" | "student" }>;
};

function WorkspaceCreationForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createWorkspace() {
    const result = validateWorkspaceName(name);
    if (!result.ok) return setMessage(result.message);
    setBusy(true);
    setMessage(null);
    const { error } = await createClient().rpc("create_family_workspace", { p_name: name.trim() });
    if (error) setMessage(friendlyError(error));
    else { setName(""); onCreated(); }
    setBusy(false);
  }

  return (
    <section className="workspace-frame p-6">
      <p className="section-index">05 — SETUP</p><h2 className="display-type mt-3 text-2xl font-semibold text-[var(--ink)]">{t("createWorkspace")}</h2>
      <p className="mt-1 text-sm text-slate-600">{t("workspaceIntro")}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="workspace-name">{t("workspaceName")}</label>
        <input id="workspace-name" className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2" placeholder={t("workspacePlaceholder")} value={name} onChange={(event) => setName(event.target.value)} />
        <Button type="button" disabled={busy} onClick={() => void createWorkspace()}>{busy ? t("creating") : t("createWorkspace")}</Button>
      </div>
      {message && <p className="mt-3 text-sm text-rose-700" role="alert">{message}</p>}
    </section>
  );
}

function InvitationForm({ familyId, onCreated }: { familyId: string; onCreated: () => void }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"student" | "parent">("student");
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createInvitation() {
    const result = validateEmail(email);
    if (!result.ok) return setMessage(result.message);
    setBusy(true);
    setMessage(null);
    setInvitationUrl(null);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await createClient().rpc("create_family_invitation", {
      p_family_id: familyId,
      p_recipient_email: email.trim().toLowerCase(),
      p_role: role,
      p_expires_at: expiresAt,
    });
    if (error) {
      setMessage(friendlyError(error));
    } else if (data?.[0]?.invitation_token) {
      // Keep the one-time secret only in component memory. Do not persist or log it.
      setInvitationUrl(`${window.location.origin}/invite?token=${encodeURIComponent(data[0].invitation_token)}`);
      setEmail("");
      onCreated();
    } else {
      setMessage("The invitation was not returned. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <h3 className="font-medium text-slate-900">{t("inviteMember")}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="sr-only" htmlFor={`invite-email-${familyId}`}>{t("inviteeEmail")}</label>
        <input id={`invite-email-${familyId}`} className="rounded-md border border-slate-300 px-3 py-2" type="email" placeholder="member@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        <label className="sr-only" htmlFor={`invite-role-${familyId}`}>{t("inviteeRole")}</label>
        <select id={`invite-role-${familyId}`} className="rounded-md border border-slate-300 px-3 py-2" value={role} onChange={(event) => setRole(event.target.value as "student" | "parent")}>
          <option value="student">Student</option>
          <option value="parent">Parent</option>
        </select>
        <Button type="button" disabled={busy} onClick={() => void createInvitation()}>{busy ? t("creating") : t("createInvite")}</Button>
      </div>
      {invitationUrl && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
          <p className="font-medium">{t("oneTimeInvite")}</p>
          <p className="mt-1 break-all font-mono text-xs">{invitationUrl}</p>
          <button className="mt-2 underline underline-offset-4" type="button" onClick={() => void navigator.clipboard?.writeText(invitationUrl)}>Copy URL</button>
          <p className="mt-2 text-xs">{t("keepInvitePrivate")}</p>
        </div>
      )}
      {message && <p className="mt-3 text-sm text-rose-700" role="alert">{message}</p>}
    </div>
  );
}

export function Workspace({ email, userId, memberships }: { email: string; userId: string; memberships: FamilyMembership[] }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [message, setMessage] = useState<string | null>(null);

  async function signOut() {
    const { error } = await createClient().auth.signOut();
    if (error) setMessage(friendlyError(error));
    else window.location.reload();
  }

  return (
    <main className="editorial-shell mx-auto min-h-screen max-w-7xl overflow-x-hidden px-5 py-6 sm:px-8 sm:py-10">
      <header className="editorial-grid items-end border-b border-[var(--line)] pb-7">
        <div className="col-span-12 min-w-0 md:col-span-8">
          <p className="eyebrow">AP • FAMILY DECISION SUPPORT</p>
          <p className="mt-4 text-sm text-[var(--muted)]">Signed in as {email}</p>
          <h1 className="display-type mt-2 text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-6xl">{t("familyWorkspace")}</h1>
        </div>
        <div className="col-span-12 flex items-center gap-3 md:col-span-4 md:justify-end"><LanguageSwitcher /><Button type="button" onClick={() => void signOut()}>{t("signOut")}</Button></div>
      </header>
      {message && <p className="mt-4 text-sm text-rose-700" role="alert">{message}</p>}
      <div className="mt-8 space-y-6">
        {memberships.map((membership) => (
          <section key={membership.familyId} className="workspace-frame p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="section-index">06 — FAMILY WORKSPACE</p>
                <h2 className="display-type mt-2 break-words text-2xl font-semibold text-[var(--ink)]">{membership.familyName}</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm capitalize text-slate-700">Your role: {membership.role}</span>
            </div>
            <div className="mt-5">
              <h3 className="font-medium text-slate-900">Visible members and roles</h3>
              {membership.members.length ? (
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {membership.members.map((member) => <li key={member.userId} className="flex justify-between rounded-md bg-slate-50 px-3 py-2"><span>Family member</span><span className="capitalize">{member.role}</span></li>)}
                </ul>
              ) : <p className="mt-2 text-sm text-slate-600">No member records are visible to this role yet.</p>}
            </div>
            <div className="workspace-intro mt-5 border p-4">
              <h3 className="display-type font-medium text-[var(--ink)]">Education plan</h3>
              <p className="mt-1 text-sm text-slate-600">Start with your direction, then work through budget, options, opportunities and career milestones below.</p>
            </div>
            <DecisionDashboard familyId={membership.familyId} userId={userId} role={membership.role} />
            <AffordabilityPlanner familyId={membership.familyId} role={membership.role} />
            <CollegeSimulator familyId={membership.familyId} role={membership.role} />
            <ScholarshipNavigator familyId={membership.familyId} role={membership.role} />
            <FamilySharing familyId={membership.familyId} role={membership.role} />
            <CareerRoadmap familyId={membership.familyId} userId={userId} role={membership.role} />
            {membership.role === "parent" && <InvitationForm familyId={membership.familyId} onCreated={() => router.refresh()} />}
          </section>
        ))}
        <WorkspaceCreationForm onCreated={() => router.refresh()} />
      </div>
    </main>
  );
}
