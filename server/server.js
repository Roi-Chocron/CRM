import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

const app = new Hono();

// Secret key for user cookies validation (Since we run in CF Worker, use environment secret or default fallback)
const SESSION_SECRET = "roi-crm-super-secure-token-2026";

// Credentials for Google OAuth (These will read from c.env in Cloudflare Dashboard)
// Set fallback to avoid breaking deployments, user can update them in Cloudflare dashboard
const getGoogleCredentials = (c) => ({
  clientId: c.env.GOOGLE_CLIENT_ID || "1032890523098-fakeclientid.apps.googleusercontent.com",
  clientSecret: c.env.GOOGLE_CLIENT_SECRET || "GOCSPX-fakesecret",
  redirectUri: c.env.GOOGLE_REDIRECT_URI || "https://crm-backend.roi-chocron7.workers.dev/api/auth/google/callback"
});

// Enable CORS with Credentials for cookies support
app.use('/api/*', async (c, next) => {
  const origin = c.req.header('Origin') || 'https://roi-chocron.github.io';
  const corsMiddleware = cors({
    origin: origin,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  });
  return corsMiddleware(c, next);
});

// Helper query functions using Cloudflare D1
const getDb = (c) => c.env.DB;

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================
app.use('/api/*', async (c, next) => {
  const path = c.req.path;
  // Exclude login and OAuth callback from authentication checks
  if (
    path === '/api/auth/login' || 
    path === '/api/auth/logout' ||
    path === '/api/auth/google/callback' || 
    path === '/api/auth/google/redirect' ||
    c.req.method === 'OPTIONS'
  ) {
    return next();
  }

  const session = getCookie(c, 'crm_session');
  if (!session || session !== SESSION_SECRET) {
    return c.json({ error: 'Unauthorized. Please login.' }, 401);
  }

  return next();
});

// Helper to parse ICS calendar feeds
function parseICS(icsText) {
  const events = [];
  const lines = icsText.split(/\r?\n/);
  let currentEvent = null;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
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
  let placeholderIndex = 1;
  return sql.replace(/\?/g, () => `?${placeholderIndex++}`);
}

// ==========================================
// USER AUTH ROUTES
// ==========================================

// Login route (Checks username and raw/md5 hash)
app.post('/api/auth/login', async (c) => {
  try {
    const db = getDb(c);
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
      return c.json({ error: 'Username and password required' }, 400);
    }

    // Hash password with simple MD5 hex (D1 supports username matching)
    // For local '123456' it is 'e10adc3949ba59abbe56e057f20f883e'
    let md5 = "";
    try {
      const msgUint8 = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('MD5', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      md5 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Basic encoding fallback in non-crypto JS environments
      md5 = password;
    }

    const user = await db.prepare('SELECT id, name, username FROM users WHERE username = ?1 AND (password_hash = ?2 OR password_hash = ?3)')
      .bind(username, password, md5).first();

    if (!user) {
      return c.json({ error: 'Invalid username or password' }, 401);
    }

    // Set Session Cookie (Secure, HttpOnly, SameSite config)
    setCookie(c, 'crm_session', SESSION_SECRET, {
      path: '/',
      secure: true,
      httpOnly: false, // Accessible to front-end client verification
      sameSite: 'None', // Required for cross-site cookie settings under Github Pages Context
      maxAge: 60 * 60 * 24 * 7 // 7 Days
    });

    return c.json({ success: true, user });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Logout route
app.post('/api/auth/logout', async (c) => {
  deleteCookie(c, 'crm_session', { path: '/', secure: true, sameSite: 'None' });
  return c.json({ success: true });
});

// Check current authentication status
app.get('/api/auth/me', async (c) => {
  const session = getCookie(c, 'crm_session');
  if (!session || session !== SESSION_SECRET) {
    return c.json({ loggedIn: false }, 401);
  }
  // Retrieve default admin user
  const db = getDb(c);
  const user = await db.prepare('SELECT id, name, username FROM users LIMIT 1').first();
  return c.json({ loggedIn: true, user });
});

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
// DOCUMENTS ROUTES
// ==========================================

app.post('/api/clients/:id/documents', async (c) => {
  try {
    const db = getDb(c);
    const id = c.req.param('id');
    
    const body = await c.req.json().catch(() => ({}));
    const fileName = body.fileName || 'document.pdf';
    const fileSize = body.fileSize || 102400;
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
// GOOGLE CALENDAR OAUTH INTEGRATION ROUTES
// ==========================================

// Endpoint to start OAuth redirect flow
app.get('/api/auth/google/redirect', async (c) => {
  const { clientId, redirectUri } = getGoogleCredentials(c);
  
  // Set parameters requesting Google offline calendar access
  const googleOAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.readonly')}` +
    `&access_type=offline` +
    `&prompt=consent`;

  return c.redirect(googleOAuthUrl);
});

// Callback route where Google returns auth code
app.get('/api/auth/google/callback', async (c) => {
  const db = getDb(c);
  const code = c.req.query('code');
  const error = c.req.query('error');

  if (error) {
    return c.html(`<h3>שגיאה בהתחברות ל-Google: ${error}</h3>`);
  }

  if (!code) {
    return c.html(`<h3>חסר קוד אימות מ-Google</h3>`);
  }

  const { clientId, clientSecret, redirectUri } = getGoogleCredentials(c);

  try {
    // Exchange code for Google Access/Refresh tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errText}`);
    }

    const tokens = await tokenResponse.json();
    const expiresAt = Date.now() + (tokens.expires_in * 1000);

    // Save tokens in database integration table
    await db.prepare(`
      INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at)
      VALUES ('google', ?1, ?2, ?3)
      ON CONFLICT(provider) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, oauth_tokens.refresh_token),
        expires_at = excluded.expires_at,
        updated_at = CURRENT_TIMESTAMP
    `).bind(tokens.access_token, tokens.refresh_token || null, expiresAt).run();

    // Return auto closing success window
    return c.html(`
      <div style="font-family: sans-serif; text-align: center; padding: 40px; background: #0b0f19; color: #fff; height: 100vh;">
        <h2 style="color: #10b981;">החיבור ליומן Google בוצע בהצלחה!</h2>
        <p>חלון זה ייסגר אוטומטית כעת והסנכרון יתחיל לעבוד.</p>
        <script>
          setTimeout(() => {
            if (window.opener) {
              window.opener.postMessage('google-oauth-success', '*');
            }
            window.close();
          }, 2500);
        </script>
      </div>
    `);
  } catch (err) {
    return c.html(`<h3 style="color:#ef4444;">שגיאה בתהליך החיבור: ${err.message}</h3>`);
  }
});

// Sync Google Calendar status
app.get('/api/calendar/google/status', async (c) => {
  const db = getDb(c);
  const token = await db.prepare("SELECT provider, updated_at FROM oauth_tokens WHERE provider = 'google'").first();
  return c.json({ connected: !!token, lastSync: token ? token.updated_at : null });
});

// Trigger Google Calendar sync process
app.post('/api/calendar/google/sync', async (c) => {
  const db = getDb(c);
  
  // 1. Fetch Google credentials
  const token = await db.prepare("SELECT * FROM oauth_tokens WHERE provider = 'google'").first();
  if (!token) {
    return c.json({ error: "Google Calendar not connected. Authenticate first." }, 400);
  }

  let accessToken = token.access_token;
  
  // 2. Refresh token if expired
  if (Date.now() >= token.expires_at) {
    if (!token.refresh_token) {
      return c.json({ error: "Access token expired and no refresh token available." }, 401);
    }
    
    const { clientId, clientSecret } = getGoogleCredentials(c);
    try {
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: token.refresh_token,
          grant_type: 'refresh_token'
        })
      });

      if (!refreshResponse.ok) {
        throw new Error("Failed to refresh Google token");
      }

      const refreshed = await refreshResponse.json();
      accessToken = refreshed.access_token;
      const expiresAt = Date.now() + (refreshed.expires_in * 1000);

      await db.prepare(`
        UPDATE oauth_tokens 
        SET access_token = ?1, expires_at = ?2, updated_at = CURRENT_TIMESTAMP
        WHERE provider = 'google'
      `).bind(accessToken, expiresAt).run();
    } catch (err) {
      return c.json({ error: `Failed to refresh OAuth token: ${err.message}` }, 500);
    }
  }

  // 3. Query Google Calendar events
  try {
    const timeMin = new Date().toISOString(); // Sync events starting now
    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime&maxResults=50`;
    
    const response = await fetch(calendarUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Calendar API error: ${errText}`);
    }

    const data = await response.json();
    const events = data.items || [];
    
    let addedCount = 0;
    for (const event of events) {
      const title = event.summary || 'אירוע ללא שם';
      const description = event.description || 'סונכרן מיומן Google';
      
      // Parse event dates
      let due_date = null;
      if (event.start?.dateTime) {
        due_date = event.start.dateTime.split('T')[0];
      } else if (event.start?.date) {
        due_date = event.start.date;
      }

      if (!due_date) continue;

      // Avoid duplicates
      const existing = await db.prepare("SELECT id FROM tasks WHERE title = ?1 AND due_date = ?2").bind(
        title, due_date
      ).first();

      if (!existing) {
        await db.prepare(`
          INSERT INTO tasks (title, description, due_date, status)
          VALUES (?1, ?2, ?3, 'pending')
        `).bind(title, description, due_date).run();
        addedCount++;
      }
    }

    return c.json({ success: true, eventsSynced: events.length, newEventsAdded: addedCount });
  } catch (error) {
    return c.json({ error: `Google Calendar Sync error: ${error.message}` }, 500);
  }
});

// Legacy iCal sync endpoint (Fallback)
app.post('/api/calendar/sync', async (c) => {
  try {
    const db = getDb(c);
    const body = await c.req.json();
    const { url } = body;
    
    if (!url) {
      return c.json({ error: 'iCal feed URL is required' }, 400);
    }

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
    return c.json({ message: 'Database reset successfully.' });
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

    // Re-seed sample data
    const sampleClients = [
      ['רוני לוי', 'טק-סולושנס', 'roni@tech-solutions.co.il', '054-1234567', 'lead', 'פייסבוק', 15000, 'מתעניין במערכת אוטומציה לעסק'],
      ['יוסי כהן', 'בנייה וייזום', 'yossi@cohen-build.co.il', '052-7654321', 'contacted', 'המלצה', 45000, 'צריך הצעת מחיר עבור פרויקט שיפוץ משרדים'],
      ['מיכל אברהם', 'סטודיו פיקסל', 'michal@pixel-studio.io', '050-1112233', 'proposal', 'גוגל', 8500, 'נשלחה הצעת מחיר למיתוג ועיצוב אתר']
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
