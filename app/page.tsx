import { AuthPanel } from "@/components/auth/auth-panel";
import { Workspace, type FamilyMembership } from "@/components/workspace/workspace";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type MembershipRow = {
  family_id: string;
  role: "parent" | "student";
  status: string;
  families: { id: string; name: string } | null;
};

export default async function Home() {
  if (!getSupabaseEnv()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium text-slate-600">Project foundation</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Engineering education planning for families</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">Add Supabase environment variables to start the authenticated family workspace.</p>
        <div className="mt-8"><AuthPanel /></div>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16"><AuthPanel /></main>;
  }

  const { data: rows, error } = await supabase
    .from("family_members")
    .select("family_id, role, status, families(id, name)")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) {
    return <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16"><p className="rounded-lg bg-rose-50 p-5 text-rose-800" role="alert">We could not load your family memberships. Check that the Phase 2 migration has been applied, then try again.</p></main>;
  }

  const memberships: FamilyMembership[] = [];
  for (const row of (rows ?? []) as unknown as MembershipRow[]) {
    if (!row.families) continue;
    const { data: members } = await supabase
      .from("family_members")
      .select("user_id, role")
      .eq("family_id", row.family_id)
      .eq("status", "active");
    memberships.push({
      familyId: row.family_id,
      familyName: row.families.name,
      role: row.role,
      members: (members ?? []).map((member) => ({ userId: member.user_id, role: member.role as "parent" | "student" })),
    });
  }

  return <Workspace email={user.email ?? "authenticated user"} memberships={memberships} />;
}
