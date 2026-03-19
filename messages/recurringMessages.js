export const RECURRING_MESSAGES = {
  TEMPLATE_UPDATED: 'Template updated.',
  TEMPLATE_ADDED: 'Template added.',
  TEMPLATE_DELETED: 'Template deleted.',
  SAVE_TEMPLATE_FAILED: 'Failed to save recurring template.',
  UPDATE_TEMPLATE_FAILED: 'Failed to update template.',
  DELETE_TEMPLATE_FAILED: 'Failed to delete template.',
  NO_TEMPLATES: 'No recurring templates found.',
  ALREADY_APPLIED: 'All recurring entries already applied this month.',
  APPLY_FAILED: 'Failed to apply recurring entries.',
  TITLE_REQUIRED: 'Title is required.',
  AMOUNT_INVALID: 'Enter a valid amount.',
  ENTRY_COUNT_ADDED: (count) => `${count} recurring ${count === 1 ? 'entry' : 'entries'} added.`,
};
