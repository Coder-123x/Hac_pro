"use client";

import { useLanguage } from "@/components/i18n/language-provider";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return <label className="inline-flex items-center gap-2 text-sm text-slate-700"><span className="sr-only">{t("language")}</span><select aria-label={t("language")} className="rounded-md border border-slate-300 bg-white/80 px-2 py-2 focus-visible:outline-2 focus-visible:outline-indigo-600" value={language} onChange={(event) => setLanguage(event.target.value as "en" | "te")}><option value="en">{t("english")}</option><option value="te">{t("telugu")}</option></select></label>;
}
