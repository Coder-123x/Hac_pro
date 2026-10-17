"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { friendlyError } from "@/lib/supabase/messages";
import { validateEmail, validatePassword } from "@/lib/validation";
import { Button } from "@/components/ui/button";

export function AuthPanel() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!getSupabaseEnv()) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and add the public URL and anon key.
      </section>
    );
  }

  async function submit() {
    const emailResult = validateEmail(email);
    const passwordResult = validatePassword(password);
    if (!emailResult.ok) return setMessage(emailResult.message);
    if (!passwordResult.ok) return setMessage(passwordResult.message);

    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const result = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });

    if (result.error) {
      setMessage(friendlyError(result.error));
    } else if (mode === "sign-up" && !result.data.session) {
      setMessage("Account created. Check your email to confirm it, then sign in.");
    } else {
      window.location.reload();
    }
    setBusy(false);
  }

  return (
    <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <p className="text-sm font-medium text-slate-600">Family workspace</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">
          {mode === "sign-in" ? "Sign in" : "Create your account"}
        </h1>
      </div>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label className="block text-sm font-medium text-slate-800">
          Email
          <input
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Password
          <input
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {message && <p className="text-sm text-rose-700" role="alert">{message}</p>}
        <Button className="w-full" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <button
        className="mt-4 text-sm text-slate-700 underline underline-offset-4 hover:text-slate-950"
        type="button"
        onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setMessage(null); }}
      >
        {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </section>
  );
}
