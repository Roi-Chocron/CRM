import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Enable CORS
app.use('/api/*', cors());

// Helper to parse ICS calendar feeds (Runs completely in memory)
function parseICS(icsText) {
  const events = [];
  const lines = icsText.split(/\r?\n/);
  let currentEvent = null;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Handle line folding
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

// SQL Query Translators for SQLite D1 Compatibility
function translateSql(sql) {
  // Convert ? placeholders to ?1, ?2, ?3... for D1 parameter bindings
  let placeholderIndex = 1;
  return sql.replace(/\?/g, () => `?${placeholderIndex++}`);
}

// Helper query functions using Cloudflare D1 (provided via c.env.DB)
const getDb = (c) => c.env.DB;

// ==========================================
// CLIENTS / LEADS ROUTES
// ==========================================

// Get all clients
app.get('/api/clients', async (c) => {
  try {
    const db = getDb(c);
    const { status, search } = c.req.query();
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

    const translatedSql = translateSql(query);
    const result = await db.prepare(translatedSql).bind(...params).all();
    return c.json(result.results);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Get single client detailed view
app.get('/api/clients/:id', async (c) => {
  try {
    const db = getDb(c);
    const id = c.req.param('id');
    
    const client = await db.prepare('SELECT * FROM clients WHERE id = ?1').bind(id).first();
    if (!client) {
      return c.json({ error: 'Client not found' }, 404);
    }

    const notes = await db.prepare('SELECT * FROM notes WHERE client_id = ?1 ORDER BY created_at DESC').bind(id).all();
    const tasks = await db.prepare('SELECT * FROM tasks WHERE client_id = ?1 ORDER BY due_date ASC').bind(id).all();
    const documents = await db.prepare('SELECT * FROM documents WHERE client_id = ?1 ORDER BY created_at DESC').bind(id).all();

    return c.json({
      ...client,
      notes: notes.results,
      tasks: tasks.results,
      documents: documents.results
    });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Create new client
app.post('/api/clients', async (c) => {
  try {
    const db = getDb(c);
    const body = await c.req.json();
    const { name, company, email, phone, status, source, deal_value, notes } = body;
    
    if (!name) {
      return c.json({ error: 'Name is required' }, 400);
    }

    const clientStatus = status || 'lead';
    const clientSource = source || 'אחר';
    const clientDealValue = deal_value || 0;
    const clientCompany = company || '';
    const clientEmail = email || '';
    const clientPhone = phone || '';
    const clientNotes = notes || '';

    const query = `
      INSERT INTO clients (name, company, email, phone, status, source, deal_value, notes)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `;
    
    const runResult = await db.prepare(query).bind(
      name, clientCompany, clientEmail, clientPhone, clientStatus, clientSource, clientDealValue, clientNotes
    ).run();

    const insertId = runResult.meta.last_row_id || 1;

    // Create default note
    await db.prepare('INSERT INTO notes (client_id, content, type) VALUES (?1, ?2, ?3)').bind(
      insertId, 'לקוח חדש נוצר במערכת', 'note'
    ).run();

    const newClient = await db.prepare('SELECT * FROM clients WHERE id = ?1').bind(insertId).first();
    return c.json(newClient, 201);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Update client
app.put('/api/clients/:id', async (c) => {
  try {
    const db = getDb(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const { name, company, email, phone, status, source, deal_value, notes } = body;

    const oldClient = await db.prepare('SELECT status FROM clients WHERE id = ?1').bind(id).first();
    if (!oldClient) {
      return c.json({ error: 'Client not found' }, 404);
    }

    await db.prepare(`
      UPDATE clients 
      SET name = ?1, company = ?2, email = ?3, phone = ?4, status = ?5, source = ?6, deal_value = ?7, notes = ?8, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?9
    `).bind(name, company, email, phone, status, source, deal_value, notes, id).run();

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
      await db.prepare('INSERT INTO notes (client_id, content, type) VALUES (?1, ?2, ?3)').bind(
        id, `סטטוס לקוח עודכן מ-${statusMap[oldClient.status] || oldClient.status} ל-${statusMap[status] || status}`, 'note'
      ).run();
    }

    const updatedClient = await db.prepare('SELECT * FROM clients WHERE id = ?1').bind(id).first();
    return c.json(updatedClient);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Delete client
app.delete('/api/clients/:id', async (c) => {
  try {
    const db = getDb(c);
    const id = c.req.param('id');
    
    const result = await db.prepare('DELETE FROM clients WHERE id = ?1').bind(id).run();
    if (result.meta.changes === 0) {
      return c.json({ error: 'Client not found' }, 404);
    }
    return c.json({ message: 'Client deleted successfully' });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// TASKS ROUTES
// ==========================================

// Get all tasks
app.get('/api/tasks', async (c) => {
  try {
    const db = getDb(c);
    const tasks = await db.prepare(`
      SELECT t.*, c.name as client_name 
      FROM tasks t 
      LEFT JOIN clients c ON t.client_id = c.id
      ORDER BY t.status DESC, t.due_date ASC
    `).all();
    return c.json(tasks.results);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Create task
app.post('/api/tasks', async (c) => {
  try {
    const db = getDb(c);
    const body = await c.req.json();
    const { title, description, due_date, client_id } = body;
    
    if (!title) {
      return c.json({ error: 'Title is required' }, 400);
    }

    const query = `
      INSERT INTO tasks (title, description, due_date, client_id, status)
      VALUES (?1, ?2, ?3, ?4, 'pending')
    `;
    const runResult = await db.prepare(query).bind(
      title, description || '', due_date || null, client_id || null
    ).run();

    const insertId = runResult.meta.last_row_id || 1;
    const newTask = await db.prepare(`
      SELECT t.*, c.name as client_name 
      FROM tasks t 
      LEFT JOIN clients c ON t.client_id = c.id 
      WHERE t.id = ?1
    `).bind(insertId).first();

    return c.json(newTask, 201);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Update task
app.put('/api/tasks/:id', async (c) => {
  try {
    const db = getDb(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const { title, description, due_date, status, client_id } = body;

    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?1').bind(id).first();
    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const updTitle = title !== undefined ? title : task.title;
    const updDesc = description !== undefined ? description : task.description;
    const updDueDate = due_date !== undefined ? due_date : task.due_date;
    const updStatus = status !== undefined ? status : task.status;
    const updClientId = client_id !== undefined ? client_id : task.client_id;

    await db.prepare(`
      UPDATE tasks 
      SET title = ?1, description = ?2, due_date = ?3, status = ?4, client_id = ?5
      WHERE id = ?6
    `).bind(updTitle, updDesc, updDueDate, updStatus, updClientId, id).run();

    const updatedTask = await db.prepare(`
      SELECT t.*, c.name as client_name 
      FROM tasks t 
      LEFT JOIN clients c ON t.client_id = c.id 
      WHERE t.id = ?1
    `).bind(id).first();

    return c.json(updatedTask);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Delete task
app.delete('/api/tasks/:id', async (c) => {
  try {
    const db = getDb(c);
    const id = c.req.param('id');
    const result = await db.prepare('DELETE FROM tasks WHERE id = ?1').bind(id).run();
    if (result.meta.changes === 0) {
      return c.json({ error: 'Task not found' }, 404);
    }
    return c.json({ message: 'Task deleted successfully' });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// CLIENT NOTES ROUTES
// ==========================================

// Add note to client
app.post('/api/clients/:id/notes', async (c) => {
  try {
    const db = getDb(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const { content, type } = body;
    
    if (!content) {
      return c.json({ error: 'Content is required' }, 400);
    }

    const runResult = await db.prepare(`
      INSERT INTO notes (client_id, content, type)
      VALUES (?1, ?2, ?3)
    `).bind(id, content, type || 'note').run();

    const insertId = runResult.meta.last_row_id || 1;
    const newNote = await db.prepare('SELECT * FROM notes WHERE id = ?1').bind(insertId).first();
    return c.json(newNote, 201);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Delete note
app.delete('/api/notes/:id', async (c) => {
  try {
    const db = getDb(c);
    const id = c.req.param('id');
    const result = await db.prepare('DELETE FROM notes WHERE id = ?1').bind(id).run();
    if (result.meta.changes === 0) {
      return c.json({ error: 'Note not found' }, 404);
    }
    return c.json({ message: 'Note deleted successfully' });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// DOCUMENTS ROUTES (D1 Cloud Mode: In-memory simulation / D1 reference)
// ==========================================

// Cloudflare Workers has no writable local storage disk. 
// We will store document paths referencing the UI file mock as simulation.
app.post('/api/clients/:id/documents', async (c) => {
  try {
    const db = getDb(c);
    const id = c.req.param('id');
    
    // In Edge Workers we simulate file attachments using details from json payload
    const body = await c.req.json().catch(() => ({}));
    const fileName = body.fileName || 'document.pdf';
    const fileSize = body.fileSize || 102400; // 100 KB
    const filePath = body.filePath || `/mock-uploads/${Date.now()}-${fileName}`;

    const runResult = await db.prepare(`
      INSERT INTO documents (client_id, file_name, file_path, file_size)
      VALUES (?1, ?2, ?3, ?4)
    `).bind(id, fileName, filePath, fileSize).run();

    const insertId = runResult.meta.last_row_id || 1;

    await db.prepare('INSERT INTO notes (client_id, content, type) VALUES (?1, ?2, ?3)').bind(
      id, `הועלה מסמך חדש: ${fileName} (מצב ענן)`, 'note'
    ).run();

    const newDoc = await db.prepare('SELECT * FROM documents WHERE id = ?1').bind(insertId).first();
    return c.json(newDoc, 201);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

app.delete('/api/documents/:id', async (c) => {
  try {
    const db = getDb(c);
    const id = c.req.param('id');
    const result = await db.prepare('DELETE FROM documents WHERE id = ?1').bind(id).run();
    if (result.meta.changes === 0) {
      return c.json({ error: 'Document not found' }, 404);
    }
    return c.json({ message: 'Document deleted successfully' });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// CALENDAR SYNC iCal ROUTE
// ==========================================
app.post('/api/calendar/sync', async (c) => {
  try {
    const db = getDb(c);
    const body = await c.req.json();
    const { url } = body;
    
    if (!url) {
      return c.json({ error: 'iCal feed URL is required' }, 400);
    }

    console.log(`Fetching calendar feed from: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch iCal feed (Status: ${response.status})`);
    }

    const icsText = await response.text();
    const events = parseICS(icsText);

    let addedCount = 0;
    for (const event of events) {
      const existing = await db.prepare("SELECT id FROM tasks WHERE title = ?1 AND due_date = ?2").bind(
        event.title, event.due_date
      ).first();
      
      if (!existing) {
        await db.prepare(`
          INSERT INTO tasks (title, description, due_date, status)
          VALUES (?1, ?2, ?3, 'pending')
        `).bind(event.title, event.description || 'סונכרן מיומן חיצוני', event.due_date).run();
        addedCount++;
      }
    }

    return c.json({ message: 'Calendar synced successfully', eventsSynced: events.length, newEventsAdded: addedCount });
  } catch (error) {
    return c.json({ error: `שגיאה בסנכרון היומן: ${error.message}` }, 500);
  }
});

// ==========================================
// SETTINGS / RESET DATA ROUTES
// ==========================================

app.post('/api/settings/reset', async (c) => {
  try {
    const db = getDb(c);
    await db.prepare('DELETE FROM clients').run();
    await db.prepare('DELETE FROM notes').run();
    await db.prepare('DELETE FROM tasks').run();
    await db.prepare('DELETE FROM documents').run();
    
    return c.json({ message: 'Database reset successfully. Clean slate activated.' });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/settings/seed', async (c) => {
  try {
    const db = getDb(c);
    
    // Clear first
    await db.prepare('DELETE FROM clients').run();
    await db.prepare('DELETE FROM notes').run();
    await db.prepare('DELETE FROM tasks').run();
    await db.prepare('DELETE FROM documents').run();

    // Re-seed
    const sampleClients = [
      ['רוני לוי', 'טק-סולושנס', 'roni@tech-solutions.co.il', '054-1234567', 'lead', 'פייסבוק', 15000, 'מתעניין במערכת אוטומציה לעסק'],
      ['יוסי כהן', 'בנייה וייזום', 'yossi@cohen-build.co.il', '052-7654321', 'contacted', 'המלצה', 45000, 'צריך הצעת מחיר עבור פרויקט שיפוץ משרדים'],
      ['מיכל אברהם', 'סטודיו פיקסל', 'michal@pixel-studio.io', '050-1112233', 'proposal', 'גוגל', 8500, 'נשלחה הצעת מחיר למיתוג ועיצוב אתר'],
      ['דניאל מזרחי', 'קפה ומאפה', 'daniel@coffee-bakery.co.il', '053-9998877', 'negotiation', 'אינסטגרם', 12000, 'משא ומתן על תנאי התשלום והיקף עבודה'],
      ['שירה גולן', 'גולן שיווק', 'shira@golan-media.com', '055-6667788', 'won', 'אורגני', 22000, 'עסקה נסגרה! תחילת עבודה ב-1 לחודש'],
      ['איתי רפאל', 'רפאל פיננסים', 'itay@refael-finance.co.il', '054-8889900', 'lost', 'פייסבוק', 30000, 'החליט ללכת עם ספק זול יותר כרגע']
    ];

    const query = `
      INSERT INTO clients (name, company, email, phone, status, source, deal_value, notes)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `;

    for (let idx = 0; idx < sampleClients.length; idx++) {
      const client = sampleClients[idx];
      const runResult = await db.prepare(query).bind(
        client[0], client[1], client[2], client[3], client[4], client[5], client[6], client[7]
      ).run();
      
      const clientId = runResult.meta.last_row_id || (idx + 1);

      await db.prepare('INSERT INTO notes (client_id, content, type) VALUES (?1, ?2, ?3)').bind(
        clientId, `שיחת התנעה ראשונית עם ${client[0]}. עודכן סטטוס ל-${client[4]}`, 'call'
      ).run();

      if (idx % 2 === 0) {
        await db.prepare(`
          INSERT INTO tasks (title, description, due_date, status, client_id)
          VALUES (?1, ?2, ?3, ?4, ?5)
        `).bind(
          `שיחת פולו-אפ עם ${client[0]}`,
          `לבדוק אם יש שאלות על הצעת המחיר או על התקדמות העבודה`,
          new Date(Date.now() + (idx + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          'pending',
          clientId
        ).run();
      }
    }

    return c.json({ message: 'Database seeded successfully with sample data.' });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// STATS / METRICS ROUTE
// ==========================================
app.get('/api/stats', async (c) => {
  try {
    const db = getDb(c);
    
    const totalWon = await db.prepare("SELECT SUM(deal_value) as sum FROM clients WHERE status = 'won'").first();
    const pipelineValue = await db.prepare("SELECT SUM(deal_value) as sum FROM clients WHERE status NOT IN ('won', 'lost')").first();
    
    const dealCounts = await db.prepare(`
      SELECT 
        COUNT(CASE WHEN status = 'won' THEN 1 END) as won,
        COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost,
        COUNT(*) as total
      FROM clients
    `).first();

    const statusDistribution = await db.prepare(`
      SELECT status, COUNT(*) as count, SUM(deal_value) as value 
      FROM clients 
      GROUP BY status
    `).all();

    const sourceDistribution = await db.prepare(`
      SELECT source, COUNT(*) as count 
      FROM clients 
      GROUP BY source
    `).all();

    const taskStats = await db.prepare(`
      SELECT 
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
      FROM tasks
    `).first();

    return c.json({
      revenue: totalWon.sum || 0,
      pipeline: pipelineValue.sum || 0,
      totalLeads: dealCounts.total || 0,
      conversionRate: (dealCounts.won + dealCounts.lost) > 0 
        ? Math.round((dealCounts.won / (dealCounts.won + dealCounts.lost)) * 100) 
        : 0,
      statusDistribution: statusDistribution.results,
      sourceDistribution: sourceDistribution.results,
      taskStats: {
        completed: taskStats.completed || 0,
        pending: taskStats.pending || 0
      }
    });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

export default app;
