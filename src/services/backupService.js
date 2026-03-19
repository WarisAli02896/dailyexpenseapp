import { getDBConnection } from './database';
import { saveUserSession } from './storageService';
import { BACKUP_MESSAGES } from '../../messages/backupMessages';

const BACKUP_SCHEMA_VERSION = 2;

const parseArray = (value) => (Array.isArray(value) ? value : []);
const isValidPin = (pin) => /^\d{6}$/.test(String(pin || ''));

const restorePayloadToUser = async (db, userId, payload) => {
  const persons = parseArray(payload.persons);
  const sources = parseArray(payload.sources);
  const entries = parseArray(payload.entries);
  const budgets = parseArray(payload.budgets);
  const recurringTemplates = parseArray(payload.recurringTemplates);
  const personIdMap = new Map();
  const sourceIdMap = new Map();

  await db.runAsync('DELETE FROM entries WHERE user_id = ?', [userId]);
  await db.runAsync('DELETE FROM budgets WHERE user_id = ?', [userId]);
  await db.runAsync('DELETE FROM recurring_templates WHERE user_id = ?', [userId]);
  await db.runAsync('DELETE FROM persons WHERE user_id = ?', [userId]);
  await db.runAsync('DELETE FROM sources WHERE user_id = ?', [userId]);

  for (const person of persons) {
    const result = await db.runAsync(
      `INSERT INTO persons (user_id, name, is_default, is_locked, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        person.name,
        Number(person.is_default || 0),
        Number(person.is_locked || 0),
        Number(person.is_active || 0),
        person.created_at || new Date().toISOString(),
      ]
    );
    personIdMap.set(person.id, result.lastInsertRowId);
  }

  if (persons.length === 0) {
    await db.runAsync(
      `INSERT INTO persons (user_id, name, is_default, is_locked, is_active, created_at)
       VALUES (?, ?, 1, 1, 1, ?)`,
      [userId, payload.user?.username || 'Main Account', new Date().toISOString()]
    );
  }

  for (const source of sources) {
    const result = await db.runAsync(
      `INSERT INTO sources (user_id, name, is_default, is_locked, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        source.name,
        Number(source.is_default || 0),
        Number(source.is_locked || 0),
        Number(source.is_active || 0),
        source.created_at || new Date().toISOString(),
      ]
    );
    sourceIdMap.set(source.id, result.lastInsertRowId);
  }

  for (const entry of entries) {
    await db.runAsync(
      `INSERT INTO entries (
        user_id, type, entry_type, title, amount, company_name, category_id, date, notes,
        is_recurring, invoice_uri, invoice_type, invoice_uri_2, invoice_type_2, person_id, source_id,
        show_in_account, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        entry.type,
        entry.entry_type,
        entry.title,
        entry.amount,
        entry.company_name ?? null,
        entry.category_id ?? null,
        entry.date,
        entry.notes ?? null,
        Number(entry.is_recurring || 0),
        entry.invoice_uri ?? null,
        entry.invoice_type ?? null,
        entry.invoice_uri_2 ?? null,
        entry.invoice_type_2 ?? null,
        personIdMap.get(entry.person_id) ?? null,
        sourceIdMap.get(entry.source_id) ?? null,
        Number(entry.show_in_account ?? 1),
        entry.created_at || new Date().toISOString(),
      ]
    );
  }

  for (const budget of budgets) {
    await db.runAsync(
      `INSERT INTO budgets (user_id, category_id, amount, month, year, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        budget.category_id ?? null,
        budget.amount,
        budget.month,
        budget.year,
        budget.created_at || new Date().toISOString(),
      ]
    );
  }

  for (const template of recurringTemplates) {
    await db.runAsync(
      `INSERT INTO recurring_templates (
        user_id, type, entry_type, title, amount, company_name, person_id, created_at, updated_at
        , source_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        template.type,
        template.entry_type,
        template.title,
        template.amount,
        template.company_name ?? null,
        personIdMap.get(template.person_id) ?? null,
        template.created_at || new Date().toISOString(),
        template.updated_at || new Date().toISOString(),
        sourceIdMap.get(template.source_id) ?? null,
      ]
    );
  }

  return {
    persons: persons.length,
    sources: sources.length,
    entries: entries.length,
    budgets: budgets.length,
    recurringTemplates: recurringTemplates.length,
  };
};

export const exportUserBackup = async (userId) => {
  try {
    const db = await getDBConnection();
    const user = await db.getFirstAsync(
      'SELECT username, currency, pin FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return { success: false, message: BACKUP_MESSAGES.USER_NOT_FOUND };
    }

    const persons = await db.getAllAsync(
      `SELECT id, name, is_default, is_locked, is_active, created_at
       FROM persons
       WHERE user_id = ?
       ORDER BY id ASC`,
      [userId]
    );

    const sources = await db.getAllAsync(
      `SELECT id, name, is_default, is_locked, is_active, created_at
       FROM sources
       WHERE user_id = ?
       ORDER BY id ASC`,
      [userId]
    );

    const entries = await db.getAllAsync(
      `SELECT id, type, entry_type, title, amount, company_name, category_id, date, notes,
              is_recurring, invoice_uri, invoice_type, invoice_uri_2, invoice_type_2,
              person_id, source_id, show_in_account, created_at
       FROM entries
       WHERE user_id = ?
       ORDER BY id ASC`,
      [userId]
    );

    const budgets = await db.getAllAsync(
      `SELECT id, category_id, amount, month, year, created_at
       FROM budgets
       WHERE user_id = ?
       ORDER BY id ASC`,
      [userId]
    );

    const recurringTemplates = await db.getAllAsync(
      `SELECT id, type, entry_type, title, amount, company_name, person_id, source_id, created_at, updated_at
       FROM recurring_templates
       WHERE user_id = ?
       ORDER BY id ASC`,
      [userId]
    );

    return {
      success: true,
      data: {
        meta: {
          schemaVersion: BACKUP_SCHEMA_VERSION,
          createdAt: new Date().toISOString(),
        },
        user: {
          username: user.username,
          currency: user.currency,
          pin: user.pin,
        },
        persons,
        sources,
        entries,
        budgets,
        recurringTemplates,
      },
    };
  } catch (error) {
    console.error('Export Backup Error:', error);
    return { success: false, message: BACKUP_MESSAGES.EXPORT_FAILED };
  }
};

export const restoreUserBackup = async (userId, backupData) => {
  const payload = backupData || {};

  try {
    const db = await getDBConnection();

    await db.execAsync('BEGIN TRANSACTION;');
    const stats = await restorePayloadToUser(db, userId, payload);

    if (payload.user?.username || payload.user?.currency) {
      const currentUser = await db.getFirstAsync(
        'SELECT username, currency FROM users WHERE id = ?',
        [userId]
      );
      await db.runAsync(
        'UPDATE users SET username = ?, currency = ? WHERE id = ?',
        [
          payload.user?.username || currentUser?.username || 'User',
          payload.user?.currency || currentUser?.currency || 'PKR',
          userId,
        ]
      );
    }

    await db.execAsync('COMMIT;');

    const updatedUser = await db.getFirstAsync(
      'SELECT id, username, currency FROM users WHERE id = ?',
      [userId]
    );
    await saveUserSession(updatedUser);

    return {
      success: true,
      data: {
        user: updatedUser,
        ...stats,
      },
    };
  } catch (error) {
    try {
      const db = await getDBConnection();
      await db.execAsync('ROLLBACK;');
    } catch (rollbackError) {
      console.error('Rollback Error:', rollbackError);
    }

    console.error('Restore Backup Error:', error);
    return { success: false, message: BACKUP_MESSAGES.RESTORE_DATA_FAILED };
  }
};

export const restoreBackupAsNewUser = async (backupData) => {
  const payload = backupData || {};
  const username = String(payload.user?.username || '').trim();
  const currency = String(payload.user?.currency || 'PKR');
  const pin = String(payload.user?.pin || '').trim();

  if (!username) {
    return { success: false, message: BACKUP_MESSAGES.BACKUP_USER_MISSING };
  }

  if (!isValidPin(pin)) {
    return {
      success: false,
      message: BACKUP_MESSAGES.RESTORE_OLD_FORMAT,
    };
  }

  try {
    const db = await getDBConnection();
    const existing = await db.getFirstAsync(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?)',
      [username]
    );

    if (existing) {
      return { success: false, message: BACKUP_MESSAGES.RESTORE_USER_EXISTS };
    }

    await db.execAsync('BEGIN TRANSACTION;');

    const insertResult = await db.runAsync(
      'INSERT INTO users (username, pin, currency) VALUES (?, ?, ?)',
      [username, pin, currency]
    );
    const newUserId = insertResult.lastInsertRowId;
    const stats = await restorePayloadToUser(db, newUserId, payload);

    await db.execAsync('COMMIT;');

    const user = await db.getFirstAsync(
      'SELECT id, username, currency FROM users WHERE id = ?',
      [newUserId]
    );
    await saveUserSession(user);

    return { success: true, data: { user, ...stats } };
  } catch (error) {
    try {
      const db = await getDBConnection();
      await db.execAsync('ROLLBACK;');
    } catch (rollbackError) {
      console.error('Rollback Error:', rollbackError);
    }
    console.error('Restore New User Backup Error:', error);
    return { success: false, message: BACKUP_MESSAGES.RESTORE_DATA_FAILED };
  }
};
