import { getDBConnection } from './database';
import { formatDateForDB } from '../utils/dateUtils';
import { ENTRY_MESSAGES } from '../../messages/entryMessages';

const buildPeriodFilter = (dateExpression, month, year) => {
  const mm = String(month).padStart(2, '0');
  const yyyy = String(year);
  // Always cumulative by month: include selected month and all previous months.
  return {
    clause: `strftime('%Y-%m', ${dateExpression}) <= ?`,
    params: [`${yyyy}-${mm}`],
  };
};

const buildScopeFilter = (dateExpression, scope, month, year) => {
  if (scope === 'all') {
    return { clause: '1=1', params: [] };
  }
  if (scope === 'year') {
    return { clause: `strftime('%Y', ${dateExpression}) = ?`, params: [String(year)] };
  }
  return buildPeriodFilter(dateExpression, month, year);
};

export const addEntry = async ({ userId, type, entryType, title, amount, companyName, categoryId, date, dueDate, dueToPersonId, isDueOnAccount, notes, isRecurring, invoiceUri, invoiceType, invoiceUri2, invoiceType2, personId, sourceId, showInAccount }) => {
  try {
    const db = await getDBConnection();
    const dateStr = date || formatDateForDB(new Date());
    const showFlag = showInAccount === undefined ? 1 : (showInAccount ? 1 : 0);

    const result = await db.runAsync(
      `INSERT INTO entries (user_id, type, entry_type, title, amount, company_name, category_id, date, due_date, due_to_person_id, is_due_on_account, notes, is_recurring, invoice_uri, invoice_type, invoice_uri_2, invoice_type_2, person_id, source_id, show_in_account)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, type, entryType, title, amount, companyName || null, categoryId || null, dateStr, dueDate || null, dueToPersonId || null, isDueOnAccount ? 1 : 0, notes || null, isRecurring ? 1 : 0, invoiceUri || null, invoiceType || null, invoiceUri2 || null, invoiceType2 || null, personId || null, sourceId || null, showFlag]
    );

    return { success: true, message: ENTRY_MESSAGES.ADD_SUCCESS, data: { id: result.lastInsertRowId } };
  } catch (error) {
    console.error('Add Entry Error:', error);
    return { success: false, message: ENTRY_MESSAGES.ADD_FAILED };
  }
};

export const getEntriesByMonth = async (userId, month, year) => {
  try {
    const db = await getDBConnection();
    const effectiveDateExpr = `CASE WHEN e.type = 'spending' AND e.due_date IS NOT NULL THEN e.due_date ELSE e.date END`;
    const periodFilter = buildPeriodFilter(effectiveDateExpr, month, year);

    const entries = await db.getAllAsync(
      `SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color, p.name as person_name, s.name as source_name
       FROM entries e
       LEFT JOIN categories c ON e.category_id = c.id
       LEFT JOIN persons p ON e.person_id = p.id
       LEFT JOIN sources s ON e.source_id = s.id
       WHERE e.user_id = ?
         AND ${periodFilter.clause}
       ORDER BY CASE WHEN e.type = 'spending' AND e.due_date IS NOT NULL THEN e.due_date ELSE e.date END DESC, e.created_at DESC`,
      [userId, ...periodFilter.params]
    );

    return { success: true, data: entries };
  } catch (error) {
    console.error('Get Entries Error:', error);
    return { success: false, data: [] };
  }
};

export const getEntriesByType = async (userId, type, month, year) => {
  try {
    const db = await getDBConnection();
    const effectiveDateExpr = `CASE WHEN e.type = 'spending' AND e.due_date IS NOT NULL THEN e.due_date ELSE e.date END`;
    const periodFilter = buildPeriodFilter(effectiveDateExpr, month, year);

    const entries = await db.getAllAsync(
      `SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color, p.name as person_name, s.name as source_name
       FROM entries e
       LEFT JOIN categories c ON e.category_id = c.id
       LEFT JOIN persons p ON e.person_id = p.id
       LEFT JOIN sources s ON e.source_id = s.id
       WHERE e.user_id = ? AND e.type = ?
         AND ${periodFilter.clause}
       ORDER BY CASE WHEN e.type = 'spending' AND e.due_date IS NOT NULL THEN e.due_date ELSE e.date END DESC, e.created_at DESC`,
      [userId, type, ...periodFilter.params]
    );

    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    return { success: true, data: entries, total };
  } catch (error) {
    console.error('Get Entries By Type Error:', error);
    return { success: false, data: [], total: 0 };
  }
};

export const getDueAccountEntries = async (userId) => {
  try {
    const db = await getDBConnection();
    const entries = await db.getAllAsync(
      `SELECT e.*, p_from.name as from_person_name, p_to.name as person_name, p_to.name as due_to_person_name
       FROM entries e
       LEFT JOIN persons p_from ON e.person_id = p_from.id
       LEFT JOIN persons p_to ON e.due_to_person_id = p_to.id
       WHERE e.user_id = ?
         AND e.entry_type IN ('due', 'repayment')
         AND e.due_to_person_id IS NOT NULL
       ORDER BY COALESCE(e.due_date, e.date) DESC, e.created_at DESC`,
      [userId]
    );

    const total = entries.reduce((sum, e) => {
      const amt = Number(e.amount || 0);
      if (e.entry_type === 'repayment') return sum - amt;
      return sum + amt;
    }, 0);
    return { success: true, data: entries, total };
  } catch (error) {
    console.error('Get Due Account Entries Error:', error);
    return { success: false, data: [], total: 0 };
  }
};

export const getDueAccountTotals = async (userId) => {
  try {
    const db = await getDBConnection();
    const rows = await db.getAllAsync(
      `SELECT
         p_to.id as person_id,
         p_to.name as person_name,
         COALESCE(SUM(CASE
           WHEN e.entry_type = 'due' THEN e.amount
           WHEN e.entry_type = 'repayment' THEN -e.amount
           ELSE 0
         END), 0) as total_due,
         SUM(CASE WHEN e.entry_type = 'due' THEN 1 ELSE 0 END) as due_count,
         SUM(CASE WHEN e.entry_type = 'repayment' THEN 1 ELSE 0 END) as repaid_count
       FROM entries e
       JOIN persons p_to ON e.due_to_person_id = p_to.id
       WHERE e.user_id = ?
         AND e.entry_type IN ('due', 'repayment')
       GROUP BY p_to.id, p_to.name
       ORDER BY total_due DESC, p_to.name ASC`,
      [userId]
    );
    return { success: true, data: rows };
  } catch (error) {
    console.error('Get Due Account Totals Error:', error);
    return { success: false, data: [] };
  }
};

export const repayDueEntry = async ({ userId, dueEntryId }) => {
  try {
    const db = await getDBConnection();
    const dueEntry = await db.getFirstAsync(
      `SELECT e.id, e.title, e.amount, e.notes, e.person_id, e.due_to_person_id,
              p_to.name as due_to_person_name, p_from.name as from_person_name
       FROM entries e
       LEFT JOIN persons p_from ON e.person_id = p_from.id
       LEFT JOIN persons p_to ON e.due_to_person_id = p_to.id
       WHERE e.id = ? AND e.user_id = ? AND e.type = 'spending' AND e.entry_type = 'due' AND e.is_due_on_account = 1`,
      [dueEntryId, userId]
    );

    if (!dueEntry) {
      return { success: false, message: ENTRY_MESSAGES.UPDATE_FAILED };
    }

    const dateStr = formatDateForDB(new Date());
    const repaymentAmount = Number(dueEntry.amount || 0);
    const repaymentTitle = `Repaid from ${dueEntry.due_to_person_name || 'Account'}`;
    const repaymentDebitTitle = `Repayment paid to ${dueEntry.from_person_name || 'Account'}`;
    const repaymentNotes = dueEntry.notes
      ? `Repayment for due entry: ${dueEntry.notes}`
      : 'Repayment for due-on-account entry';
    const updatedDueNotes = dueEntry.notes
      ? `${dueEntry.notes} | Repaid on ${dateStr}`
      : `Repaid on ${dateStr}`;

    await db.execAsync('BEGIN TRANSACTION');

    await db.runAsync(
      `INSERT INTO entries (user_id, type, entry_type, title, amount, date, notes, person_id, due_to_person_id, repayment_for_entry_id, show_in_account, is_due_on_account)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        'earning',
        'repayment',
        repaymentTitle,
        repaymentAmount,
        dateStr,
        repaymentNotes,
        dueEntry.person_id || null,
        dueEntry.due_to_person_id || null,
        dueEntry.id,
        1,
        0,
      ]
    );

    // Mirror the repayment on borrower side so account balances stay consistent.
    await db.runAsync(
      `INSERT INTO entries (user_id, type, entry_type, title, amount, date, notes, person_id, due_to_person_id, repayment_for_entry_id, show_in_account, is_due_on_account)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        'spending',
        'repayment',
        repaymentDebitTitle,
        repaymentAmount,
        dateStr,
        repaymentNotes,
        dueEntry.due_to_person_id || null,
        null,
        dueEntry.id,
        1,
        0,
      ]
    );

    await db.runAsync(
      `UPDATE entries
       SET is_due_on_account = 0,
           notes = ?
       WHERE id = ?`,
      [updatedDueNotes, dueEntryId]
    );

    await db.execAsync('COMMIT');
    return { success: true, message: ENTRY_MESSAGES.UPDATE_SUCCESS };
  } catch (error) {
    try {
      const db = await getDBConnection();
      await db.execAsync('ROLLBACK');
    } catch {
      // Ignore rollback failure.
    }
    console.error('Repay Due Entry Error:', error);
    return { success: false, message: ENTRY_MESSAGES.UPDATE_FAILED };
  }
};

export const getEntriesByEntryType = async (userId, entryType, month, year) => {
  try {
    const db = await getDBConnection();
    const effectiveDateExpr = `CASE WHEN e.type = 'spending' AND e.due_date IS NOT NULL THEN e.due_date ELSE e.date END`;
    const periodFilter = buildPeriodFilter(effectiveDateExpr, month, year);

    const entries = await db.getAllAsync(
      `SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color, p.name as person_name, s.name as source_name
       FROM entries e
       LEFT JOIN categories c ON e.category_id = c.id
       LEFT JOIN persons p ON e.person_id = p.id
       LEFT JOIN sources s ON e.source_id = s.id
       WHERE e.user_id = ? AND e.entry_type = ?
         AND ${periodFilter.clause}
       ORDER BY CASE WHEN e.type = 'spending' AND e.due_date IS NOT NULL THEN e.due_date ELSE e.date END DESC, e.created_at DESC`,
      [userId, entryType, ...periodFilter.params]
    );

    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    return { success: true, data: entries, total };
  } catch (error) {
    console.error('Get Entries By Entry Type Error:', error);
    return { success: false, data: [], total: 0 };
  }
};

export const getMonthSummary = async (userId, month, year) => {
  try {
    const db = await getDBConnection();
    const earningsPeriodFilter = buildPeriodFilter('date', month, year);
    const spendingPeriodFilter = buildPeriodFilter(`CASE WHEN due_date IS NOT NULL THEN due_date ELSE date END`, month, year);

    const earnings = await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount), 0) as total FROM entries
       WHERE user_id = ? AND type = 'earning' AND ${earningsPeriodFilter.clause}`,
      [userId, ...earningsPeriodFilter.params]
    );

    const spendings = await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount), 0) as total FROM entries
       WHERE user_id = ? AND type = 'spending'
         AND ${spendingPeriodFilter.clause}`,
      [userId, ...spendingPeriodFilter.params]
    );

    return {
      success: true,
      data: {
        totalEarnings: earnings.total,
        totalSpendings: spendings.total,
        amountLeft: earnings.total - spendings.total,
      },
    };
  } catch (error) {
    console.error('Get Summary Error:', error);
    return { success: false, data: { totalEarnings: 0, totalSpendings: 0, amountLeft: 0 } };
  }
};

export const getEntriesForHome = async ({ userId, scope = 'month', month, year }) => {
  try {
    const db = await getDBConnection();
    const effectiveDateExpr = `CASE WHEN e.type = 'spending' AND e.due_date IS NOT NULL THEN e.due_date ELSE e.date END`;
    const scopeFilter = buildScopeFilter(effectiveDateExpr, scope, month, year);

    const entries = await db.getAllAsync(
      `SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color, p.name as person_name, s.name as source_name
       FROM entries e
       LEFT JOIN categories c ON e.category_id = c.id
       LEFT JOIN persons p ON e.person_id = p.id
       LEFT JOIN sources s ON e.source_id = s.id
       WHERE e.user_id = ?
         AND ${scopeFilter.clause}
       ORDER BY ${effectiveDateExpr} DESC, e.created_at DESC`,
      [userId, ...scopeFilter.params]
    );

    return { success: true, data: entries };
  } catch (error) {
    console.error('Get Home Entries Error:', error);
    return { success: false, data: [] };
  }
};

export const getSummaryForHome = async ({ userId, scope = 'month', month, year }) => {
  try {
    const db = await getDBConnection();
    const earningFilter = buildScopeFilter('date', scope, month, year);
    const spendingFilter = buildScopeFilter(`CASE WHEN due_date IS NOT NULL THEN due_date ELSE date END`, scope, month, year);

    const earnings = await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM entries
       WHERE user_id = ? AND type = 'earning' AND ${earningFilter.clause}`,
      [userId, ...earningFilter.params]
    );

    const spendings = await db.getFirstAsync(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM entries
       WHERE user_id = ? AND type = 'spending' AND ${spendingFilter.clause}`,
      [userId, ...spendingFilter.params]
    );

    return {
      success: true,
      data: {
        totalEarnings: earnings.total,
        totalSpendings: spendings.total,
        amountLeft: earnings.total - spendings.total,
      },
    };
  } catch (error) {
    console.error('Get Home Summary Error:', error);
    return { success: false, data: { totalEarnings: 0, totalSpendings: 0, amountLeft: 0 } };
  }
};

export const updateEntry = async (entryId, fields) => {
  try {
    const db = await getDBConnection();
    const setClauses = [];
    const values = [];

    if (fields.type !== undefined) { setClauses.push('type = ?'); values.push(fields.type); }
    if (fields.entryType !== undefined) { setClauses.push('entry_type = ?'); values.push(fields.entryType); }
    if (fields.title !== undefined) { setClauses.push('title = ?'); values.push(fields.title); }
    if (fields.amount !== undefined) { setClauses.push('amount = ?'); values.push(fields.amount); }
    if (fields.companyName !== undefined) { setClauses.push('company_name = ?'); values.push(fields.companyName || null); }
    if (fields.notes !== undefined) { setClauses.push('notes = ?'); values.push(fields.notes || null); }
    if (fields.dueDate !== undefined) { setClauses.push('due_date = ?'); values.push(fields.dueDate || null); }
    if (fields.isRecurring !== undefined) { setClauses.push('is_recurring = ?'); values.push(fields.isRecurring ? 1 : 0); }
    if (fields.invoiceUri !== undefined) { setClauses.push('invoice_uri = ?'); values.push(fields.invoiceUri || null); }
    if (fields.invoiceType !== undefined) { setClauses.push('invoice_type = ?'); values.push(fields.invoiceType || null); }
    if (fields.invoiceUri2 !== undefined) { setClauses.push('invoice_uri_2 = ?'); values.push(fields.invoiceUri2 || null); }
    if (fields.invoiceType2 !== undefined) { setClauses.push('invoice_type_2 = ?'); values.push(fields.invoiceType2 || null); }
    if (fields.sourceId !== undefined) { setClauses.push('source_id = ?'); values.push(fields.sourceId || null); }
    if (fields.showInAccount !== undefined) { setClauses.push('show_in_account = ?'); values.push(fields.showInAccount ? 1 : 0); }

    if (setClauses.length === 0) {
      return { success: false, message: ENTRY_MESSAGES.NO_FIELDS_TO_UPDATE };
    }

    values.push(entryId);
    await db.runAsync(`UPDATE entries SET ${setClauses.join(', ')} WHERE id = ?`, values);

    const updated = await db.getFirstAsync(
      `SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color, p.name as person_name, s.name as source_name
       FROM entries e
       LEFT JOIN categories c ON e.category_id = c.id
       LEFT JOIN persons p ON e.person_id = p.id
       LEFT JOIN sources s ON e.source_id = s.id
       WHERE e.id = ?`,
      [entryId]
    );

    return { success: true, message: ENTRY_MESSAGES.UPDATE_SUCCESS, data: updated };
  } catch (error) {
    console.error('Update Entry Error:', error);
    return { success: false, message: ENTRY_MESSAGES.UPDATE_FAILED };
  }
};

export const transferBetweenAccounts = async ({
  userId,
  fromPersonId,
  toPersonId,
  amount,
  sourceId,
  note,
  date,
  invoiceUri,
  invoiceType,
}) => {
  try {
    const db = await getDBConnection();
    const dateStr = date || formatDateForDB(new Date());
    const transferAmount = Number(amount);

    const [fromAccount, toAccount] = await Promise.all([
      db.getFirstAsync('SELECT id, name FROM persons WHERE id = ? AND user_id = ?', [fromPersonId, userId]),
      db.getFirstAsync('SELECT id, name FROM persons WHERE id = ? AND user_id = ?', [toPersonId, userId]),
    ]);

    if (!fromAccount || !toAccount) {
      return { success: false, message: ENTRY_MESSAGES.ADD_FAILED };
    }

    await db.execAsync('BEGIN TRANSACTION');

    await db.runAsync(
      `INSERT INTO entries (user_id, type, entry_type, title, amount, date, notes, person_id, source_id, show_in_account, invoice_uri, invoice_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        'spending',
        'transfer',
        `Transfer to ${toAccount.name}`,
        transferAmount,
        dateStr,
        note || null,
        fromPersonId,
        sourceId || null,
        1,
        invoiceUri || null,
        invoiceType || null,
      ]
    );

    await db.runAsync(
      `INSERT INTO entries (user_id, type, entry_type, title, amount, date, notes, person_id, source_id, show_in_account, invoice_uri, invoice_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        'earning',
        'transfer',
        `Transfer from ${fromAccount.name}`,
        transferAmount,
        dateStr,
        note || null,
        toPersonId,
        sourceId || null,
        1,
        invoiceUri || null,
        invoiceType || null,
      ]
    );

    await db.execAsync('COMMIT');
    return { success: true, message: ENTRY_MESSAGES.ADD_SUCCESS };
  } catch (error) {
    try {
      const db = await getDBConnection();
      await db.execAsync('ROLLBACK');
    } catch {
      // Ignore rollback failure.
    }
    console.error('Transfer Between Accounts Error:', error);
    return { success: false, message: ENTRY_MESSAGES.ADD_FAILED };
  }
};

export const deleteEntry = async (entryId) => {
  try {
    const db = await getDBConnection();
    const targetEntry = await db.getFirstAsync(
      `SELECT id, entry_type, repayment_for_entry_id
       FROM entries
       WHERE id = ?`,
      [entryId]
    );

    if (!targetEntry) {
      return { success: true, message: ENTRY_MESSAGES.DELETE_SUCCESS };
    }

    await db.execAsync('BEGIN TRANSACTION');

    if (targetEntry.entry_type === 'due') {
      await db.runAsync(
        `DELETE FROM entries
         WHERE repayment_for_entry_id = ?
           AND entry_type = 'repayment'`,
        [targetEntry.id]
      );
      await db.runAsync('DELETE FROM entries WHERE id = ?', [targetEntry.id]);
    } else if (targetEntry.entry_type === 'repayment' && targetEntry.repayment_for_entry_id) {
      await db.runAsync(
        `DELETE FROM entries
         WHERE repayment_for_entry_id = ?
           AND entry_type = 'repayment'`,
        [targetEntry.repayment_for_entry_id]
      );
    } else {
      await db.runAsync('DELETE FROM entries WHERE id = ?', [targetEntry.id]);
    }

    await db.execAsync('COMMIT');
    return { success: true, message: ENTRY_MESSAGES.DELETE_SUCCESS };
  } catch (error) {
    try {
      const db = await getDBConnection();
      await db.execAsync('ROLLBACK');
    } catch {
      // Ignore rollback failure.
    }
    console.error('Delete Entry Error:', error);
    return { success: false, message: ENTRY_MESSAGES.DELETE_FAILED };
  }
};
