import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, startOfYear, endOfYear, startOfDay, endOfDay, isValid } from 'date-fns';
import { Plus, Pencil, Trash2, DollarSign, TrendingUp, PieChart as PieChartIcon, Wallet, Search, X, Download, Repeat } from 'lucide-react';

interface Expense {
  id: string;
  amount: number;
  category: string;
  date: string;
  description: string | null;
  isRecurring: boolean;
  recurringInterval: string | null;
}

interface Income {
  id: string;
  amount: number;
  source: string;
  date: string;
  description: string | null;
}

const CATEGORIES = ['Food', 'Travel', 'Shopping', 'Housing', 'Utilities', 'Entertainment', 'Other'];
const INCOME_SOURCES = ['Salary', 'Freelance', 'Investments', 'Gift', 'Other'];
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658', '#ff7300'];

export function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Expense Dialog State
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  
  // Income Dialog State
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [incomeToDelete, setIncomeToDelete] = useState<string | null>(null);
  
  // Expense Form state
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState(CATEGORIES[0]);
  const [expDate, setExpDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expDescription, setExpDescription] = useState('');
  const [expIsRecurring, setExpIsRecurring] = useState(false);
  const [expRecurringInterval, setExpRecurringInterval] = useState('monthly');
  const [expFormError, setExpFormError] = useState('');

  // Income Form state
  const [incAmount, setIncAmount] = useState('');
  const [incSource, setIncSource] = useState(INCOME_SOURCES[0]);
  const [incDate, setIncDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [incDescription, setIncDescription] = useState('');
  const [incFormError, setIncFormError] = useState('');

  // Filter state
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterPeriod, setFilterPeriod] = useState('All Time');
  const [pieFilterCategory, setPieFilterCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [expRes, incRes] = await Promise.all([
        fetch('/api/expenses'),
        fetch('/api/income')
      ]);
      
      if (expRes.ok) setExpenses(await expRes.json());
      if (incRes.ok) setIncomes(await incRes.json());
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  // --- Expense Handlers ---
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpFormError('');

    const numAmount = parseFloat(expAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setExpFormError('Amount must be a positive number.');
      return;
    }

    const parsedDate = parseISO(expDate);
    if (!isValid(parsedDate)) {
      setExpFormError('Please enter a valid date.');
      return;
    }

    const payload = { 
      amount: numAmount, 
      category: expCategory, 
      date: expDate, 
      description: expDescription,
      isRecurring: expIsRecurring,
      recurringInterval: expIsRecurring ? expRecurringInterval : null
    };
    
    try {
      if (editingExpense) {
        await fetch(`/api/expenses/${editingExpense.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      fetchData();
      setIsExpenseDialogOpen(false);
      resetExpenseForm();
    } catch (error) {
      console.error('Failed to save expense', error);
      setExpFormError('Failed to save expense. Please try again.');
    }
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      await fetch(`/api/expenses/${expenseToDelete}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Failed to delete expense', error);
    } finally {
      setExpenseToDelete(null);
    }
  };

  const resetExpenseForm = () => {
    setEditingExpense(null);
    setExpAmount('');
    setExpCategory(CATEGORIES[0]);
    setExpDate(format(new Date(), 'yyyy-MM-dd'));
    setExpDescription('');
    setExpIsRecurring(false);
    setExpRecurringInterval('monthly');
    setExpFormError('');
  };

  const openEditExpenseDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setExpAmount(expense.amount.toString());
    setExpCategory(expense.category);
    setExpDate(format(parseISO(expense.date), 'yyyy-MM-dd'));
    setExpDescription(expense.description || '');
    setExpIsRecurring(expense.isRecurring);
    setExpRecurringInterval(expense.recurringInterval || 'monthly');
    setExpFormError('');
    setIsExpenseDialogOpen(true);
  };

  // --- Income Handlers ---
  const handleIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIncFormError('');

    const numAmount = parseFloat(incAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setIncFormError('Amount must be a positive number.');
      return;
    }

    const parsedDate = parseISO(incDate);
    if (!isValid(parsedDate)) {
      setIncFormError('Please enter a valid date.');
      return;
    }

    const payload = { amount: numAmount, source: incSource, date: incDate, description: incDescription };
    
    try {
      if (editingIncome) {
        await fetch(`/api/income/${editingIncome.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/income', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      fetchData();
      setIsIncomeDialogOpen(false);
      resetIncomeForm();
    } catch (error) {
      console.error('Failed to save income', error);
      setIncFormError('Failed to save income. Please try again.');
    }
  };

  const confirmDeleteIncome = async () => {
    if (!incomeToDelete) return;
    try {
      await fetch(`/api/income/${incomeToDelete}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Failed to delete income', error);
    } finally {
      setIncomeToDelete(null);
    }
  };

  const resetIncomeForm = () => {
    setEditingIncome(null);
    setIncAmount('');
    setIncSource(INCOME_SOURCES[0]);
    setIncDate(format(new Date(), 'yyyy-MM-dd'));
    setIncDescription('');
    setIncFormError('');
  };

  const openEditIncomeDialog = (income: Income) => {
    setEditingIncome(income);
    setIncAmount(income.amount.toString());
    setIncSource(income.source);
    setIncDate(format(parseISO(income.date), 'yyyy-MM-dd'));
    setIncDescription(income.description || '');
    setIncFormError('');
    setIsIncomeDialogOpen(true);
  };

  // --- Filtering & Export ---
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const expDate = parseISO(exp.date);
      const now = new Date();
      
      if (filterCategory !== 'All' && exp.category !== filterCategory) return false;
      if (pieFilterCategory && exp.category !== pieFilterCategory) return false;
      
      if (filterPeriod === 'Daily') {
        if (!isWithinInterval(expDate, { start: startOfDay(now), end: endOfDay(now) })) return false;
      }
      if (filterPeriod === 'Monthly') {
        if (!isWithinInterval(expDate, { start: startOfMonth(now), end: endOfMonth(now) })) return false;
      }
      if (filterPeriod === 'Yearly') {
        if (!isWithinInterval(expDate, { start: startOfYear(now), end: endOfYear(now) })) return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesDesc = exp.description?.toLowerCase().includes(query);
        const matchesCat = exp.category.toLowerCase().includes(query);
        if (!matchesDesc && !matchesCat) return false;
      }
      
      return true;
    });
  }, [expenses, filterCategory, filterPeriod, pieFilterCategory, searchQuery]);

  const exportToCSV = () => {
    if (filteredExpenses.length === 0) return;
    
    const headers = ['Date', 'Category', 'Description', 'Amount', 'Recurring'];
    const csvContent = [
      headers.join(','),
      ...filteredExpenses.map(exp => [
        format(parseISO(exp.date), 'yyyy-MM-dd'),
        `"${exp.category}"`,
        `"${exp.description || ''}"`,
        exp.amount.toFixed(2),
        exp.isRecurring ? exp.recurringInterval : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = useMemo(() => {
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);
    
    const now = new Date();
    const monthlyExpenses = expenses.filter(exp => 
      isWithinInterval(parseISO(exp.date), { start: startOfMonth(now), end: endOfMonth(now) })
    );
    const monthlyTotal = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    const categoryTotals = expenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    
    let topCategory = 'None';
    let maxAmount = 0;
    Object.entries(categoryTotals).forEach(([cat, amt]) => {
      if (amt > maxAmount) {
        maxAmount = amt;
        topCategory = cat;
      }
    });

    return { totalExpenses, totalIncome, balance: totalIncome - totalExpenses, monthlyTotal, topCategory };
  }, [expenses, incomes]);

  const chartData = useMemo(() => {
    const categoryTotals = filteredExpenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  if (loading) return <div className="flex justify-center py-12">Loading...</div>;

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Balance</CardTitle>
            <Wallet className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${summary.balance.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Income: ${summary.totalIncome.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Spending</CardTitle>
            <DollarSign className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary.totalExpenses.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Monthly Spending</CardTitle>
            <TrendingUp className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary.monthlyTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Top Category</CardTitle>
            <PieChartIcon className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.topCategory}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content (Tabs for Expenses/Income) */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="expenses" className="w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <TabsList>
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
              </TabsList>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={exportToCSV} disabled={filteredExpenses.length === 0}>
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
                
                {/* Add Expense Dialog */}
                <Dialog open={isExpenseDialogOpen} onOpenChange={(open) => {
                  setIsExpenseDialogOpen(open);
                  if (!open) resetExpenseForm();
                }}>
                  <DialogTrigger render={<Button><Plus className="w-4 h-4 mr-2" /> Add Expense</Button>} />
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleExpenseSubmit} className="space-y-4 mt-4">
                      {expFormError && (
                        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
                          {expFormError}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="expAmount">Amount ($)</Label>
                        <Input
                          id="expAmount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={expAmount}
                          onChange={(e) => setExpAmount(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expCategory">Category</Label>
                        <Select value={expCategory} onValueChange={setExpCategory}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expDate">Date</Label>
                        <Input
                          id="expDate"
                          type="date"
                          required
                          value={expDate}
                          onChange={(e) => setExpDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expDescription">Description (Optional)</Label>
                        <Input
                          id="expDescription"
                          value={expDescription}
                          onChange={(e) => setExpDescription(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center space-x-2 pt-2">
                        <Checkbox 
                          id="isRecurring" 
                          checked={expIsRecurring} 
                          onCheckedChange={(checked) => setExpIsRecurring(checked as boolean)} 
                        />
                        <Label htmlFor="isRecurring" className="font-normal cursor-pointer">
                          Make this a recurring expense
                        </Label>
                      </div>
                      {expIsRecurring && (
                        <div className="space-y-2 pl-6 border-l-2 border-primary/20 ml-2">
                          <Label htmlFor="expRecurringInterval">Interval</Label>
                          <Select value={expRecurringInterval} onValueChange={setExpRecurringInterval}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="yearly">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <Button type="submit" className="w-full">
                        {editingExpense ? 'Save Changes' : 'Add Expense'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>

                {/* Add Income Dialog */}
                <Dialog open={isIncomeDialogOpen} onOpenChange={(open) => {
                  setIsIncomeDialogOpen(open);
                  if (!open) resetIncomeForm();
                }}>
                  <DialogTrigger render={<Button variant="secondary"><Plus className="w-4 h-4 mr-2" /> Add Income</Button>} />
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingIncome ? 'Edit Income' : 'Add New Income'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleIncomeSubmit} className="space-y-4 mt-4">
                      {incFormError && (
                        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
                          {incFormError}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="incAmount">Amount ($)</Label>
                        <Input
                          id="incAmount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={incAmount}
                          onChange={(e) => setIncAmount(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="incSource">Source</Label>
                        <Select value={incSource} onValueChange={setIncSource}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INCOME_SOURCES.map(src => (
                              <SelectItem key={src} value={src}>{src}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="incDate">Date</Label>
                        <Input
                          id="incDate"
                          type="date"
                          required
                          value={incDate}
                          onChange={(e) => setIncDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="incDescription">Description (Optional)</Label>
                        <Input
                          id="incDescription"
                          value={incDescription}
                          onChange={(e) => setIncDescription(e.target.value)}
                        />
                      </div>
                      <Button type="submit" className="w-full">
                        {editingIncome ? 'Save Changes' : 'Add Income'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <TabsContent value="expenses" className="space-y-4 mt-0">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative w-full sm:w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search expenses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Time">All Time</SelectItem>
                    <SelectItem value="Daily">Today</SelectItem>
                    <SelectItem value="Monthly">This Month</SelectItem>
                    <SelectItem value="Yearly">This Year</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Categories</SelectItem>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {pieFilterCategory && (
                <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-3 py-1.5 rounded-full w-fit mb-4">
                  <span>Filtered by: <strong>{pieFilterCategory}</strong></span>
                  <button onClick={() => setPieFilterCategory(null)} className="hover:text-primary/80">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          No expenses found for the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredExpenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>{format(parseISO(expense.date), 'MMM d, yyyy')}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {expense.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-600">
                            <div className="flex items-center gap-2">
                              {expense.description || '-'}
                              {expense.isRecurring && (
                                <span className="inline-flex items-center text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded" title={`Recurring ${expense.recurringInterval}`}>
                                  <Repeat className="w-3 h-3 mr-1" />
                                  {expense.recurringInterval}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">${expense.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEditExpenseDialog(expense)}>
                                <Pencil className="w-4 h-4 text-gray-500" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setExpenseToDelete(expense.id)}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="income" className="space-y-4 mt-0">
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          No income records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      incomes.map((income) => (
                        <TableRow key={income.id}>
                          <TableCell>{format(parseISO(income.date), 'MMM d, yyyy')}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {income.source}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-600">{income.description || '-'}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">+${income.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEditIncomeDialog(income)}>
                                <Pencil className="w-4 h-4 text-gray-500" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setIncomeToDelete(income.id)}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar (Charts) */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Spending by Category</CardTitle>
              <p className="text-xs text-muted-foreground">Click a slice to filter</p>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No data to display
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        onClick={(data) => {
                          setPieFilterCategory(pieFilterCategory === data.name ? null : data.name);
                        }}
                        className="cursor-pointer outline-none"
                      >
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[index % COLORS.length]} 
                            opacity={pieFilterCategory && pieFilterCategory !== entry.name ? 0.3 : 1}
                            className="transition-opacity duration-200"
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-4 space-y-2">
                {chartData.map((entry, index) => (
                  <div 
                    key={entry.name} 
                    className={`flex items-center justify-between text-sm p-2 rounded-md cursor-pointer transition-colors ${pieFilterCategory === entry.name ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                    onClick={() => setPieFilterCategory(pieFilterCategory === entry.name ? null : entry.name)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className={pieFilterCategory && pieFilterCategory !== entry.name ? 'text-gray-400' : ''}>{entry.name}</span>
                    </div>
                    <span className={`font-medium ${pieFilterCategory && pieFilterCategory !== entry.name ? 'text-gray-400' : ''}`}>${entry.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Expense Confirmation Dialog */}
      <Dialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-gray-600">
            Are you sure you want to delete this expense? This action cannot be undone.
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setExpenseToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteExpense}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Income Confirmation Dialog */}
      <Dialog open={!!incomeToDelete} onOpenChange={(open) => !open && setIncomeToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-gray-600">
            Are you sure you want to delete this income record? This action cannot be undone.
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIncomeToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteIncome}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
