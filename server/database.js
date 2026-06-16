import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isPostgres = !!process.env.DATABASE_URL;

let sqliteDb = null;
let pgPool = null;

if (isPostgres) {
  console.log('Initializing PostgreSQL pool for CRM...');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for platforms like Render/Heroku
    }
  });
  initDb();
} else {
  const dbPath = path.resolve(__dirname, 'crm.db');
  console.log('Initializing SQLite database at:', dbPath);
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err);
    } else {
      initDb();
    }
  });
}

// SQL Query translator from SQLite to PostgreSQL dialect
function translateSql(sql) {
  if (!isPostgres) return sql;

  let translated = sql;

  // Replace autoincrement type definition
  translated = translated.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
  
  // Replace datetime types
  translated = translated.replace(/DATETIME/gi, 'TIMESTAMP');

  // Convert ? placeholders to $1, $2, $3...
  let placeholderIndex = 1;
  translated = translated.replace(/\?/g, () => `$${placeholderIndex++}`);

  return translated;
}

// Helper functions to wrap database queries
export const dbQuery = async (sql, params = []) => {
  if (isPostgres) {
    const translatedSql = translateSql(sql);
    const result = await pgPool.query(translatedSql, params);
    return result.rows;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

export const dbGet = async (sql, params = []) => {
  if (isPostgres) {
    const translatedSql = translateSql(sql);
    const result = await pgPool.query(translatedSql, params);
    return result.rows[0];
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

export const dbRun = async (sql, params = []) => {
  if (isPostgres) {
    // Intercept sequence reset query from server.js
    if (sql.includes('sqlite_sequence')) {
      await pgPool.query('ALTER SEQUENCE clients_id_seq RESTART WITH 1');
      await pgPool.query('ALTER SEQUENCE notes_id_seq RESTART WITH 1');
      await pgPool.query('ALTER SEQUENCE tasks_id_seq RESTART WITH 1');
      await pgPool.query('ALTER SEQUENCE documents_id_seq RESTART WITH 1');
      return { id: 0, changes: 0 };
    }

    let translatedSql = translateSql(sql);
    
    // Add returning id to insert statements to get the last inserted ID
    if (translatedSql.trim().toUpperCase().startsWith('INSERT')) {
      translatedSql += ' RETURNING id';
    }

    const result = await pgPool.query(translatedSql, params);
    return {
      id: result.rows[0]?.id || null,
      changes: result.rowCount
    };
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
};

async function initDb() {
  try {
    // 1. Clients/Leads Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        company TEXT,
        email TEXT,
        phone TEXT,
        status TEXT NOT NULL DEFAULT 'lead',
        source TEXT,
        deal_value REAL DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Notes/Interactions Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'note',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
      )
    `);

    // 3. Tasks Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        due_date DATETIME,
        status TEXT NOT NULL DEFAULT 'pending',
        client_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE SET NULL
      )
    `);

    // 4. Documents Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
      )
    `);

    // Seed mock data if database is empty
    const row = await dbGet("SELECT COUNT(*) as count FROM clients");
    if (row && parseInt(row.count, 10) === 0) {
      console.log('Seeding initial CRM database records...');
      await seedMockData();
    }
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

async function seedMockData() {
  const sampleClients = [
    ['רוני לוי', 'טק-סולושנס', 'roni@tech-solutions.co.il', '054-1234567', 'lead', 'פייסבוק', 15000, 'מתעניין במערכת אוטומציה לעסק'],
    ['יוסי כהן', 'בנייה וייזום', 'yossi@cohen-build.co.il', '052-7654321', 'contacted', 'המלצה', 45000, 'צריך הצעת מחיר עבור פרויקט שיפוץ משרדים'],
    ['מיכל אברהם', 'סטודיו פיקסל', 'michal@pixel-studio.io', '050-1112233', 'proposal', 'גוגל', 8500, 'נשלחה הצעת מחיר למיתוג ועיצוב אתר'],
    ['דניאל מזרחי', 'קפה ומאפה', 'daniel@coffee-bakery.co.il', '053-9998877', 'negotiation', 'אינסטגרם', 12000, 'משא ומתן על תנאי התשלום והיקף עבודה'],
    ['שירה גולן', 'גולן שיווק', 'shira@golan-media.com', '055-6667788', 'won', 'אורגני', 22000, 'עסקה נסגרה! תחילת עבודה ב-1 לחודש'],
    ['איתי רפאל', 'רפאל פיננסים', 'itay@refael-finance.co.il', '054-8889900', 'lost', 'פייסבוק', 30000, 'החליט ללכת עם ספק זול יותר כרגע']
  ];

  const insertClientSql = `
    INSERT INTO clients (name, company, email, phone, status, source, deal_value, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  for (let idx = 0; idx < sampleClients.length; idx++) {
    const client = sampleClients[idx];
    try {
      const result = await dbRun(insertClientSql, client);
      const clientId = result.id;

      if (clientId) {
        // Seed a note for each client
        await dbRun(`
          INSERT INTO notes (client_id, content, type)
          VALUES (?, ?, ?)
        `, [clientId, `שיחת התנעה ראשונית עם ${client[0]}. עודכן סטטוס ל-${client[4]}`, 'call']);

        // Seed a task for some clients
        if (idx % 2 === 0) {
          await dbRun(`
            INSERT INTO tasks (title, description, due_date, status, client_id)
            VALUES (?, ?, ?, ?, ?)
          `, [
            `שיחת פולו-אפ עם ${client[0]}`,
            `לבדוק אם יש שאלות על הצעת המחיר או על התקדמות העבודה`,
            new Date(Date.now() + (idx + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            'pending',
            clientId
          ]);
        }
      }
    } catch (err) {
      console.error('Error seeding client data item:', err);
    }
  }
}
