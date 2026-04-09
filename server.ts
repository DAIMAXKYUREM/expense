import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  // --- Auth Middleware ---
  const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      (req as any).userId = decoded.userId;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // --- API Routes ---
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) return res.status(400).json({ error: 'User already exists' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { email, password: hashedPassword, name },
      });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
      res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(400).json({ error: 'Invalid credentials' });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
      res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  app.get('/api/auth/me', authenticate, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: (req as any).userId } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user: { id: user.id, email: user.email, name: user.name } });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  // --- Recurring Expense Processor ---
  const processRecurringExpenses = async (userId: string) => {
    const now = new Date();
    const recurringExpenses = await prisma.expense.findMany({
      where: { 
        userId, 
        isRecurring: true, 
        nextRecurringDate: { lte: now } 
      }
    });

    for (const exp of recurringExpenses) {
      let currentDate = exp.nextRecurringDate!;
      let currentExp = exp;

      while (currentDate <= now) {
        let nextDate = new Date(currentDate);
        if (exp.recurringInterval === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        else if (exp.recurringInterval === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        else if (exp.recurringInterval === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        else if (exp.recurringInterval === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
        else break;

        const newExp = await prisma.expense.create({
          data: {
            amount: exp.amount,
            category: exp.category,
            description: exp.description,
            date: currentDate,
            isRecurring: true,
            recurringInterval: exp.recurringInterval,
            nextRecurringDate: nextDate,
            userId: exp.userId
          }
        });

        await prisma.expense.update({
          where: { id: currentExp.id },
          data: { isRecurring: false, nextRecurringDate: null, recurringInterval: null }
        });

        currentExp = newExp;
        currentDate = nextDate;
      }
    }
  };

  // --- Expenses API ---
  app.get('/api/expenses', authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      await processRecurringExpenses(userId);
      const expenses = await prisma.expense.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      });
      res.json(expenses);
    } catch (error) {
      console.error('Fetch expenses error:', error);
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
  });

  app.post('/api/expenses', authenticate, async (req, res) => {
    try {
      const { amount, category, date, description, isRecurring, recurringInterval } = req.body;
      const parsedDate = new Date(date);
      
      let nextRecurringDate = null;
      if (isRecurring && recurringInterval) {
        nextRecurringDate = new Date(parsedDate);
        if (recurringInterval === 'daily') nextRecurringDate.setDate(nextRecurringDate.getDate() + 1);
        else if (recurringInterval === 'weekly') nextRecurringDate.setDate(nextRecurringDate.getDate() + 7);
        else if (recurringInterval === 'monthly') nextRecurringDate.setMonth(nextRecurringDate.getMonth() + 1);
        else if (recurringInterval === 'yearly') nextRecurringDate.setFullYear(nextRecurringDate.getFullYear() + 1);
      }

      const expense = await prisma.expense.create({
        data: {
          amount: parseFloat(amount),
          category,
          date: parsedDate,
          description,
          isRecurring: !!isRecurring,
          recurringInterval: isRecurring ? recurringInterval : null,
          nextRecurringDate,
          userId: (req as any).userId,
        },
      });
      res.json(expense);
    } catch (error) {
      console.error('Create expense error:', error);
      res.status(500).json({ error: 'Failed to create expense' });
    }
  });

  app.put('/api/expenses/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, category, date, description, isRecurring, recurringInterval } = req.body;
      
      const existing = await prisma.expense.findUnique({ where: { id } });
      if (!existing || existing.userId !== (req as any).userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const parsedDate = new Date(date);
      let nextRecurringDate = existing.nextRecurringDate;
      
      // If recurring settings changed, recalculate next date
      if (isRecurring && (!existing.isRecurring || existing.recurringInterval !== recurringInterval || existing.date.getTime() !== parsedDate.getTime())) {
        nextRecurringDate = new Date(parsedDate);
        if (recurringInterval === 'daily') nextRecurringDate.setDate(nextRecurringDate.getDate() + 1);
        else if (recurringInterval === 'weekly') nextRecurringDate.setDate(nextRecurringDate.getDate() + 7);
        else if (recurringInterval === 'monthly') nextRecurringDate.setMonth(nextRecurringDate.getMonth() + 1);
        else if (recurringInterval === 'yearly') nextRecurringDate.setFullYear(nextRecurringDate.getFullYear() + 1);
      } else if (!isRecurring) {
        nextRecurringDate = null;
      }

      const expense = await prisma.expense.update({
        where: { id },
        data: {
          amount: parseFloat(amount),
          category,
          date: parsedDate,
          description,
          isRecurring: !!isRecurring,
          recurringInterval: isRecurring ? recurringInterval : null,
          nextRecurringDate,
        },
      });
      res.json(expense);
    } catch (error) {
      console.error('Update expense error:', error);
      res.status(500).json({ error: 'Failed to update expense' });
    }
  });

  app.delete('/api/expenses/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await prisma.expense.findUnique({ where: { id } });
      if (!existing || existing.userId !== (req as any).userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await prisma.expense.delete({ where: { id } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete expense' });
    }
  });

  // --- Income API ---
  app.get('/api/income', authenticate, async (req, res) => {
    try {
      const incomes = await prisma.income.findMany({
        where: { userId: (req as any).userId },
        orderBy: { date: 'desc' },
      });
      res.json(incomes);
    } catch (error) {
      console.error('Fetch income error:', error);
      res.status(500).json({ error: 'Failed to fetch income' });
    }
  });

  app.post('/api/income', authenticate, async (req, res) => {
    try {
      const { amount, source, date, description } = req.body;
      const income = await prisma.income.create({
        data: {
          amount: parseFloat(amount),
          source,
          date: new Date(date),
          description,
          userId: (req as any).userId,
        },
      });
      res.json(income);
    } catch (error) {
      console.error('Create income error:', error);
      res.status(500).json({ error: 'Failed to create income' });
    }
  });

  app.put('/api/income/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, source, date, description } = req.body;
      
      const existing = await prisma.income.findUnique({ where: { id } });
      if (!existing || existing.userId !== (req as any).userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const income = await prisma.income.update({
        where: { id },
        data: {
          amount: parseFloat(amount),
          source,
          date: new Date(date),
          description,
        },
      });
      res.json(income);
    } catch (error) {
      console.error('Update income error:', error);
      res.status(500).json({ error: 'Failed to update income' });
    }
  });

  app.delete('/api/income/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await prisma.income.findUnique({ where: { id } });
      if (!existing || existing.userId !== (req as any).userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await prisma.income.delete({ where: { id } });
      res.json({ success: true });
    } catch (error) {
      console.error('Delete income error:', error);
      res.status(500).json({ error: 'Failed to delete income' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
