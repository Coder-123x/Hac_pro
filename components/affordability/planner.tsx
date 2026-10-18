"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/messages";
import { Button } from "@/components/ui/button";
import {
  calculateAffordability,
  formatPaise,
  hasCostEstimates,
  paiseToInput,
  parseRupeesToPaise,
  type AffordabilityResult,
  type ExpenseEstimate,
} from "@/lib/affordability";
import { confirmedScholarshipFunding, type ScholarshipApplication } from "@/lib/scholarships";
import { useLanguage } from "@/components/i18n/language-provider";

type PlannerProps = { familyId: string; role: "parent" | "student" };
type BudgetRecord = {
  id: string;
  name: string;
  monthly_family_contribution_paise: string | number;
  annual_family_contribution_paise: string | number;
  confirmed_available_funds_paise: string | number;
  plan_duration_years: number;
};
type ExpenseRecord = {
  id: string;
  category: string;
  amount_paise: string | number;
  plan_year: number;
  annual_increase_bps: number;
  status: "estimated" | "committed" | "actual";
  description: string;
};

const emptyExpense = { category: "", amount: "", planYear: "1", increasePercent: "0", description: "" };

function toPaise(value: string | number): bigint {
  return BigInt(String(value));
}

function displayPercent(bps: number): string {
  return (bps / 100).toFixed(2).replace(/\.00$/, "");
}

function resultFrom(budget: BudgetRecord | null, expenses: ExpenseRecord[], scholarshipAidPaise = 0n): AffordabilityResult | null {
  if (!budget) return null;
  try {
    const estimates: ExpenseEstimate[] = expenses.map((expense) => ({
      category: expense.category,
      annualPaise: toPaise(expense.amount_paise),
      planYear: expense.plan_year,
      annualIncreaseBps: expense.annual_increase_bps,
    }));
    return calculateAffordability({
      durationYears: budget.plan_duration_years,
      expenses: estimates,
      monthlyContributionPaise: toPaise(budget.monthly_family_contribution_paise),
      annualContributionPaise: toPaise(budget.annual_family_contribution_paise),
      confirmedFundsPaise: toPaise(budget.confirmed_available_funds_paise),
      confirmedScholarshipFundsPaise: scholarshipAidPaise,
    });
  } catch {
    return null;
  }
}

function ExpenseEditor({
  familyId,
  expense,
  onSaved,
  onCancelled,
}: {
  familyId: string;
  expense?: ExpenseRecord;
  onSaved: () => void;
  onCancelled?: () => void;
}) {
  const [form, setForm] = useState(expense ? {
    category: expense.category,
    amount: paiseToInput(toPaise(expense.amount_paise)),
    planYear: String(expense.plan_year),
    increasePercent: displayPercent(expense.annual_increase_bps),
    description: expense.description,
  } : emptyExpense);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form.category.trim()) return setMessage("Enter an expense category.");
    const year = Number(form.planYear);
    const increase = Number(form.increasePercent);
    if (!Number.isInteger(year) || year < 1 || year > 8) return setMessage("Plan year must be between 1 and 8.");
    if (!Number.isFinite(increase) || increase < 0 || increase > 100) return setMessage("Annual increase must be between 0% and 100%.");
    let amountPaise: bigint;
    try { amountPaise = parseRupeesToPaise(form.amount); } catch (error) { return setMessage(error instanceof Error ? error.message : "Enter a valid amount."); }
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Your session expired. Please sign in again."); setBusy(false); return; }
    const payload = {
      family_id: familyId,
      category: form.category.trim(),
      amount_paise: amountPaise.toString(),
      plan_year: year,
      annual_increase_bps: Math.round(increase * 100),
      expense_period: `${new Date().getFullYear()}-01-01`,
      status: "estimated" as const,
      description: form.description.trim(),
    };
    const query = expense
      ? supabase.from("expenses").update(payload).eq("id", expense.id).eq("family_id", familyId)
      : supabase.from("expenses").insert({ ...payload, created_by: user.id });
    const { error } = await query;
    if (error) setMessage(error.code === "23505" ? "That category already has an estimate for this year." : friendlyError(error));
    else { setForm(emptyExpense); onSaved(); }
    setBusy(false);
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-800">Category<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="Tuition, hostel, travel…" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
        <label className="text-sm font-medium text-slate-800">Annual estimate (₹)<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
        <label className="text-sm font-medium text-slate-800">Plan year<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" type="number" min="1" max="8" value={form.planYear} onChange={(event) => setForm({ ...form, planYear: event.target.value })} /></label>
        <label className="text-sm font-medium text-slate-800">Annual increase (%)<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" inputMode="decimal" value={form.increasePercent} onChange={(event) => setForm({ ...form, increasePercent: event.target.value })} /></label>
      </div>
      <label className="mt-3 block text-sm font-medium text-slate-800">Notes (optional)<textarea className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      {message && <p className="mt-3 text-sm text-rose-700" role="alert">{message}</p>}
      <div className="mt-3 flex gap-2"><Button type="button" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : expense ? "Save estimate" : "Add estimate"}</Button>{onCancelled && <button className="px-3 py-2 text-sm underline" type="button" onClick={onCancelled}>Cancel</button>}</div>
    </div>
  );
}

export function AffordabilityPlanner({ familyId, role }: PlannerProps) {
  const { t } = useLanguage();
  const [budget, setBudget] = useState<BudgetRecord | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [confirmedScholarshipFundsPaise, setConfirmedScholarshipFundsPaise] = useState(0n);
  const [loading, setLoading] = useState(true);
  const [savingBudget, setSavingBudget] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [budgetForm, setBudgetForm] = useState({ name: "Engineering education plan", monthly: "", annual: "", confirmed: "", duration: "4" });

  async function load() {
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const [{ data: budgetData, error: budgetError }, { data: expenseData, error: expenseError }, { data: applicationData, error: scholarshipError }] = await Promise.all([
      supabase.from("family_budgets").select("id, name, monthly_family_contribution_paise, annual_family_contribution_paise, confirmed_available_funds_paise, plan_duration_years").eq("family_id", familyId).maybeSingle(),
      supabase.from("expenses").select("id, category, amount_paise, plan_year, annual_increase_bps, status, description").eq("family_id", familyId).order("plan_year").order("category"),
      supabase.from("scholarship_applications").select("id, scholarship_id, status, awarded_amount_paise, received_amount_paise, confirmed_funding, scholarship_records!inner(verification_status)").eq("family_id", familyId),
    ]);
    if (budgetError || expenseError) setMessage("We could not load this affordability plan. Check that the Phase 4 migration is applied.");
    if (scholarshipError) setMessage((current) => current ?? "Scholarship funding is unavailable until the scholarship migration is applied; it is excluded from this calculation.");
    const scholarshipApplications: ScholarshipApplication[] = (applicationData ?? []).map((item: any) => ({ id: item.id, scholarshipId: item.scholarship_id, status: item.status, awardedAmountPaise: item.awarded_amount_paise === null ? null : BigInt(String(item.awarded_amount_paise)), receivedAmountPaise: item.received_amount_paise === null ? null : BigInt(String(item.received_amount_paise)), confirmedFunding: item.confirmed_funding, verificationStatus: item.scholarship_records?.verification_status }));
    setConfirmedScholarshipFundsPaise(scholarshipError ? 0n : confirmedScholarshipFunding(scholarshipApplications));
    if (budgetData) {
      const record = budgetData as unknown as BudgetRecord;
      setBudget(record);
      setBudgetForm({ name: record.name, monthly: paiseToInput(toPaise(record.monthly_family_contribution_paise)), annual: paiseToInput(toPaise(record.annual_family_contribution_paise)), confirmed: paiseToInput(toPaise(record.confirmed_available_funds_paise)), duration: String(record.plan_duration_years) });
    }
    setExpenses((expenseData ?? []) as unknown as ExpenseRecord[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [familyId]);

  const result = useMemo(() => resultFrom(budget, expenses, confirmedScholarshipFundsPaise), [budget, expenses, confirmedScholarshipFundsPaise]);

  async function saveBudget() {
    const duration = Number(budgetForm.duration);
    if (!budgetForm.name.trim()) return setMessage("Enter a plan name.");
    if (!Number.isInteger(duration) || duration < 1 || duration > 8) return setMessage("Plan duration must be between 1 and 8 years.");
    let monthly: bigint;
    let annual: bigint;
    let confirmed: bigint;
    try { monthly = budgetForm.monthly ? parseRupeesToPaise(budgetForm.monthly) : 0n; annual = budgetForm.annual ? parseRupeesToPaise(budgetForm.annual) : 0n; confirmed = budgetForm.confirmed ? parseRupeesToPaise(budgetForm.confirmed) : 0n; } catch (error) { return setMessage(error instanceof Error ? error.message : "Enter valid financial amounts."); }
    if (monthly > 0n && annual > 0n && annual !== monthly * 12n) return setMessage("Monthly and annual contributions must agree, or leave one blank.");
    setSavingBudget(true);
    setMessage(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Your session expired. Please sign in again."); setSavingBudget(false); return; }
    const currentYear = new Date().getFullYear();
    const payload = { family_id: familyId, name: budgetForm.name.trim(), period_start: `${currentYear}-01-01`, period_end: `${currentYear + duration - 1}-12-31`, monthly_family_contribution_paise: monthly.toString(), annual_family_contribution_paise: annual.toString(), confirmed_available_funds_paise: confirmed.toString(), plan_duration_years: duration };
    const query = budget
      ? supabase.from("family_budgets").update(payload).eq("id", budget.id).eq("family_id", familyId)
      : supabase.from("family_budgets").insert({ ...payload, created_by: user.id });
    const { error } = await query;
    if (error) setMessage(error.code === "23505" ? "This family already has an education plan." : friendlyError(error));
    else await load();
    setSavingBudget(false);
  }

  async function deleteExpense(expense: ExpenseRecord) {
    if (!window.confirm(`Delete the ${expense.category} estimate?`)) return;
    const { error } = await createClient().from("expenses").delete().eq("id", expense.id).eq("family_id", familyId);
    if (error) setMessage(friendlyError(error)); else await load();
  }

  if (loading) return <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600" aria-busy="true">{t("loading")}</section>;

  return (
    <section id="affordability" className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm font-medium text-slate-600">Phase 4</p><h3 className="text-xl font-semibold text-slate-950">{t("affordabilityTitle")}</h3></div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-900">{t("estimatesNotice")}</span>
      </div>
      {message && <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-800" role="alert">{message}</p>}
      {!budget && role === "student" && <p className="mt-5 rounded-md bg-slate-50 p-4 text-sm text-slate-700">A parent must set up the family education budget before estimates can be added.</p>}
      {role === "parent" && (
        <div className="mt-5 border-b border-slate-200 pb-5">
          <h4 className="font-medium text-slate-900">Family funding setup</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-800 sm:col-span-2">Plan name<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" value={budgetForm.name} onChange={(event) => setBudgetForm({ ...budgetForm, name: event.target.value })} /></label>
            <label className="text-sm font-medium text-slate-800">Monthly future contribution (₹)<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" inputMode="decimal" placeholder="Optional" value={budgetForm.monthly} onChange={(event) => setBudgetForm({ ...budgetForm, monthly: event.target.value })} /></label>
            <label className="text-sm font-medium text-slate-800">Annual future contribution (₹)<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" inputMode="decimal" placeholder="Optional" value={budgetForm.annual} onChange={(event) => setBudgetForm({ ...budgetForm, annual: event.target.value })} /></label>
            <label className="text-sm font-medium text-slate-800">Confirmed funds available now (₹)<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" inputMode="decimal" placeholder="Optional" value={budgetForm.confirmed} onChange={(event) => setBudgetForm({ ...budgetForm, confirmed: event.target.value })} /></label>
            <label className="text-sm font-medium text-slate-800">Plan duration (years)<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" type="number" min="1" max="8" value={budgetForm.duration} onChange={(event) => setBudgetForm({ ...budgetForm, duration: event.target.value })} /></label>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Available funds are money held now. Future contributions are counted separately. Do not enter the same savings in both fields.</p>
          <Button className="mt-3" type="button" disabled={savingBudget} onClick={() => void saveBudget()}>{savingBudget ? "Saving…" : budget ? "Update funding setup" : "Save funding setup"}</Button>
        </div>
      )}
      {budget && (
        <>
          {result && hasCostEstimates(expenses.map((expense) => ({ category: expense.category, annualPaise: toPaise(expense.amount_paise), planYear: expense.plan_year, annualIncreaseBps: expense.annual_increase_bps }))) ? <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Full-plan cost" value={formatPaise(result.totalCostPaise)} />
            <Metric label="Confirmed now" value={formatPaise(result.confirmedFundsPaise)} />
            <Metric label="Confirmed scholarship aid" value={formatPaise(result.confirmedScholarshipFundsPaise)} />
            <Metric label="Future contributions" value={formatPaise(result.projectedContributionsPaise)} />
            <Metric label="Funding gap" value={formatPaise(result.fundingGapPaise)} emphasis={result.fundingGapPaise > 0n} />
          </div>
          <p className="mt-3 text-sm text-slate-700">Funding coverage: <strong>{(Number(result.coverageBps) / 100).toFixed(1)}%</strong>. Calculations use integer paise and round inflated annual estimates to the nearest paise.</p>
          <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><caption className="mb-2 text-left font-medium text-slate-900">Annual affordability breakdown</caption><thead className="border-b border-slate-200 text-slate-600"><tr><th className="py-2 pr-4">Year</th><th className="py-2 pr-4">Estimated cost</th><th className="py-2 pr-4">Contribution</th><th className="py-2">Gap</th></tr></thead><tbody>{result.annualCostsPaise.map((cost, index) => <tr key={index} className="border-b border-slate-100"><td className="py-2 pr-4">Year {index + 1}</td><td className="py-2 pr-4">{formatPaise(cost)}</td><td className="py-2 pr-4">{formatPaise(result.annualContributionsPaise[index])}{index === 0 && result.confirmedFundsPaise > 0n ? " + funds now" : ""}</td><td className={`py-2 ${result.annualGapsPaise[index] > 0n ? "font-semibold text-rose-700" : "text-emerald-700"}`}>{formatPaise(result.annualGapsPaise[index])}</td></tr>)}</tbody></table></div>
          </> : <p className="mt-5 rounded-md bg-slate-50 p-4 text-sm text-slate-700">Cost not entered yet. Add at least one annual expense estimate before viewing affordability coverage and funding gaps.</p>}
          <div className="mt-6 border-t border-slate-200 pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-medium text-slate-900">Annual expense estimates</h4><p className="text-xs text-slate-500">These are user-entered planning estimates, not verified college fees.</p></div>{role === "parent" && <Button type="button" onClick={() => setShowExpenseForm(!showExpenseForm)}>{showExpenseForm ? "Close" : "Add estimate"}</Button>}</div>{showExpenseForm && role === "parent" && <ExpenseEditor familyId={familyId} onSaved={() => { setShowExpenseForm(false); void load(); }} />}{expenses.length === 0 ? <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">No annual expense estimates yet. Add tuition, hostel, food, travel, equipment, examination fees, learning resources, or other costs.</p> : <ul className="mt-4 space-y-3">{expenses.map((expense) => <li key={expense.id} className="rounded-md border border-slate-200 p-3">{editingExpenseId === expense.id && role === "parent" ? <ExpenseEditor familyId={familyId} expense={expense} onSaved={() => { setEditingExpenseId(null); void load(); }} onCancelled={() => setEditingExpenseId(null)} /> : <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-slate-900">{expense.category} <span className="text-xs font-normal text-slate-500">· Year {expense.plan_year} · {displayPercent(expense.annual_increase_bps)}% annual increase</span></p><p className="text-sm text-slate-700">{formatPaise(toPaise(expense.amount_paise))} per year · {expense.status}</p>{expense.description && <p className="mt-1 text-xs text-slate-500">{expense.description}</p>}</div>{role === "parent" && <div className="flex gap-2"><button className="text-sm underline" type="button" onClick={() => setEditingExpenseId(expense.id)}>Edit</button><button className="text-sm text-rose-700 underline" type="button" onClick={() => void deleteExpense(expense)}>Delete</button></div>}</div>}</li>)}</ul>}</div>
        </>
      )}
      {!budget && role === "parent" && <p className="mt-5 text-sm text-slate-600">Set up confirmed funds and expected contributions to begin the four-year estimate.</p>}
    </section>
  );
}

function Metric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-600">{label}</p><p className={`mt-1 text-lg font-semibold ${emphasis ? "text-rose-700" : "text-slate-950"}`}>{value}</p></div>;
}
