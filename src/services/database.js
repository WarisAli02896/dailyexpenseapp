import * as SQLite from 'expo-sqlite';

const DB_NAME = 'dailyexpense.db';
const DB_VERSION = 15;

let db = null;

export const getDBConnection = async () => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await enableWAL(db);
  return db;
};

const enableWAL = async (database) => {
  try {
    await database.execAsync('PRAGMA journal_mode = WAL;');
  } catch (error) {
    // WAL is not supported in some environments (for example web), continue with default mode.
    console.warn('WAL mode unavailable, using default journal mode:', error?.message || error);
  }
};

export const initializeDatabase = async () => {
  const database = await getDBConnection();

  const versionResult = await database.getFirstAsync('PRAGMA user_version');
  const currentVersion = versionResult?.user_version ?? 0;

  if (currentVersion < DB_VERSION) {
    // Reset schema safely during version upgrades.
    await database.execAsync('PRAGMA foreign_keys = OFF;');
    await database.execAsync('DROP TABLE IF EXISTS expenses');
    await database.execAsync('DROP TABLE IF EXISTS entries');
    await database.execAsync('DROP TABLE IF EXISTS budgets');
    await database.execAsync('DROP TABLE IF EXISTS recurring_templates');
    await database.execAsync('DROP TABLE IF EXISTS categories');
    await database.execAsync('DROP TABLE IF EXISTS persons');
    await database.execAsync('DROP TABLE IF EXISTS sources');
    await database.execAsync('DROP TABLE IF EXISTS users');
    await database.execAsync(`PRAGMA user_version = ${DB_VERSION}`);
    await database.execAsync('PRAGMA foreign_keys = ON;');
  }

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      pin TEXT NOT NULL,
      currency TEXT DEFAULT 'PKR',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT,
      color TEXT,
      is_default INTEGER DEFAULT 0
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('earning', 'spending')),
      entry_type TEXT NOT NULL,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      company_name TEXT,
      category_id INTEGER,
      date TEXT NOT NULL,
      due_date TEXT,
      due_to_person_id INTEGER,
      repayment_for_entry_id INTEGER,
      is_due_on_account INTEGER DEFAULT 0,
      notes TEXT,
      is_recurring INTEGER DEFAULT 0,
      invoice_uri TEXT,
      invoice_type TEXT,
      invoice_uri_2 TEXT,
      invoice_type_2 TEXT,
      person_id INTEGER,
      source_id INTEGER,
      show_in_account INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (person_id) REFERENCES persons(id),
      FOREIGN KEY (source_id) REFERENCES sources(id)
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category_id INTEGER,
      amount REAL NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      is_locked INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      is_locked INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, name)
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS recurring_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('earning', 'spending')),
      entry_type TEXT NOT NULL,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      company_name TEXT,
      person_id INTEGER,
      source_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (person_id) REFERENCES persons(id),
      FOREIGN KEY (source_id) REFERENCES sources(id)
    );
  `);

  await ensureEntriesDueDateColumn(database);
  await ensureEntriesDueToPersonColumn(database);
  await ensureEntriesRepaymentRefColumn(database);
  await ensureEntriesDueOnAccountColumn(database);
  await seedDefaultCategories(database);

  return database;
};

const ensureEntriesDueDateColumn = async (database) => {
  const columns = await database.getAllAsync(`PRAGMA table_info(entries)`);
  const hasDueDate = columns.some((column) => column.name === 'due_date');
  if (!hasDueDate) {
    await database.execAsync('ALTER TABLE entries ADD COLUMN due_date TEXT');
  }
};

const ensureEntriesDueOnAccountColumn = async (database) => {
  const columns = await database.getAllAsync(`PRAGMA table_info(entries)`);
  const hasDueOnAccount = columns.some((column) => column.name === 'is_due_on_account');
  if (!hasDueOnAccount) {
    await database.execAsync('ALTER TABLE entries ADD COLUMN is_due_on_account INTEGER DEFAULT 0');
  }
};

const ensureEntriesDueToPersonColumn = async (database) => {
  const columns = await database.getAllAsync(`PRAGMA table_info(entries)`);
  const hasDueToPerson = columns.some((column) => column.name === 'due_to_person_id');
  if (!hasDueToPerson) {
    await database.execAsync('ALTER TABLE entries ADD COLUMN due_to_person_id INTEGER');
  }
};

const ensureEntriesRepaymentRefColumn = async (database) => {
  const columns = await database.getAllAsync(`PRAGMA table_info(entries)`);
  const hasRepaymentRef = columns.some((column) => column.name === 'repayment_for_entry_id');
  if (!hasRepaymentRef) {
    await database.execAsync('ALTER TABLE entries ADD COLUMN repayment_for_entry_id INTEGER');
  }
};

const seedDefaultCategories = async (database) => {
  const result = await database.getFirstAsync('SELECT COUNT(*) as count FROM categories');
  if (result.count > 0) return;

  const defaultCategories = [
    { name: 'Food & Dining', icon: 'fast-food', color: '#FF6B6B' },
    { name: 'Transport', icon: 'car', color: '#4ECDC4' },
    { name: 'Shopping', icon: 'cart', color: '#45B7D1' },
    { name: 'Entertainment', icon: 'game-controller', color: '#FFEAA7' },
    { name: 'Health', icon: 'medkit', color: '#DDA0DD' },
    { name: 'Education', icon: 'book', color: '#98D8C8' },
    { name: 'Groceries', icon: 'basket', color: '#F7DC6F' },
    { name: 'Rent', icon: 'home', color: '#BB8FCE' },
    { name: 'Other', icon: 'ellipsis-horizontal', color: '#AEB6BF' },
  ];

  for (const cat of defaultCategories) {
    await database.runAsync(
      'INSERT INTO categories (name, icon, color, is_default) VALUES (?, ?, ?, 1)',
      [cat.name, cat.icon, cat.color]
    );
  }
};

export const hasUsers = async () => {
  const database = await getDBConnection();
  const result = await database.getFirstAsync('SELECT COUNT(*) as count FROM users');
  return result.count > 0;
};

export const closeDatabase = async () => {
  if (db) {
    await db.closeAsync();
    db = null;
  }
};
