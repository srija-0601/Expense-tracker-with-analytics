const Transaction = require('../models/Transaction');

// @desc    Get monthly trends (income vs expense for last 6 months)
// @route   GET /api/analytics
const getAnalytics = async (req, res, next) => {
  try {
    const { months = 6 } = req.query;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months) + 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const trends = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
    ]);

    // Format into monthly data
    const monthlyData = {};
    trends.forEach((t) => {
      const key = `${t._id.year}-${String(t._id.month).padStart(2, '0')}`;
      if (!monthlyData[key]) {
        monthlyData[key] = { month: key, income: 0, expense: 0 };
      }
      monthlyData[key][t._id.type] = t.total;
    });

    // Fill in missing months
    const result = [];
    const now = new Date();
    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      result.push(
        monthlyData[key] || { month: key, income: 0, expense: 0 }
      );
    }

    // Add savings
    result.forEach((r) => {
      r.savings = r.income - r.expense;
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// @desc    Get category-wise spending breakdown
// @route   GET /api/analytics/category
const getCategoryAnalytics = async (req, res, next) => {
  try {
    const { month } = req.query;
    const currentMonth = month || new Date().toISOString().slice(0, 7);

    const startDate = new Date(`${currentMonth}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const categoryData = await Transaction.aggregate([
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
          count: { $sum: 1 },
        },
      },
      {
        $sort: { total: -1 },
      },
    ]);

    res.json(
      categoryData.map((c) => ({
        category: c._id,
        total: c.total,
        count: c.count,
      }))
    );
  } catch (error) {
    next(error);
  }
};

// @desc    Get summary stats for dashboard
// @route   GET /api/analytics/summary
const getSummary = async (req, res, next) => {
  try {
    const { month } = req.query;
    const currentMonth = month || new Date().toISOString().slice(0, 7);

    const startDate = new Date(`${currentMonth}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // Previous month for comparison
    const prevStart = new Date(startDate);
    prevStart.setMonth(prevStart.getMonth() - 1);

    const [current, previous] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            userId: req.user._id,
            date: { $gte: startDate, $lt: endDate },
          },
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: {
            userId: req.user._id,
            date: { $gte: prevStart, $lt: startDate },
          },
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const currentData = { income: 0, expense: 0, transactions: 0 };
    current.forEach((c) => {
      currentData[c._id] = c.total;
      currentData.transactions += c.count;
    });
    currentData.savings = currentData.income - currentData.expense;

    const prevData = { income: 0, expense: 0 };
    previous.forEach((p) => {
      prevData[p._id] = p.total;
    });

    // Calculate percentage changes
    const calcChange = (curr, prev) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    res.json({
      income: currentData.income,
      expense: currentData.expense,
      savings: currentData.savings,
      transactions: currentData.transactions,
      incomeChange: calcChange(currentData.income, prevData.income),
      expenseChange: calcChange(currentData.expense, prevData.expense),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAnalytics, getCategoryAnalytics, getSummary };
