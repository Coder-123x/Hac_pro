"use client";

import Link from "next/link";
import { AuthPanel } from "@/components/auth/auth-panel";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useLanguage } from "@/components/i18n/language-provider";

export function LandingPage() {
  const { language } = useLanguage();
  const telugu = language === "te";
  const copy = telugu ? {
    kicker: "ఆంధ్రప్రదేశ్ • విద్యా నిర్ణయ వేదిక",
    title: "మార్గాన్ని ప్లాన్ చేయండి. ఖర్చును తెలుసుకోండి. ఆధారాలతో ముందుకు సాగండి.",
    intro: "విద్యార్థి లక్ష్యాలు, కుటుంబ బడ్జెట్, కళాశాల ఎంపికలు, స్కాలర్‌షిప్ పనులు మరియు కెరీర్ పురోగతిని ఒక స్పష్టమైన ప్రణాళికగా కలపండి.",
    start: "ప్రణాళిక ప్రారంభించండి",
    explore: "ఇది ఎలా పనిచేస్తుంది",
    issue: "సంచిక 01 / నిర్ణయ సహాయం",
    section: "ఒకే ప్రణాళికలో",
    sectionIntro: "తెలియని సమాచారం తెలియనిదిగానే కనిపిస్తుంది. అంచనాలు, చారిత్రక డేటా మరియు నిర్ధారిత నిధులు వేర్వేరుగా గుర్తించబడతాయి.",
    features: [
      ["01", "లక్ష్యం", "విద్యార్థి ఏ మార్గాన్ని కోరుకుంటున్నాడో, ఏ బ్రాంచీలు సరిపోతాయో నమోదు చేయండి."],
      ["02", "భరించగల ఖర్చు", "నాలుగు సంవత్సరాల ఖర్చును కుటుంబం అందించగల నిధులతో పోల్చండి."],
      ["03", "ఎంపికలు", "అందుబాటులో ఉన్న ఆధారాలతో కళాశాలలు, బ్రాంచీలు మరియు ఆర్థిక అవకాశాలను సరిపోల్చండి."],
      ["04", "తదుపరి పని", "డెడ్‌లైన్లు, పత్రాలు, ఆక్షన్ ప్లాన్‌లు మరియు కెరీర్ మైలురాళ్లను ట్రాక్ చేయండి."],
    ],
    workflow: "ప్రతి నిర్ణయం తదుపరి పనితో ముగుస్తుంది",
    workflowIntro: "మంచి ప్రణాళిక ఒక జాబితా కాదు. పరిస్థితులు మారినప్పుడు బడ్జెట్, ప్రవేశ ఫలితం మరియు నిధుల స్థితిని నవీకరించగల మార్గం.",
    note: "సమాచారం అందుబాటులో లేకపోతే మేము ఊహించము",
    noteBody: "ఫీజులు, కట్‌ఆఫ్‌లు, అర్హతలు లేదా స్కాలర్‌షిప్ అనుమతులను ఈ వేదిక హామీ ఇవ్వదు. ప్రతి మూలాన్ని తనిఖీ చేయండి.",
    access: "మీ కుటుంబ ప్రణాళికకు ప్రవేశం",
    footer: "విద్యా నిర్ణయాలు స్పష్టంగా, కుటుంబంతో కలిసి.",
  } : {
    kicker: "ANDHRA PRADESH • EDUCATION DECISION SUPPORT",
    title: "Plan the route. Know the cost. Move with evidence.",
    intro: "Connect a student’s goal, family budget, college options, scholarship actions and career progress in one clear plan.",
    start: "Start your plan",
    explore: "See how it works",
    issue: "ISSUE 01 / DECISION SUPPORT",
    section: "One plan, clearly marked",
    sectionIntro: "Unknown information stays unknown. Estimates, historical data and confirmed funding are kept distinct.",
    features: [
      ["01", "Direction", "Record the journey, career goal and preferred branches that matter to the student."],
      ["02", "Affordability", "Compare a four-year education estimate with the funds a family can realistically provide."],
      ["03", "Options", "Compare colleges, branches and funding opportunities only where supporting evidence exists."],
      ["04", "Next actions", "Track deadlines, documents, opportunity plans and career milestones."],
    ],
    workflow: "Every decision ends with a next action",
    workflowIntro: "A useful plan is not a static list. Update the budget, admission result or funding status as circumstances change.",
    note: "When evidence is missing, we do not guess",
    noteBody: "The platform does not promise fees, cutoffs, eligibility, scholarship approval or employment. Check every source.",
    access: "Access your family plan",
    footer: "Education decisions, made clearer with your family.",
  };

  return (
    <main className="editorial-shell min-h-screen overflow-hidden">
      <nav className="mx-auto flex max-w-7xl items-center justify-between border-b border-[var(--line)] px-5 py-5 sm:px-8" aria-label="Main navigation">
        <Link href="/" className="display-type text-lg font-semibold tracking-tight">EDU / FAMILY PLAN</Link>
        <div className="flex items-center gap-4"><a className="hidden text-sm text-[var(--muted)] underline-offset-4 hover:underline sm:inline" href="#access">{telugu ? "ప్రవేశం" : "Sign in"}</a><LanguageSwitcher /></div>
      </nav>

      <section className="editorial-grid mx-auto max-w-7xl border-b border-[var(--line)] px-5 py-16 sm:px-8 sm:py-24">
        <div className="col-span-12 md:col-span-8">
          <p className="eyebrow">{copy.kicker}</p>
          <h1 className="display-type mt-6 max-w-4xl text-5xl font-semibold leading-[0.96] sm:text-7xl lg:text-8xl">{copy.title}</h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-[var(--muted)] sm:text-xl">{copy.intro}</p>
          <div className="mt-10 flex flex-wrap items-center gap-5">
            <Link className="inline-flex min-h-11 items-center rounded-sm bg-[var(--cobalt)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--cobalt-dark)]" href="/signup">{copy.start}</Link>
            <a className="editorial-link text-sm font-semibold" href="#how-it-works">{copy.explore} <span aria-hidden="true">↘</span></a>
          </div>
        </div>
        <aside className="col-span-12 flex items-end md:col-span-4 md:justify-end">
          <div className="w-full border-l-2 border-[var(--cobalt)] pl-5 md:max-w-xs"><p className="eyebrow">{copy.issue}</p><p className="mt-5 text-sm leading-6 text-[var(--muted)]">English / తెలుగు<br />Student + family workspace<br />Evidence before certainty</p></div>
        </aside>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl border-b border-[var(--line)] px-5 py-14 sm:px-8 sm:py-20">
        <div className="editorial-grid"><div className="col-span-12 md:col-span-4"><p className="section-index">01 — {copy.section}</p><h2 className="display-type mt-5 text-4xl font-semibold leading-tight sm:text-5xl">{copy.section}</h2></div><p className="col-span-12 max-w-xl text-base leading-7 text-[var(--muted)] md:col-span-5 md:col-start-8">{copy.sectionIntro}</p></div>
        <div className="mt-14 grid border-t border-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
          {copy.features.map(([number, title, body]) => <article key={number} className="border-b border-[var(--line)] py-6 sm:border-r sm:px-6 lg:border-b-0 first:pl-0 last:border-r-0"><p className="section-index">{number}</p><h3 className="display-type mt-8 text-2xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{body}</p></article>)}
        </div>
      </section>

      <section className="editorial-grid mx-auto max-w-7xl border-b border-[var(--line)] px-5 py-14 sm:px-8 sm:py-20"><div className="col-span-12 md:col-span-5"><p className="section-index">02 — WORKFLOW</p><h2 className="display-type mt-5 text-4xl font-semibold leading-tight sm:text-5xl">{copy.workflow}</h2></div><p className="col-span-12 self-end text-base leading-7 text-[var(--muted)] md:col-span-5 md:col-start-8">{copy.workflowIntro}</p></section>

      <section className="mx-auto grid max-w-7xl border-b border-[var(--line)] bg-[var(--cobalt)] px-5 py-10 text-white sm:px-8 sm:py-14 md:grid-cols-[1fr_2fr] md:gap-8"><p className="section-index !text-blue-100">03 — EVIDENCE</p><div><h2 className="display-type text-3xl font-semibold sm:text-4xl">{copy.note}</h2><p className="mt-4 max-w-2xl leading-7 text-blue-100">{copy.noteBody}</p></div></section>

      <section id="access" className="editorial-grid mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20"><div className="col-span-12 md:col-span-5"><p className="section-index">04 — ACCESS</p><h2 className="display-type mt-5 text-4xl font-semibold leading-tight sm:text-5xl">{copy.access}</h2><p className="mt-5 max-w-sm text-sm leading-6 text-[var(--muted)]">{copy.footer}</p></div><div className="col-span-12 flex justify-start md:col-span-5 md:col-start-8"><AuthPanel /></div></section>

      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 border-t border-[var(--line)] px-5 py-6 text-xs text-[var(--muted)] sm:px-8"><span>EDU / FAMILY PLAN</span><span>{copy.footer}</span><span>AP • EN / TE</span></footer>
    </main>
  );
}
