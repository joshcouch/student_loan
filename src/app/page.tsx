"use client";

import { useState, useMemo, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  calculateLoanRepayments,
  SalaryProjection,
  LumpSumRepayment,
} from "./loanLogic";

const DEFAULT_INITIAL_LOAN_BALANCE = 64621.38;
const DEFAULT_STARTING_SALARY = 50000;
const DEFAULT_SALARY_GROWTH_FACTOR = 1.2;
const DEFAULT_REMAINING_YEARS = 30;
const DEFAULT_INTEREST_RATE = 0.07;

const getSalaryForYear = (year: number, startingSalary: number, growthFactor: number) => {
  if (year === 0) return 0;
  const log2Value = (Math.log(year) / Math.log(2));
  return Math.round(startingSalary * Math.pow(growthFactor, log2Value));
};

export default function Home() {
  const [initialBalance, setInitialBalance] = useState(DEFAULT_INITIAL_LOAN_BALANCE);
  const [startingSalary, setStartingSalary] = useState(DEFAULT_STARTING_SALARY);
  const [salaryGrowthFactor, setSalaryGrowthFactor] = useState(DEFAULT_SALARY_GROWTH_FACTOR);
  const [remainingYears, setRemainingYears] = useState(DEFAULT_REMAINING_YEARS);
  const [interestRate, setInterestRate] = useState(DEFAULT_INTEREST_RATE);

  const [salaryProjections, setSalaryProjections] = useState<SalaryProjection[]>([]);

  useEffect(() => {
    const projections: SalaryProjection[] = [
      { year: 1, salary: getSalaryForYear(1, startingSalary, salaryGrowthFactor) },
      { year: 2, salary: getSalaryForYear(2, startingSalary, salaryGrowthFactor) },
      { year: 4, salary: getSalaryForYear(4, startingSalary, salaryGrowthFactor) },
      { year: 8, salary: getSalaryForYear(8, startingSalary, salaryGrowthFactor) },
      { year: 16, salary: getSalaryForYear(16, startingSalary, salaryGrowthFactor) },
    ];
    setSalaryProjections(projections);
  }, [startingSalary, salaryGrowthFactor]);

  const [lumpSumRepayments, setLumpSumRepayments] = useState<LumpSumRepayment[]>(
    []
  );
  const [lumpSumYear, setLumpSumYear] = useState(1);
  const [lumpSumAmount, setLumpSumAmount] = useState(0);

  const { history, totalRepayments } = useMemo(
    () =>
      calculateLoanRepayments(
        initialBalance,
        remainingYears,
        interestRate,
        salaryProjections,
        lumpSumRepayments
      ),
    [initialBalance, remainingYears, interestRate, salaryProjections, lumpSumRepayments]
  );

  const handleSalaryChange = (index: number, year: number, salary: number) => {
    const newProjections = [...salaryProjections];
    newProjections[index] = { year, salary };
    setSalaryProjections(newProjections);
  };

  const handleAddLumpSum = () => {
    if (lumpSumAmount > 0) {
      setLumpSumRepayments([
        ...lumpSumRepayments,
        { year: lumpSumYear, amount: lumpSumAmount },
      ]);
      setLumpSumAmount(0);
    }
  };

  const handleRemoveLumpSum = (index: number) => {
    setLumpSumRepayments(lumpSumRepayments.filter((_, i) => i !== index));
  };

  const chartData = history.map((h) => ({
    time: h.year + h.month / 12,
    balance: h.balance,
  }));
  
  const summaryData = useMemo(() => {
    const summary: {year: number, maxMonthlyRepayment: number, endBalance: number, totalPayments: number}[] = [];
    for (let year = 1; year <= remainingYears; year++) {
      const yearHistory = history.filter(h => h.year === year);
      if (yearHistory.length === 0) continue;

      const maxMonthlyRepayment = Math.max(...yearHistory.map(h => h.monthlyRepayment));
      const endBalance = yearHistory[yearHistory.length - 1].balance;
      const totalPayments = yearHistory[yearHistory.length - 1].totalRepayments;
      
      summary.push({
        year,
        maxMonthlyRepayment,
        endBalance,
        totalPayments,
      });
    }
    return summary;
  }, [history, remainingYears]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <h1 className="text-4xl font-bold mb-8">
        UK Student Loan Repayment Model
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-7xl">
        <div className="lg:col-span-1 p-6 bg-white rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Inputs</h2>
          
          <div className="mb-6 space-y-4">
            <h3 className="text-xl font-medium mb-2">Global Parameters</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Initial Balance: £{initialBalance.toLocaleString()}</label>
              <input
                type="range"
                min="0"
                max="150000"
                step="1000"
                value={initialBalance}
                onChange={(e) => setInitialBalance(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Starting Salary: £{startingSalary.toLocaleString()}</label>
              <input
                type="range"
                min="20000"
                max="150000"
                step="1000"
                value={startingSalary}
                onChange={(e) => setStartingSalary(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Salary Growth Factor: {salaryGrowthFactor}x</label>
              <input
                type="range"
                min="1.0"
                max="2.0"
                step="0.01"
                value={salaryGrowthFactor}
                onChange={(e) => setSalaryGrowthFactor(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Interest Rate: {(interestRate * 100).toFixed(1)}%</label>
              <input
                type="range"
                min="0"
                max="0.15"
                step="0.001"
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Remaining Years: {remainingYears}</label>
              <input
                type="range"
                min="1"
                max="40"
                step="1"
                value={remainingYears}
                onChange={(e) => setRemainingYears(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <h3 className="text-xl font-medium mb-2">Manual Salary Projections</h3>
          {salaryProjections.map((p, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input
                type="number"
                value={p.year || ""}
                onChange={(e) =>
                  handleSalaryChange(i, parseInt(e.target.value) || 0, p.salary)
                }
                className="w-20 p-2 border rounded"
                placeholder="Year"
              />
              <input
                type="number"
                value={p.salary || ""}
                onChange={(e) =>
                  handleSalaryChange(i, p.year, parseInt(e.target.value) || 0)
                }
                className="w-32 p-2 border rounded"
                placeholder="Salary"
              />
            </div>
          ))}

          <h3 className="text-xl font-medium mt-6 mb-2">Lump Sum Repayment</h3>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={lumpSumYear || ""}
              onChange={(e) => setLumpSumYear(parseInt(e.target.value) || 0)}
              className="w-20 p-2 border rounded"
              placeholder="Year"
            />
            <input
              type="number"
              value={lumpSumAmount || ""}
              onChange={(e) => setLumpSumAmount(parseInt(e.target.value) || 0)}
              className="w-32 p-2 border rounded"
              placeholder="Amount"
            />
            <button
              onClick={handleAddLumpSum}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add
            </button>
          </div>
          <ul className="mt-4 space-y-2">
            {lumpSumRepayments.map((l, i) => (
              <li key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                <span>
                  Year {l.year}: £{l.amount.toLocaleString()}
                </span>
                <button
                  onClick={() => handleRemoveLumpSum(i)}
                  className="text-red-500 hover:text-red-700 text-sm font-bold"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2 p-6 bg-white rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Loan Balance Over Time</h2>
          <p className="text-xl mb-4">
            Total Repayments:{" "}
            <span className="font-bold">
              £{totalRepayments.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </p>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="time" name="Year" unit="yr" domain={[0, remainingYears]} />
              <YAxis
                tickFormatter={(tick) => `£${(tick / 1000).toFixed(0)}k`}
              />
              <Tooltip formatter={(value: any) => `£${Number(value || 0).toLocaleString()}`} />
              <Legend />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#8884d8"
                fill="#8884d8"
                name="Loan Balance"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
      </div>
      <div className="w-full max-w-7xl mt-8">
          <h2 className="text-2xl font-semibold mb-4">Yearly Summary</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg shadow">
              <thead>
                <tr className="w-full bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                  <th className="py-3 px-6 text-left">Year</th>
                  <th className="py-3 px-6 text-left">Max Monthly Repayment</th>
                  <th className="py-3 px-6 text-left">Year-End Balance</th>
                  <th className="py-3 px-6 text-left">Total Payments</th>
                </tr>
              </thead>
              <tbody className="text-gray-600 text-sm font-light">
                {summaryData.map(row => (
                  <tr key={row.year} className="border-b border-gray-200 hover:bg-gray-100">
                    <td className="py-3 px-6 text-left whitespace-nowrap">{row.year}</td>
                    <td className="py-3 px-6 text-left">£{row.maxMonthlyRepayment.toFixed(2)}</td>
                    <td className="py-3 px-6 text-left">£{row.endBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td className="py-3 px-6 text-left">£{row.totalPayments.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
    </main>
  );
}
