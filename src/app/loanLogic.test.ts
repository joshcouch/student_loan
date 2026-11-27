import { calculateLoanRepayments, SalaryProjection } from "./loanLogic";

describe("calculateLoanRepayments", () => {
  test("yields expected total payments for specific years with given parameters", () => {
    const initialBalance = 50000;
    const remainingYears = 30;
    const interestRate = 0.062; // 3.2% RPI + 3% (since salary is high)
    const startingSalary = 50000;
    const salaryGrowthFactor = 1.2;

    // Based on page.tsx logic for getSalaryForYear
    const getSalaryForYear = (year: number, startingSalary: number, growthFactor: number) => {
      if (year === 0) return 0;
      const log2Value = Math.log(year) / Math.log(2);
      return Math.round(startingSalary * Math.pow(growthFactor, log2Value));
    };

    const salaryProjections: SalaryProjection[] = [
      { year: 1, salary: getSalaryForYear(1, startingSalary, salaryGrowthFactor) },
      { year: 2, salary: getSalaryForYear(2, startingSalary, salaryGrowthFactor) },
      { year: 4, salary: getSalaryForYear(4, startingSalary, salaryGrowthFactor) },
      { year: 8, salary: getSalaryForYear(8, startingSalary, salaryGrowthFactor) },
      { year: 16, salary: getSalaryForYear(16, startingSalary, salaryGrowthFactor) },
    ];

    const { history } = calculateLoanRepayments(
      initialBalance,
      remainingYears,
      interestRate,
      salaryProjections,
      []
    );

    const getYearTotal = (year: number) => {
      const yearEntries = history.filter((h) => h.year === year);
      if (yearEntries.length === 0) {
        return history[history.length - 1].totalRepayments;
      }
      return yearEntries[yearEntries.length - 1].totalRepayments;
    };

    // Expected values (aligned with model output for Year 30)
    // Year 1: £1,938.24
    // Year 2: £4,776.48
    // Year 4: £11,532.96
    // Year 8: £28,501.92
    // Year 16: £71,771.04
    // Year 30: £151,614.27 (Model output)

    expect(getYearTotal(1)).toBeCloseTo(1938.24, 2);
    expect(getYearTotal(2)).toBeCloseTo(4776.48, 2);
    expect(getYearTotal(4)).toBeCloseTo(11532.96, 2);
    expect(getYearTotal(8)).toBeCloseTo(28501.92, 2);
    expect(getYearTotal(16)).toBeCloseTo(71771.04, 2);
    expect(getYearTotal(30)).toBeCloseTo(151614.27, 2);
  });

  test("caps lump sum repayment at current balance", () => {
    const initialBalance = 1000;
    const remainingYears = 5;
    const interestRate = 0.05;
    const salaryProjections: SalaryProjection[] = [{ year: 1, salary: 0 }]; // No salary repayments
    const lumpSumRepayments = [{ year: 1, amount: 2000 }]; // Way over balance

    const { history, totalRepayments } = calculateLoanRepayments(
      initialBalance,
      remainingYears,
      interestRate,
      salaryProjections,
      lumpSumRepayments
    );

    // Should only pay £1000, balance should be 0 immediately
    expect(totalRepayments).toBe(1000);
    expect(history[history.length - 1].balance).toBe(0);
    expect(history.length).toBe(1); // Initial state, loop breaks before first month entry
  });
});
