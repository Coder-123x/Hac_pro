import { AuthPanel } from "@/components/auth/auth-panel";
import { InvitationAcceptance } from "@/components/invitations/invitation-acceptance";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type InvitePageProps = { searchParams: Promise<{ token?: string }> };

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const params = await searchParams;
  if (!getSupabaseEnv()) {
    return <main className="editorial-shell mx-auto flex min-h-screen max-w-2xl items-center px-6 py-16"><p className="editorial-panel p-5 text-amber-950">Supabase is not configured. Add the public Supabase variables before accepting invitations.</p></main>;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <main className="editorial-shell mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 py-16">
      {!user && <p className="w-full max-w-md rounded-lg bg-slate-100 p-4 text-sm text-slate-700">Sign in or create an account first. Then return to this invitation link.</p>}
      {user ? <InvitationAcceptance initialToken={params.token} /> : <AuthPanel />}
    </main>
  );
}
