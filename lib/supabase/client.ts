import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./config";

export function createClient(): SupabaseClient {
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase is not configured.");
  return createBrowserClient(env.url, env.anonKey);
}
