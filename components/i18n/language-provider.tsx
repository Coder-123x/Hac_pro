"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations, type AppLanguage, type TranslationKey } from "@/lib/i18n";

type LanguageContextValue = { language: AppLanguage; setLanguage: (language: AppLanguage) => void; t: (key: TranslationKey) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("en");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem("education-planner-language");
    if (stored === "en" || stored === "te") setLanguageState(stored);
    setHydrated(true);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    if (hydrated) window.localStorage.setItem("education-planner-language", language);
  }, [language, hydrated]);
  const value = useMemo(() => ({ language, setLanguage: (next: AppLanguage) => setLanguageState(next), t: (key: TranslationKey) => translations[language][key] }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
