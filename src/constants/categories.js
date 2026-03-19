export const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Food & Dining', icon: 'fast-food', color: '#FF6B6B' },
  { id: 2, name: 'Transport', icon: 'car', color: '#4ECDC4' },
  { id: 3, name: 'Shopping', icon: 'cart', color: '#45B7D1' },
  { id: 5, name: 'Entertainment', icon: 'game-controller', color: '#FFEAA7' },
  { id: 6, name: 'Health', icon: 'medkit', color: '#DDA0DD' },
  { id: 7, name: 'Education', icon: 'book', color: '#98D8C8' },
  { id: 8, name: 'Groceries', icon: 'basket', color: '#F7DC6F' },
  { id: 9, name: 'Rent', icon: 'home', color: '#BB8FCE' },
  { id: 10, name: 'Other', icon: 'ellipsis-horizontal', color: '#AEB6BF' },
];

export const CATEGORY_ICONS = {
  'Food & Dining': 'fast-food',
  'Transport': 'car',
  'Shopping': 'cart',
  'Entertainment': 'game-controller',
  'Health': 'medkit',
  'Education': 'book',
  'Groceries': 'basket',
  'Rent': 'home',
  'Other': 'ellipsis-horizontal',
};

export const EARNING_TYPES = [
  { value: 'salary', label: 'Salary', icon: 'cash-outline' },
  { value: 'bonus', label: 'Bonus', icon: 'gift-outline' },
  { value: 'overtime', label: 'Overtime', icon: 'time-outline' },
  { value: 'freelance', label: 'Freelance', icon: 'laptop-outline' },
  { value: 'commission', label: 'Commission', icon: 'pie-chart-outline' },
  { value: 'rental', label: 'Rental Income', icon: 'home-outline' },
  { value: 'profit', label: 'Business Profit', icon: 'briefcase-outline' },
  { value: 'refund', label: 'Refund', icon: 'return-down-back-outline' },
  { value: 'advance', label: 'Advance', icon: 'arrow-forward-circle-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

export const EXPENSE_ENTRY_CATEGORIES = [
  { value: 'misc', label: 'Misc', icon: 'apps-outline' },
  { value: 'investment', label: 'Investment', icon: 'trending-up-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

export const ENTRY_TYPES = [
  { id: 'earning', label: 'Earning', icon: 'wallet-outline', color: '#4CAF50', type: 'earning' },
  { id: 'expense', label: 'Expense', icon: 'cart-outline', color: '#F44336', type: 'spending' },
];
