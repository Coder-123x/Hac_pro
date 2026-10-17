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

export type FamilyMembership = {
  familyId: string;
  familyName: string;
  role: "parent" | "student";
  members: Array<{ userId: string; role: "parent" | "student" }>;
};

function WorkspaceCreationForm({ onCreated }: { onCreated: () => void }) {
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
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Create a family workspace</h2>
      <p className="mt-1 text-sm text-slate-600">Start a shared space for education planning. You will be added as a parent.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="workspace-name">Family workspace name</label>
        <input id="workspace-name" className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2" placeholder="e.g. Rao family plan" value={name} onChange={(event) => setName(event.target.value)} />
        <Button type="button" disabled={busy} onClick={() => void createWorkspace()}>{busy ? "Creating…" : "Create workspace"}</Button>
      </div>
      {message && <p className="mt-3 text-sm text-rose-700" role="alert">{message}</p>}
    </section>
  );
}

function InvitationForm({ familyId, onCreated }: { familyId: string; onCreated: () => void }) {
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
      <h3 className="font-medium text-slate-900">Invite a family member</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="sr-only" htmlFor={`invite-email-${familyId}`}>Invitee email</label>
        <input id={`invite-email-${familyId}`} className="rounded-md border border-slate-300 px-3 py-2" type="email" placeholder="member@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        <label className="sr-only" htmlFor={`invite-role-${familyId}`}>Invitee role</label>
        <select id={`invite-role-${familyId}`} className="rounded-md border border-slate-300 px-3 py-2" value={role} onChange={(event) => setRole(event.target.value as "student" | "parent")}>
          <option value="student">Student</option>
          <option value="parent">Parent</option>
        </select>
        <Button type="button" disabled={busy} onClick={() => void createInvitation()}>{busy ? "Creating…" : "Create invite"}</Button>
      </div>
      {invitationUrl && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
          <p className="font-medium">One-time invitation URL</p>
          <p className="mt-1 break-all font-mono text-xs">{invitationUrl}</p>
          <button className="mt-2 underline underline-offset-4" type="button" onClick={() => void navigator.clipboard?.writeText(invitationUrl)}>Copy URL</button>
          <p className="mt-2 text-xs">Keep this URL private. It is held only in this page until you leave or refresh.</p>
        </div>
      )}
      {message && <p className="mt-3 text-sm text-rose-700" role="alert">{message}</p>}
    </div>
  );
}

export function Workspace({ email, memberships }: { email: string; memberships: FamilyMembership[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function signOut() {
    const { error } = await createClient().auth.signOut();
    if (error) setMessage(friendlyError(error));
    else window.location.reload();
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-sm text-slate-600">Signed in as {email}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Your family education workspace</h1>
        </div>
        <Button type="button" onClick={() => void signOut()}>Sign out</Button>
      </header>
      {message && <p className="mt-4 text-sm text-rose-700" role="alert">{message}</p>}
      <div className="mt-8 space-y-6">
        {memberships.map((membership) => (
          <section key={membership.familyId} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-600">Family workspace</p>
                <h2 className="text-xl font-semibold text-slate-950">{membership.familyName}</h2>
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
            <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-4">
              <h3 className="font-medium text-slate-900">Education plan</h3>
              <p className="mt-1 text-sm text-slate-600">No education plan has been started yet. Planning tools will appear here in a later phase.</p>
            </div>
            <AffordabilityPlanner familyId={membership.familyId} role={membership.role} />
            <CollegeSimulator familyId={membership.familyId} role={membership.role} />
            <ScholarshipNavigator familyId={membership.familyId} role={membership.role} />
            <FamilySharing familyId={membership.familyId} role={membership.role} />
            {membership.role === "parent" && <InvitationForm familyId={membership.familyId} onCreated={() => router.refresh()} />}
          </section>
        ))}
        <WorkspaceCreationForm onCreated={() => router.refresh()} />
      </div>
    </main>
  );
}
