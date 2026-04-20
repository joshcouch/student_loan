export interface SalaryProjection {
  year: number;
  salary: number;
}

export interface LumpSumRepayment {
  year: number;
  amount: number;
}

export interface LoanState {
  year: number;
  month: number;
  balance: number;
  interestPaid: number;
  principalPaid: number;
  totalRepayments: number;
  monthlyRepayment: number;
}

const MONTHLY_REPAYMENT_THRESHOLD = 2372.00;
const REPAYMENT_PERCENTAGE = 0.09;
const BASE_APR = 0.032;
const SALARY_APR_BONUS_MAX = 0.03;

/**
 * NOTE: This function is currently obsolete as we are using a fixed interest rate input.
 * It is kept here for future reference when we re-introduce salary-dependent interest logic.
 */
const getInterestRate = (salary: number): number => {
  if (salary <= 28470) {
    return 0.032;
  } else if (salary > 28470 && salary <= 51245) {
    const excess = salary - 28470;
    const range = 51245 - 28470;
    const additionalInterest = (excess / range) * 0.03;
    return 0.032 + additionalInterest;
  } else {
    return 0.062;
  }
};

export function calculateLoanRepayments(
  initialBalance: number,
  remainingYears: number,
  interestRate: number,
  salaryProjections: SalaryProjection[],
  lumpSumRepayments: LumpSumRepayment[]
): { history: LoanState[]; totalRepayments: number } {
  let balance = initialBalance;
  let totalRepayments = 0;
  const history: LoanState[] = [{
    year: 0,
    month: 0,
    balance,
    interestPaid: 0,
    principalPaid: 0,
    totalRepayments: 0,
    monthlyRepayment: 0
  }];

  // Create a salary map for easy lookup
  const salaryMap = new Map<number, number>();
  salaryProjections.forEach(p => salaryMap.set(p.year, p.salary));

  let currentAnnualSalary = salaryMap.get(1) || 0;

  for (let year = 1; year <= remainingYears; year++) {
    if (salaryMap.has(year)) {
      currentAnnualSalary = salaryMap.get(year)!;
    }

    const annualInterestRate = interestRate;
    const monthlyInterestRate = (1 + annualInterestRate)**(1/12) - 1;


    const monthlySalary = currentAnnualSalary / 12;
    const monthlyRepayment =
      monthlySalary > MONTHLY_REPAYMENT_THRESHOLD
        ? (monthlySalary - MONTHLY_REPAYMENT_THRESHOLD) * REPAYMENT_PERCENTAGE
        : 0;

    // Apply lump sum repayments at the beginning of the year
    const lumpSumsForYear = lumpSumRepayments.filter(l => l.year === year);
    if (lumpSumsForYear.length > 0) {
      const totalLumpSum = lumpSumsForYear.reduce((sum, l) => sum + l.amount, 0);
      const principalPaid = Math.min(balance, totalLumpSum);
      balance -= principalPaid;
      totalRepayments += principalPaid;
    }

    for (let month = 1; month <= 12; month++) {
        if (balance <= 0) break;

        const interest = balance * monthlyInterestRate;
        balance += interest;

        const principalPaid = Math.min(balance, monthlyRepayment);
        balance -= principalPaid;
        totalRepayments += principalPaid;

        history.push({
            year,
            month,
            balance,
            interestPaid: interest,
            principalPaid,
            totalRepayments,
            monthlyRepayment,
        });
    }

    if (balance <= 0) break;
  }

  // If loan expires and there is still balance, it is written off.
  if (history[history.length - 1].balance > 0) {
      // The last entry is the final state.
  }

  return { history, totalRepayments };
}
