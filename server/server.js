import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dbQuery, dbGet, dbRun } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// Helper to parse ICS calendar feeds
function parseICS(icsText) {
  const events = [];
  const lines = icsText.split(/\r?\n/);
  let currentEvent = null;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Handle line folding (lines starting with space/tab continue the previous line)
    while (i + 1 < lines.length && (lines[i+1].startsWith(' ') || lines[i+1].startsWith('\t'))) {
      line += lines[i+1].substring(1);
      i++;
    }

    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (currentEvent && currentEvent.title) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.title = line.substring(8).trim();
      } else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = line.substring(12).trim().replace(/\\n/g, '\n').replace(/\\,/g, ',');
      } else if (line.startsWith('DTSTART:')) {
        // Parse DTSTART (e.g. DTSTART:20260616T180000Z or DTSTART;VALUE=DATE:20260616)
        const parts = line.split(':');
        const val = parts[parts.length - 1];
        if (val && val.length >= 8) {
          const y = val.substring(0, 4);
          const m = val.substring(4, 6);
          const d = val.substring(6, 8);
          currentEvent.due_date = `${y}-${m}-${d}`;
        }
      }
    }
  }
  return events;
}

// ==========================================
// CLIENTS / LEADS ROUTES
// ==========================================

// Get all clients with filtering & search
app.get('/api/clients', async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = 'SELECT * FROM clients';
    const params = [];

    const conditions = [];
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('(name LIKE ? OR company LIKE ? OR email LIKE ? OR phone LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const clients = await dbQuery(query, params);
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single client detailed view
app.get('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await dbGet('SELECT * FROM clients WHERE id = ?', [id]);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const notes = await dbQuery('SELECT * FROM notes WHERE client_id = ? ORDER BY created_at DESC', [id]);
    const tasks = await dbQuery('SELECT * FROM tasks WHERE client_id = ? ORDER BY due_date ASC', [id]);
    const documents = await dbQuery('SELECT * FROM documents WHERE client_id = ? ORDER BY created_at DESC', [id]);

    res.json({
      ...client,
      notes,
      tasks,
      documents
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new client
app.post('/api/clients', async (req, res) => {
  try {
    const { name, company, email, phone, status, source, deal_value, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await dbRun(`
      INSERT INTO clients (name, company, email, phone, status, source, deal_value, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name,
      company || '',
      email || '',
      phone || '',
      status || 'lead',
      source || 'אחר',
      deal_value || 0,
      notes || ''
    ]);

    // Create default system note
    await dbRun(`
      INSERT INTO notes (client_id, content, type)
      VALUES (?, ?, ?)
    `, [result.id, 'לקוח חדש נוצר במערכת', 'note']);

    const newClient = await dbGet('SELECT * FROM clients WHERE id = ?', [result.id]);
    res.status(201).json(newClient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update client
app.put('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, company, email, phone, status, source, deal_value, notes } = req.body;

    const oldClient = await dbGet('SELECT status FROM clients WHERE id = ?', [id]);
    if (!oldClient) {
      return res.status(404).json({ error: 'Client not found' });
    }

    await dbRun(`
      UPDATE clients 
      SET name = ?, company = ?, email = ?, phone = ?, status = ?, source = ?, deal_value = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, company, email, phone, status, source, deal_value, notes, id]);

    // Add note if status changed
    if (oldClient.status !== status) {
      const statusMap = {
        'lead': 'ליד חדש',
        'contacted': 'יצירת קשר',
        'proposal': 'הצעת מחיר',
        'negotiation': 'משא ומתן',
        'won': 'עסקה נסגרה (Won)',
        'lost': 'עסקה אבודה (Lost)'
      };
      await dbRun(`
        INSERT INTO notes (client_id, content, type)
        VALUES (?, ?, ?)
      `, [id, `סטטוס לקוח עודכן מ-${statusMap[oldClient.status] || oldClient.status} ל-${statusMap[status] || status}`, 'note']);
    }

    const updatedClient = await dbGet('SELECT * FROM clients WHERE id = ?', [id]);
    res.json(updatedClient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete client
app.delete('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbRun('DELETE FROM clients WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// TASKS ROUTES
// ==========================================

// Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await dbQuery(`
      SELECT t.*, c.name as client_name 
      FROM tasks t 
      LEFT JOIN clients c ON t.client_id = c.id
      ORDER BY t.status DESC, t.due_date ASC
    `);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create task
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, due_date, client_id } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await dbRun(`
      INSERT INTO tasks (title, description, due_date, client_id, status)
      VALUES (?, ?, ?, ?, 'pending')
    `, [title, description || '', due_date || null, client_id || null]);

    const newTask = await dbGet(`
      SELECT t.*, c.name as client_name 
      FROM tasks t 
      LEFT JOIN clients c ON t.client_id = c.id 
      WHERE t.id = ?
    `, [result.id]);
    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, due_date, status, client_id } = req.body;

    const task = await dbGet('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await dbRun(`
      UPDATE tasks 
      SET title = ?, description = ?, due_date = ?, status = ?, client_id = ?
      WHERE id = ?
    `, [
      title !== undefined ? title : task.title,
      description !== undefined ? description : task.description,
      due_date !== undefined ? due_date : task.due_date,
      status !== undefined ? status : task.status,
      client_id !== undefined ? client_id : task.client_id,
      id
    ]);

    const updatedTask = await dbGet(`
      SELECT t.*, c.name as client_name 
      FROM tasks t 
      LEFT JOIN clients c ON t.client_id = c.id 
      WHERE t.id = ?
    `, [id]);
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbRun('DELETE FROM tasks WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CLIENT NOTES ROUTES
// ==========================================

// Add note to client
app.post('/api/clients/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await dbRun(`
      INSERT INTO notes (client_id, content, type)
      VALUES (?, ?, ?)
    `, [id, content, type || 'note']);

    const newNote = await dbGet('SELECT * FROM notes WHERE id = ?', [result.id]);
    res.status(201).json(newNote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete note
app.delete('/api/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbRun('DELETE FROM notes WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// DOCUMENTS ROUTES
// ==========================================

// Upload file for client
app.post('/api/clients/:id/documents', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, filename, size } = req.file;
    const relativePath = `/uploads/${filename}`;

    const result = await dbRun(`
      INSERT INTO documents (client_id, file_name, file_path, file_size)
      VALUES (?, ?, ?, ?)
    `, [id, originalname, relativePath, size]);

    await dbRun(`
      INSERT INTO notes (client_id, content, type)
      VALUES (?, ?, ?)
    `, [id, `הועלה קובץ חדש: ${originalname}`, 'note']);

    const newDoc = await dbGet('SELECT * FROM documents WHERE id = ?', [result.id]);
    res.status(201).json(newDoc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete document
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await dbGet('SELECT * FROM documents WHERE id = ?', [id]);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const physicalPath = path.join(__dirname, doc.file_path);
    if (fs.existsSync(physicalPath)) {
      fs.unlinkSync(physicalPath);
    }

    await dbRun('DELETE FROM documents WHERE id = ?', [id]);
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CALENDAR SYNC iCal ROUTE (Real Calendar Connection)
// ==========================================
app.post('/api/calendar/sync', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'iCal feed URL is required' });
    }

    console.log(`Fetching calendar feed from: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch iCal feed (Status: ${response.status})`);
    }

    const icsText = await response.text();
    const events = parseICS(icsText);

    // Filter events to insert (insert only new ones, avoiding title + date duplicates)
    let addedCount = 0;
    for (const event of events) {
      const existing = await dbGet(
        "SELECT id FROM tasks WHERE title = ? AND due_date = ?", 
        [event.title, event.due_date]
      );
      
      if (!existing) {
        await dbRun(`
          INSERT INTO tasks (title, description, due_date, status)
          VALUES (?, ?, ?, 'pending')
        `, [event.title, event.description || 'סונכרן מיומן חיצוני', event.due_date]);
        addedCount++;
      }
    }

    res.json({ message: 'Calendar synced successfully', eventsSynced: events.length, newEventsAdded: addedCount });
  } catch (error) {
    console.error('Calendar sync error:', error);
    res.status(500).json({ error: `שגיאה בסנכרון היומן: ${error.message}` });
  }
});

// ==========================================
// SETTINGS / RESET DATA ROUTES
// ==========================================

// Reset database (Clear all clients/tasks/etc.)
app.post('/api/settings/reset', async (req, res) => {
  try {
    await dbRun('DELETE FROM clients');
    await dbRun('DELETE FROM notes');
    await dbRun('DELETE FROM tasks');
    await dbRun('DELETE FROM documents');
    
    // Reset SQLite auto-increment counters
    await dbRun("DELETE FROM sqlite_sequence WHERE name IN ('clients', 'notes', 'tasks', 'documents')");

    // Delete uploaded files
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      fs.unlinkSync(path.join(uploadsDir, file));
    }

    res.json({ message: 'Database reset successfully. Clean slate activated.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Re-seed mock database
app.post('/api/settings/seed', async (req, res) => {
  try {
    // Clear first
    await dbRun('DELETE FROM clients');
    await dbRun('DELETE FROM notes');
    await dbRun('DELETE FROM tasks');
    await dbRun('DELETE FROM documents');
    await dbRun("DELETE FROM sqlite_sequence WHERE name IN ('clients', 'notes', 'tasks', 'documents')");

    // Re-seed
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
      const result = await dbRun(insertClientSql, client);
      const clientId = result.id;

      await dbRun(`
        INSERT INTO notes (client_id, content, type)
        VALUES (?, ?, ?)
      `, [clientId, `שיחת התנעה ראשונית עם ${client[0]}. עודכן סטטוס ל-${client[4]}`, 'call']);

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

    res.json({ message: 'Database seeded successfully with sample data.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// STATS / METRICS ROUTE
// ==========================================
app.get('/api/stats', async (req, res) => {
  try {
    const totalWon = await dbGet("SELECT SUM(deal_value) as sum FROM clients WHERE status = 'won'");
    const pipelineValue = await dbGet("SELECT SUM(deal_value) as sum FROM clients WHERE status NOT IN ('won', 'lost')");
    
    const dealCounts = await dbGet(`
      SELECT 
        COUNT(CASE WHEN status = 'won' THEN 1 END) as won,
        COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost,
        COUNT(*) as total
      FROM clients
    `);

    const statusDistribution = await dbQuery(`
      SELECT status, COUNT(*) as count, SUM(deal_value) as value 
      FROM clients 
      GROUP BY status
    `);

    const sourceDistribution = await dbQuery(`
      SELECT source, COUNT(*) as count 
      FROM clients 
      GROUP BY source
    `);

    const taskStats = await dbGet(`
      SELECT 
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
      FROM tasks
    `);

    res.json({
      revenue: totalWon.sum || 0,
      pipeline: pipelineValue.sum || 0,
      totalLeads: dealCounts.total || 0,
      conversionRate: (dealCounts.won + dealCounts.lost) > 0 
        ? Math.round((dealCounts.won / (dealCounts.won + dealCounts.lost)) * 100) 
        : 0,
      statusDistribution,
      sourceDistribution,
      taskStats: {
        completed: taskStats.completed || 0,
        pending: taskStats.pending || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// FALLBACK TO SERVE REACT CLIENT (Production)
// ==========================================
const clientDistDir = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
