export const APP_CONFIG = {
  name: 'Daily Expense',
  version: '2.0',
  defaultCurrency: 'PKR',
  currencySymbol: 'Rs.',
  dateFormat: 'DD/MM/YYYY',
  pinLength: 6,
  paginationLimit: 20,
};

export const CURRENCIES = [
  { code: 'PKR', symbol: 'Rs.', name: 'Pakistani Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal' },
];
