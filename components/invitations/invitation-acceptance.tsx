"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/messages";
import { validateInvitationToken } from "@/lib/validation";
import { Button } from "@/components/ui/button";

export function InvitationAcceptance({ initialToken = "" }: { initialToken?: string }) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Remove the one-time secret from browser history after copying it into
    // component memory. It is never persisted or needed for a refresh.
    if (initialToken && window.location.search.includes("token=")) {
      window.history.replaceState(null, "", "/invite");
    }
  }, [initialToken]);

  async function accept() {
    const result = validateInvitationToken(token);
    if (!result.ok) return setMessage(result.message);
    setBusy(true);
    setMessage(null);
    const { error } = await createClient().rpc("accept_family_invitation", {
      p_invitation_token: token.trim(),
    });
    if (error) {
      setMessage(friendlyError(error));
    } else {
      setToken("");
      router.replace("/");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <section className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-600">Family invitation</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-950">Join a family workspace</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Accept the invitation using the one-time token from the link you received. It will not be saved by this page.</p>
      <label className="mt-5 block text-sm font-medium text-slate-800" htmlFor="invitation-token">Invitation token</label>
      <input id="invitation-token" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" spellCheck={false} />
      {message && <p className="mt-3 text-sm text-rose-700" role="alert">{message}</p>}
      <Button className="mt-4" type="button" disabled={busy} onClick={() => void accept()}>{busy ? "Accepting…" : "Accept invitation"}</Button>
    </section>
  );
}
