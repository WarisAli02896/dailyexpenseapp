export const EXPENSE_MESSAGES = {
  // Success
  ADD_SUCCESS: 'Expense added successfully!',
  INVESTMENT_ADD_SUCCESS: 'Investment added successfully!',
  UPDATE_SUCCESS: 'Expense updated successfully!',
  DELETE_SUCCESS: 'Expense deleted successfully!',
  REFRESH_SUCCESS: 'Expenses refreshed.',
  REFRESH_APPLIED: 'Recurring entries applied and list refreshed.',

  // Error
  ADD_FAILED: 'Failed to add expense. Please try again.',
  UPDATE_FAILED: 'Failed to update entry. Please try again.',
  DELETE_FAILED: 'Failed to delete expense. Please try again.',
  FETCH_FAILED: 'Failed to load expenses. Please try again.',
  REFRESH_FAILED: 'Failed to refresh expenses. Please try again.',

  // Entry Edit
  ENTRY_UPDATE_SUCCESS: 'Entry updated successfully!',
  ENTRY_UPDATE_FAILED: 'Failed to update entry.',
  ENTRY_TITLE_REQUIRED: 'Title is required.',
  ENTRY_AMOUNT_INVALID: 'Enter a valid amount greater than 0.',
  ENTRY_SHARE_UNAVAILABLE: 'Sharing is not available on this device.',
  ENTRY_DOWNLOAD_FAILED: 'Could not download file. The file may no longer be available.',

  // Validation
  TITLE_REQUIRED: 'Expense title is required.',
  AMOUNT_REQUIRED: 'Amount is required.',
  AMOUNT_INVALID: 'Please enter a valid amount.',
  AMOUNT_POSITIVE: 'Amount must be greater than 0.',
  ACCOUNT_REQUIRED: 'Please select an account.',
  ACCOUNT_MISSING: 'No accounts found. Please add an account first.',
  CATEGORY_REQUIRED: 'Please select a category.',
  DATE_REQUIRED: 'Date is required.',
  DATE_INVALID: 'Please enter a valid date.',
  DUE_DATE_REQUIRED: 'Please enter due date.',
  DUE_DATE_INVALID: 'Please enter due date in YYYY-MM-DD format.',
  DUE_ACCOUNT_REQUIRED: 'Please select account/person for due on account.',

  // Invoice
  INVOICE_PICK_FAILED: 'Could not pick file. Please try again.',
  INVOICE_SAVE_FAILED: 'Failed to save invoice file.',
  INVOICE_OPEN_FAILED: 'Cannot open this file.',

  // Recurring
  RECURRING_APPLIED: 'Recurring entries applied for this month.',
  RECURRING_ALREADY_APPLIED: 'All recurring entries already applied this month.',
  RECURRING_NONE: 'No recurring templates found.',
  RECURRING_FAILED: 'Failed to apply recurring entries.',

  // Info
  NO_EXPENSES: 'No expenses found. Start adding your expenses!',
  CONFIRM_DELETE: 'Are you sure you want to delete this expense?',
};
