const Transaction = require('../models/Transaction');

// @desc    Get all transactions for user
// @route   GET /api/transactions
const getTransactions = async (req, res, next) => {
  try {
    const { category, type, startDate, endDate, search, page = 1, limit = 20 } = req.query;

    const query = { userId: req.user._id };

    if (category) query.category = category;
    if (type) query.type = type;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    if (search) {
      query.notes = { $regex: search, $options: 'i' };
    }

    const total = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    res.json({
      transactions,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      total,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create transaction
// @route   POST /api/transactions
const createTransaction = async (req, res, next) => {
  try {
    const { amount, category, type, date, notes } = req.body;

    const transaction = await Transaction.create({
      userId: req.user._id,
      amount,
      category,
      type,
      date: date || Date.now(),
      notes,
    });

    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
};

// @desc    Update transaction
// @route   PUT /api/transactions/:id
const updateTransaction = async (req, res, next) => {
  try {
    let transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      res.status(404);
      throw new Error('Transaction not found');
    }

    // Check ownership
    if (transaction.userId.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized');
    }

    transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json(transaction);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
const deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      res.status(404);
      throw new Error('Transaction not found');
    }

    // Check ownership
    if (transaction.userId.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized');
    }

    await Transaction.findByIdAndDelete(req.params.id);

    res.json({ message: 'Transaction removed' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTransactions, createTransaction, updateTransaction, deleteTransaction };
