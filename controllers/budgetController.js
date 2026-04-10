const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');

// @desc    Get budgets for a month with spending data
// @route   GET /api/budgets
const getBudgets = async (req, res, next) => {
  try {
    const { month } = req.query;
    const currentMonth = month || new Date().toISOString().slice(0, 7);

    const budgets = await Budget.find({
      userId: req.user._id,
      month: currentMonth,
    });

    // Get spending for each budget category this month
    const startDate = new Date(`${currentMonth}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const spending = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          type: 'expense',
          date: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
        },
      },
    ]);

    const spendingMap = {};
    spending.forEach((s) => {
      spendingMap[s._id] = s.total;
    });

    const budgetsWithSpending = budgets.map((b) => ({
      _id: b._id,
      category: b.category,
      limit: b.limit,
      month: b.month,
      spent: spendingMap[b.category] || 0,
      percentage: Math.round(((spendingMap[b.category] || 0) / b.limit) * 100),
    }));

    res.json(budgetsWithSpending);
  } catch (error) {
    next(error);
  }
};

// @desc    Create or update budget
// @route   POST /api/budgets
const createBudget = async (req, res, next) => {
  try {
    const { category, limit, month } = req.body;
    const currentMonth = month || new Date().toISOString().slice(0, 7);

    // Upsert: create or update
    const budget = await Budget.findOneAndUpdate(
      { userId: req.user._id, category, month: currentMonth },
      { userId: req.user._id, category, limit, month: currentMonth },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(201).json(budget);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete budget
// @route   DELETE /api/budgets/:id
const deleteBudget = async (req, res, next) => {
  try {
    const budget = await Budget.findById(req.params.id);

    if (!budget) {
      res.status(404);
      throw new Error('Budget not found');
    }

    if (budget.userId.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized');
    }

    await Budget.findByIdAndDelete(req.params.id);

    res.json({ message: 'Budget removed' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getBudgets, createBudget, deleteBudget };
