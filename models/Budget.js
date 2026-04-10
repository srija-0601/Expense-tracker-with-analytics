const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      required: [true, 'Please add a category'],
      enum: [
        'Food',
        'Transport',
        'Shopping',
        'Entertainment',
        'Bills',
        'Health',
        'Education',
        'Housing',
        'Other',
      ],
    },
    limit: {
      type: Number,
      required: [true, 'Please add a budget limit'],
      min: [1, 'Limit must be at least 1'],
    },
    month: {
      type: String,
      required: [true, 'Please specify the month'],
      match: [/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'],
    },
  },
  {
    timestamps: true,
  }
);

// Ensure one budget per category per month per user
budgetSchema.index({ userId: 1, category: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
