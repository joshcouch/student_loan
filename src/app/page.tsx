"use client";

import { useState, useMemo, useEffect } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  calculateLoanRepayments,
  SalaryProjection,
  LumpSumRepayment,
} from "./loanLogic";

const DEFAULT_INITIAL_LOAN_BALANCE = 50000;
const DEFAULT_STARTING_SALARY = 50000;
const DEFAULT_SALARY_GROWTH_FACTOR = 1.2;
const DEFAULT_REMAINING_YEARS = 30;
const DEFAULT_INTEREST_RATE = 0.062;

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
  const [isManualSalary, setIsManualSalary] = useState(false);
  const [activeTab, setActiveTab] = useState("main");

  const [salaryProjections, setSalaryProjections] = useState<SalaryProjection[]>([]);

  useEffect(() => {
    if (isManualSalary) return;
    const projections: SalaryProjection[] = [
      { year: 1, salary: getSalaryForYear(1, startingSalary, salaryGrowthFactor) },
      { year: 2, salary: getSalaryForYear(2, startingSalary, salaryGrowthFactor) },
      { year: 4, salary: getSalaryForYear(4, startingSalary, salaryGrowthFactor) },
      { year: 8, salary: getSalaryForYear(8, startingSalary, salaryGrowthFactor) },
      { year: 16, salary: getSalaryForYear(16, startingSalary, salaryGrowthFactor) },
    ];
    setSalaryProjections(projections);
  }, [startingSalary, salaryGrowthFactor, isManualSalary]);

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

  const baseline = useMemo(
    () =>
      calculateLoanRepayments(
        initialBalance,
        remainingYears,
        interestRate,
        salaryProjections,
        []
      ),
    [initialBalance, remainingYears, interestRate, salaryProjections]
  );

  const lumpSumImpact = useMemo(() => {
    if (lumpSumRepayments.length === 0) return null;

    const savings = baseline.totalRepayments - totalRepayments;
    const totalLumpSum = lumpSumRepayments.reduce((sum, l) => sum + l.amount, 0);
    
    // Calculate weighted average year of lump sum investment
    const weightedSum = lumpSumRepayments.reduce((sum, l) => sum + (l.amount * l.year), 0);
    const avgYear = weightedSum / totalLumpSum;

    // Find the year the baseline loan was paid off (or the end of the term)
    const baselineLastEntry = baseline.history[baseline.history.length - 1];
    const finalYear = baselineLastEntry.year;

    // Time horizon for ROI calculation
    const yearsHeld = Math.max(1, finalYear - avgYear);

    // CAGR = ((Total Value) / (Initial Investment)) ^ (1/Years) - 1
    // Total Value = Savings + LumpSum (because Savings is the "profit" on top of the lump sum)
    const cagr = Math.pow((savings + totalLumpSum) / totalLumpSum, 1 / yearsHeld) - 1;

    return {
      savings,
      totalLumpSum,
      cagr: cagr * 100, // as percentage
      yearsHeld
    };
  }, [baseline, totalRepayments, lumpSumRepayments]);

  const handleSalaryChange = (index: number, year: number, salary: number) => {
    const newProjections = [...salaryProjections];
    newProjections[index] = { year, salary };
    setSalaryProjections(newProjections);
  };

  const handleAddLumpSum = () => {
    if (lumpSumAmount > 0) {
      // Find the balance at the start of the year (end of previous year)
      const prevYearData = history.find(h => h.year === lumpSumYear - 1 && h.month === 12) 
        || (lumpSumYear === 1 ? history[0] : history[history.length - 1]);
      
      const currentBalanceAtYear = prevYearData?.balance || 0;
      
      // Calculate total lump sums already planned for this year
      const existingLumpSumsForYear = lumpSumRepayments
        .filter(l => l.year === lumpSumYear)
        .reduce((sum, l) => sum + l.amount, 0);

      const maxAllowed = Math.max(0, currentBalanceAtYear - existingLumpSumsForYear);
      const actualAmountToAdd = Math.min(lumpSumAmount, maxAllowed);

      if (actualAmountToAdd > 0) {
        setLumpSumRepayments([
          ...lumpSumRepayments,
          { year: lumpSumYear, amount: actualAmountToAdd },
        ]);
        setLumpSumAmount(0);
      } else if (maxAllowed <= 0) {
        alert("Lump sum payment exceeds current loan balance.");
      } else if (lumpSumAmount > maxAllowed) {
        alert(`Lump sum capped at £${maxAllowed.toLocaleString()} (remaining balance at Year ${lumpSumYear})`);
      }
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
    <main className="flex min-h-screen flex-col items-center py-12 px-4 bg-gray-100 font-sans text-gray-900">
      <div className="w-full max-w-7xl">
        <h1 className="text-4xl font-extrabold mb-10 text-center tracking-tight text-gray-800">
          UK Student Loan Repayment Model
        </h1>

        {/* Notebook Tabs */}
        <div className="flex space-x-1 ml-4">
          <button
            onClick={() => setActiveTab("main")}
            className={`px-8 py-3 font-bold rounded-t-xl transition-all duration-200 border-x border-t ${
              activeTab === "main"
                ? "bg-white text-blue-600 border-gray-200 -mb-[1px] z-10"
                : "bg-gray-200 text-gray-500 border-transparent hover:bg-gray-300"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("salary")}
            className={`px-8 py-3 font-bold rounded-t-xl transition-all duration-200 border-x border-t ${
              activeTab === "salary"
                ? "bg-white text-blue-600 border-gray-200 -mb-[1px] z-10"
                : "bg-gray-200 text-gray-500 border-transparent hover:bg-gray-300"
            }`}
          >
            Salary Details
          </button>
        </div>

        {/* Notebook Page Content */}
        <div className="bg-white border border-gray-200 rounded-xl rounded-tl-none shadow-2xl p-8 min-h-[600px]">
          {activeTab === "main" ? (
            <div className="space-y-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Left Column: Core Inputs */}
                <div className="lg:col-span-1 space-y-8">
                  <section>
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-800 border-b pb-2">
                      <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
                      Loan Parameters
                    </h2>
                    
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Initial Balance</label>
                          <span className="text-lg font-mono font-bold text-blue-700">£{initialBalance.toLocaleString()}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="150000"
                          step="1000"
                          value={initialBalance}
                          onChange={(e) => setInitialBalance(parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Interest Rate</label>
                          <span className="text-lg font-mono font-bold text-blue-700">{(interestRate * 100).toFixed(1)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="0.15"
                          step="0.001"
                          value={interestRate}
                          onChange={(e) => setInterestRate(parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Remaining Years</label>
                          <span className="text-lg font-mono font-bold text-blue-700">{remainingYears}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="40"
                          step="1"
                          value={remainingYears}
                          onChange={(e) => setRemainingYears(parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>
                    </div>
                  </section>

                  <section>
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-800 border-b pb-2">
                      <span className="w-2 h-8 bg-green-500 rounded-full"></span>
                      Lump Sums
                    </h2>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-2 text-gray-400 text-sm">Yr</span>
                        <input
                          type="number"
                          value={lumpSumYear || ""}
                          onChange={(e) => setLumpSumYear(parseInt(e.target.value) || 0)}
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                          placeholder="Year"
                        />
                      </div>
                      <div className="relative flex-[2]">
                        <span className="absolute left-3 top-2 text-gray-400 text-sm">£</span>
                        <input
                          type="number"
                          value={lumpSumAmount || ""}
                          onChange={(e) => setLumpSumAmount(parseInt(e.target.value) || 0)}
                          className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                          placeholder="Amount"
                        />
                      </div>
                      <button
                        onClick={handleAddLumpSum}
                        className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-md"
                      >
                        Add
                      </button>
                    </div>
                    <ul className="mt-6 space-y-3">
                      {lumpSumRepayments.map((l, i) => (
                        <li key={i} className="flex justify-between items-center bg-green-50 border border-green-100 px-4 py-3 rounded-lg animate-in fade-in slide-in-from-left-2">
                          <span className="font-semibold text-green-800">
                            Year {l.year}: <span className="font-mono">£{l.amount.toLocaleString()}</span>
                          </span>
                          <button
                            onClick={() => handleRemoveLumpSum(i)}
                            className="p-1 text-green-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                {/* Right Column: Visualizations */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 shadow-inner">
                    <div className="flex justify-between items-end mb-6">
                      <h2 className="text-2xl font-bold text-gray-800">Balance Forecast</h2>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-500 uppercase">Total Repayments</p>
                        <p className="text-3xl font-black text-blue-600 font-mono">
                          £{totalRepayments.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis 
                            type="number" 
                            dataKey="time" 
                            name="Year" 
                            unit="yr" 
                            domain={[0, remainingYears]} 
                            stroke="#9ca3af"
                            fontSize={12}
                          />
                          <YAxis
                            tickFormatter={(tick) => `£${(tick / 1000).toFixed(0)}k`}
                            stroke="#9ca3af"
                            fontSize={12}
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number | string) => [`£${Number(value || 0).toLocaleString()}`, 'Balance']}
                            labelFormatter={(label) => `Year ${Number(label).toFixed(1)}`}
                          />
                          <Area
                            type="monotone"
                            dataKey="balance"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorBalance)"
                            name="Loan Balance"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {lumpSumImpact && (
                    <div className="p-8 bg-blue-600 rounded-2xl text-white shadow-lg transform hover:scale-[1.01] transition-transform duration-200">
                      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Lump Sum Impact Analysis
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                          <p className="text-blue-100 text-sm font-semibold uppercase tracking-wider mb-1">Total Extra Paid</p>
                          <p className="text-3xl font-black font-mono">
                            £{lumpSumImpact.totalLumpSum.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-blue-100 text-sm font-semibold uppercase tracking-wider mb-1">Lifetime Savings</p>
                          <p className="text-3xl font-black font-mono text-green-300">
                            £{lumpSumImpact.savings.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-blue-100 text-sm font-semibold uppercase tracking-wider mb-1">Annualized ROI</p>
                          <p className="text-3xl font-black font-mono">
                            {lumpSumImpact.cagr.toFixed(2)}%
                          </p>
                          <p className="text-xs text-blue-200 mt-2 italic">
                            Over {lumpSumImpact.yearsHeld.toFixed(1)} years
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Table */}
              <section className="pt-8 border-t border-gray-100">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Yearly Breakdown</h2>
                <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Year</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Max Monthly Payment</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Year-End Balance</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Total Paid to Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {summaryData.map(row => (
                        <tr key={row.year} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">Year {row.year}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">£{row.maxMonthlyRepayment.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">£{row.endBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-semibold text-blue-600">£{row.totalPayments.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : (
            /* Tab 2: Salary Details */
            <div className="max-w-3xl mx-auto py-8">
              <h2 className="text-3xl font-bold mb-10 flex items-center gap-3 text-gray-800">
                <span className="w-3 h-10 bg-blue-600 rounded-full"></span>
                Salary Projection Settings
              </h2>
              
              <div className="space-y-12">
                <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className={`p-6 rounded-2xl border transition-all ${!isManualSalary ? 'bg-blue-50 border-blue-100 shadow-md' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                    <div className="flex justify-between mb-4">
                      <label className="text-sm font-bold text-gray-600 uppercase tracking-wider">Starting Salary</label>
                      <span className="text-xl font-mono font-bold text-blue-700">£{startingSalary.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min="20000"
                      max="150000"
                      step="1000"
                      value={startingSalary}
                      onChange={(e) => setStartingSalary(parseInt(e.target.value))}
                      disabled={isManualSalary}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-30"
                    />
                    {!isManualSalary && <p className="mt-4 text-xs text-blue-600 font-medium">Auto-calculates future projections</p>}
                  </div>

                  <div className={`p-6 rounded-2xl border transition-all ${!isManualSalary ? 'bg-blue-50 border-blue-100 shadow-md' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                    <div className="flex justify-between mb-4">
                      <label className="text-sm font-bold text-gray-600 uppercase tracking-wider">Growth Factor</label>
                      <span className="text-xl font-mono font-bold text-blue-700">{salaryGrowthFactor}x</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="2.0"
                      step="0.01"
                      value={salaryGrowthFactor}
                      onChange={(e) => setSalaryGrowthFactor(parseFloat(e.target.value))}
                      disabled={isManualSalary}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-30"
                    />
                    {!isManualSalary && <p className="mt-4 text-xs text-blue-600 font-medium">Controls logarithmic growth curve</p>}
                  </div>
                </section>

                <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between p-6 bg-gray-50 border-b border-gray-200">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">Projection Overrides</h3>
                      <p className="text-sm text-gray-500 mt-1">Enable manual control for specific years</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isManualSalary}
                        onChange={(e) => setIsManualSalary(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-3 text-sm font-bold text-gray-700">Manual</span>
                    </label>
                  </div>

                  <div className="p-8 space-y-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">Year</div>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">Expected Salary</div>
                    </div>
                    {salaryProjections.map((p, i) => (
                      <div key={i} className="flex items-center gap-4 group">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-3 text-gray-400 text-xs">Yr</span>
                          <input
                            type="number"
                            value={p.year || ""}
                            onChange={(e) =>
                              handleSalaryChange(i, parseInt(e.target.value) || 0, p.salary)
                            }
                            readOnly={!isManualSalary}
                            className={`w-full pl-8 pr-4 py-3 rounded-xl transition-all border ${
                              isManualSalary 
                                ? 'border-blue-200 bg-white focus:ring-2 focus:ring-blue-500 shadow-sm' 
                                : 'border-gray-100 bg-gray-50 text-gray-500 cursor-default'
                            }`}
                          />
                        </div>
                        <div className="relative flex-[2]">
                          <span className="absolute left-3 top-3 text-gray-400 text-xs">£</span>
                          <input
                            type="number"
                            value={p.salary || ""}
                            onChange={(e) =>
                              handleSalaryChange(i, p.year, parseInt(e.target.value) || 0)
                            }
                            readOnly={!isManualSalary}
                            className={`w-full pl-6 pr-4 py-3 rounded-xl transition-all border ${
                              isManualSalary 
                                ? 'border-blue-200 bg-white focus:ring-2 focus:ring-blue-500 shadow-sm' 
                                : 'border-gray-100 bg-gray-50 text-gray-500 cursor-default'
                            }`}
                          />
                        </div>
                      </div>
                    ))}
                    {!isManualSalary && (
                      <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3 items-start">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-amber-800">
                          Inputs are locked while in automatic mode. Toggle <strong>Manual</strong> to customize these values.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
