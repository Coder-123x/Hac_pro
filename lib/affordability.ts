export type Paise = bigint;

export type ExpenseEstimate = {
  category: string;
  annualPaise: Paise;
  planYear: number;
  annualIncreaseBps: number;
};

export type AffordabilityInput = {
  durationYears: number;
  expenses: ExpenseEstimate[];
  monthlyContributionPaise: Paise;
  annualContributionPaise: Paise;
  confirmedFundsPaise: Paise;
  confirmedScholarshipFundsPaise?: Paise;
};

export type AffordabilityResult = {
  annualCostsPaise: Paise[];
  totalCostPaise: Paise;
  annualContributionsPaise: Paise[];
  projectedContributionsPaise: Paise;
  confirmedFundsPaise: Paise;
  confirmedScholarshipFundsPaise: Paise;
  totalFundingPaise: Paise;
  fundingGapPaise: Paise;
  coverageBps: bigint;
  annualGapsPaise: Paise[];
};

const BPS = 10_000n;

function assertNonNegative(value: bigint, label: string) {
  if (value < 0n) throw new Error(`${label} cannot be negative.`);
}

function roundDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

function projectedExpense(expense: ExpenseEstimate, yearIndex: number): Paise {
  if (!Number.isInteger(expense.planYear) || expense.planYear < 1 || expense.planYear > 8) {
    throw new Error("Expense plan year must be between 1 and 8.");
  }
  if (yearIndex + 1 < expense.planYear) return 0n;
  const increase = BigInt(expense.annualIncreaseBps);
  if (expense.annualIncreaseBps < 0 || expense.annualIncreaseBps > 10_000) {
    throw new Error("Annual increase must be between 0% and 100%.");
  }
  let factor = 1n;
  let denominator = 1n;
  const inflationYears = yearIndex - (expense.planYear - 1);
  for (let index = 0; index < inflationYears; index += 1) {
    factor *= BPS + increase;
    denominator *= BPS;
  }
  return roundDivide(expense.annualPaise * factor, denominator);
}

export function parseRupeesToPaise(value: string): Paise {
  const normalized = value.trim().replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error("Enter a non-negative amount with up to two decimal places.");
  const [rupees, cents = ""] = normalized.split(".");
  return BigInt(rupees) * 100n + BigInt(cents.padEnd(2, "0"));
}

export function formatPaise(value: Paise): string {
  assertNonNegative(value, "Amount");
  const rupees = value / 100n;
  const cents = (value % 100n).toString().padStart(2, "0");
  return `₹${rupees.toLocaleString("en-IN")}.${cents}`;
}

export function paiseToInput(value: Paise): string {
  assertNonNegative(value, "Amount");
  const rupees = value / 100n;
  const cents = (value % 100n).toString().padStart(2, "0");
  return `${rupees}.${cents}`;
}

export function projectAnnualCosts(expenses: ExpenseEstimate[], durationYears: number): Paise[] {
  if (!Number.isInteger(durationYears) || durationYears < 1 || durationYears > 8) throw new Error("Plan duration must be between 1 and 8 years.");
  return Array.from({ length: durationYears }, (_, yearIndex) => expenses.reduce((total, expense) => {
    assertNonNegative(expense.annualPaise, `${expense.category} estimate`);
    return total + projectedExpense(expense, yearIndex);
  }, 0n));
}

export function projectFamilyContributions(monthlyPaise: Paise, annualPaise: Paise, durationYears: number): Paise[] {
  assertNonNegative(monthlyPaise, "Monthly contribution");
  assertNonNegative(annualPaise, "Annual contribution");
  if (monthlyPaise > 0n && annualPaise > 0n && annualPaise !== monthlyPaise * 12n) {
    throw new Error("Monthly and annual contributions must agree, or leave one blank.");
  }
  const annual = monthlyPaise > 0n ? monthlyPaise * 12n : annualPaise;
  return Array.from({ length: durationYears }, () => annual);
}

export function calculateAffordability(input: AffordabilityInput): AffordabilityResult {
  assertNonNegative(input.confirmedFundsPaise, "Confirmed funds");
  const confirmedScholarshipFundsPaise = input.confirmedScholarshipFundsPaise ?? 0n;
  assertNonNegative(confirmedScholarshipFundsPaise, "Confirmed scholarship funds");
  const annualCostsPaise = projectAnnualCosts(input.expenses, input.durationYears);
  const annualContributionsPaise = projectFamilyContributions(input.monthlyContributionPaise, input.annualContributionPaise, input.durationYears);
  const totalCostPaise = annualCostsPaise.reduce((total, value) => total + value, 0n);
  const projectedContributionsPaise = annualContributionsPaise.reduce((total, value) => total + value, 0n);
  const totalFundingPaise = input.confirmedFundsPaise + confirmedScholarshipFundsPaise + projectedContributionsPaise;
  const fundingGapPaise = totalCostPaise > totalFundingPaise ? totalCostPaise - totalFundingPaise : 0n;
  const coverageBps = totalCostPaise === 0n ? 10_000n : (totalFundingPaise * 10_000n > totalCostPaise * 10_000n ? 10_000n : roundDivide(totalFundingPaise * 10_000n, totalCostPaise));

  // Confirmed funds are available now and are consumed against the earliest
  // years first. Future contributions remain separate and are never double-counted.
  let remainingConfirmed = input.confirmedFundsPaise + confirmedScholarshipFundsPaise;
  const annualGapsPaise = annualCostsPaise.map((cost, index) => {
    const available = remainingConfirmed + annualContributionsPaise[index];
    const gap = cost > available ? cost - available : 0n;
    remainingConfirmed = available > cost ? available - cost : 0n;
    return gap;
  });

  return {
    annualCostsPaise,
    totalCostPaise,
    annualContributionsPaise,
    projectedContributionsPaise,
    confirmedFundsPaise: input.confirmedFundsPaise,
    confirmedScholarshipFundsPaise,
    totalFundingPaise,
    fundingGapPaise,
    coverageBps,
    annualGapsPaise,
  };
}

export function calculateWhatIf(input: AffordabilityInput, changes: Partial<Pick<AffordabilityInput, "expenses" | "monthlyContributionPaise" | "annualContributionPaise" | "confirmedFundsPaise" | "confirmedScholarshipFundsPaise">>): AffordabilityResult {
  return calculateAffordability({ ...input, ...changes });
}
