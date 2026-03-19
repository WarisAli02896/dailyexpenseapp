import { getDBConnection } from './database';
import { formatDateForDB } from '../utils/dateUtils';
import { RECURRING_MESSAGES } from '../../messages/recurringMessages';

export const addOrUpdateTemplate = async ({ userId, type, entryType, title, amount, companyName, personId, sourceId }) => {
  try {
    const db = await getDBConnection();

    const existing = await db.getFirstAsync(
      `SELECT id FROM recurring_templates WHERE user_id = ? AND type = ? AND entry_type = ? AND LOWER(COALESCE(company_name, '')) = LOWER(?) AND COALESCE(person_id, 0) = ? AND COALESCE(source_id, 0) = ?`,
      [userId, type, entryType, companyName || '', personId || 0, sourceId || 0]
    );

    if (existing) {
      await db.runAsync(
        'UPDATE recurring_templates SET title = ?, amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title, amount, existing.id]
      );
      return { success: true, message: RECURRING_MESSAGES.TEMPLATE_UPDATED, data: { id: existing.id } };
    }

    const result = await db.runAsync(
      'INSERT INTO recurring_templates (user_id, type, entry_type, title, amount, company_name, person_id, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, type, entryType, title, amount, companyName || null, personId || null, sourceId || null]
    );
    return { success: true, message: RECURRING_MESSAGES.TEMPLATE_ADDED, data: { id: result.lastInsertRowId } };
  } catch (error) {
    console.error('Add/Update Template Error:', error);
    return { success: false, message: RECURRING_MESSAGES.SAVE_TEMPLATE_FAILED };
  }
};

export const getTemplates = async (userId) => {
  try {
    const db = await getDBConnection();
    const templates = await db.getAllAsync(
      'SELECT * FROM recurring_templates WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    );
    return { success: true, data: templates };
  } catch (error) {
    console.error('Get Templates Error:', error);
    return { success: false, data: [] };
  }
};

export const updateTemplate = async (templateId, fields) => {
  try {
    const db = await getDBConnection();
    const setClauses = ['updated_at = CURRENT_TIMESTAMP'];
    const values = [];

    if (fields.title !== undefined) { setClauses.push('title = ?'); values.push(fields.title); }
    if (fields.amount !== undefined) { setClauses.push('amount = ?'); values.push(fields.amount); }
    if (fields.companyName !== undefined) { setClauses.push('company_name = ?'); values.push(fields.companyName); }
    if (fields.personId !== undefined) { setClauses.push('person_id = ?'); values.push(fields.personId || null); }
    if (fields.sourceId !== undefined) { setClauses.push('source_id = ?'); values.push(fields.sourceId || null); }

    values.push(templateId);
    await db.runAsync(`UPDATE recurring_templates SET ${setClauses.join(', ')} WHERE id = ?`, values);
    return { success: true, message: RECURRING_MESSAGES.TEMPLATE_UPDATED };
  } catch (error) {
    console.error('Update Template Error:', error);
    return { success: false, message: RECURRING_MESSAGES.UPDATE_TEMPLATE_FAILED };
  }
};

export const applyRecurringEntries = async (userId, month, year) => {
  try {
    const db = await getDBConnection();
    const mm = String(month).padStart(2, '0');
    const yyyy = String(year);

    const templates = await db.getAllAsync(
      'SELECT * FROM recurring_templates WHERE user_id = ?',
      [userId]
    );

    if (!templates.length) {
      return { success: true, added: 0, message: RECURRING_MESSAGES.NO_TEMPLATES };
    }

    let added = 0;

    for (const tpl of templates) {
      const existing = await db.getFirstAsync(
        `SELECT id FROM entries
         WHERE user_id = ?
           AND type = ? AND entry_type = ?
           AND LOWER(title) = LOWER(?)
           AND COALESCE(person_id, 0) = ?
           AND COALESCE(source_id, 0) = ?
           AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
         LIMIT 1`,
        [userId, tpl.type, tpl.entry_type, tpl.title, tpl.person_id || 0, tpl.source_id || 0, mm, yyyy]
      );

      if (existing) continue;

      const dateStr = formatDateForDB(new Date(year, month - 1, 1));
      await db.runAsync(
        `INSERT INTO entries (user_id, type, entry_type, title, amount, company_name, person_id, source_id, date, is_recurring)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [userId, tpl.type, tpl.entry_type, tpl.title, tpl.amount, tpl.company_name || null, tpl.person_id || null, tpl.source_id || null, dateStr]
      );
      added++;
    }

    if (added === 0) {
      return { success: true, added: 0, message: RECURRING_MESSAGES.ALREADY_APPLIED };
    }
    return { success: true, added, message: RECURRING_MESSAGES.ENTRY_COUNT_ADDED(added) };
  } catch (error) {
    console.error('Apply Recurring Error:', error);
    return { success: false, added: 0, message: RECURRING_MESSAGES.APPLY_FAILED };
  }
};

export const deleteTemplate = async (templateId) => {
  try {
    const db = await getDBConnection();
    await db.runAsync('DELETE FROM recurring_templates WHERE id = ?', [templateId]);
    return { success: true, message: RECURRING_MESSAGES.TEMPLATE_DELETED };
  } catch (error) {
    console.error('Delete Template Error:', error);
    return { success: false, message: RECURRING_MESSAGES.DELETE_TEMPLATE_FAILED };
  }
};
