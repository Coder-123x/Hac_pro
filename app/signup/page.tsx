import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth/auth-panel";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function SignupPage() {
  if (!getSupabaseEnv()) {
    return (
      <main className="editorial-shell flex min-h-screen items-center justify-center px-6 py-16">
        <AuthPanel initialMode="sign-up" />
      </main>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <main className="editorial-shell flex min-h-screen items-center justify-center px-6 py-16">
      <AuthPanel initialMode="sign-up" />
    </main>
  );
}
