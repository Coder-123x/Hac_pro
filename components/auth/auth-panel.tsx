"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { friendlyError } from "@/lib/supabase/messages";
import { validateEmail, validatePassword } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useLanguage } from "@/components/i18n/language-provider";

export function AuthPanel({ initialMode = "sign-in" }: { initialMode?: "sign-in" | "sign-up" }) {
  const { t } = useLanguage();
  const mode = initialMode;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!getSupabaseEnv()) {
    return (
      <section className="editorial-panel max-w-md p-5 text-sm text-amber-950">
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
      setMessage(t("accountCreated"));
    } else {
      window.location.reload();
    }
    setBusy(false);
  }

  return (
    <section className="glass-panel w-full max-w-md p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between border-b border-[var(--line)] pb-4"><p className="eyebrow">EDU / ACCESS</p><LanguageSwitcher /></div>
      <div className="mb-5">
        <p className="text-sm text-[var(--muted)]">{t("familyWorkspaceLabel")}</p>
        <h1 className="display-type mt-2 text-3xl font-semibold text-[var(--ink)]">
          {mode === "sign-in" ? t("signIn") : t("createAccount")}
        </h1>
      </div>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <label className="block text-sm font-medium text-slate-800">
          {t("email")}
          <input
            className="mt-2 block w-full rounded-sm border px-3 py-2 text-[var(--ink)] outline-none"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          {t("password")}
          <input
            className="mt-2 block w-full rounded-sm border px-3 py-2 text-[var(--ink)] outline-none"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {message && <p className="text-sm text-rose-700" role="alert">{message}</p>}
        <Button className="w-full" type="submit" disabled={busy}>
          {busy ? t("pleaseWait") : mode === "sign-in" ? t("signIn") : t("createAccount")}
        </Button>
      </form>
      <Link
        className="editorial-link mt-5 inline-block text-sm"
        href={mode === "sign-in" ? "/signup" : "/"}
      >
        {mode === "sign-in" ? t("needAccount") : t("alreadyHaveAccount")}
      </Link>
    </section>
  );
}
