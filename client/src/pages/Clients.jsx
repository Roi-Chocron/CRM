import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../components/Toast';
import { Plus, FolderOpen, Phone, Tag, Trash2, X, Search, Upload, FileText, Mail, Users, MessageSquare } from 'lucide-react';

const Clients = ({ activeClientId, setActiveClientId }) => {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);

  // Forms states
  const [editForm, setEditForm] = useState(null);
  const [newNote, setNewNote] = useState({ content: '', type: 'note' });
  const [newTask, setNewTask] = useState({ title: '', due_date: '' });
  const [newLead, setNewLead] = useState({
    name: '', company: '', phone: '', email: '', deal_value: '', source: 'פייסבוק', status: 'lead'
  });

  const fileInputRef = useRef(null);
  const drawerRef = useRef(null);
  const addLeadModalRef = useRef(null);
  const addLeadBtnRef = useRef(null);
  const { showToast } = useToast();

  const fetchClients = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/clients', window.location.origin);
      if (search) url.searchParams.append('search', search);
      if (statusFilter) url.searchParams.append('status', statusFilter);

      const res = await fetch(url);
      const data = await res.json();
      setClients(data);

      if (activeClientId) {
        fetchClientDetails(activeClientId);
        setActiveClientId(null);
      }
    } catch (error) {
      showToast('שגיאה בטעינת הלקוחות', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [search, statusFilter]);

  // Focus trap for add lead modal
  useEffect(() => {
    if (!showAddLead) {
      if (addLeadBtnRef.current) addLeadBtnRef.current.focus();
      return;
    }

    const focusableElements = addLeadModalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex="0"]'
    );
    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowAddLead(false);
        return;
      }

      if (e.key !== 'Tab') return;

      const elements = Array.from(focusableElements || []);
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddLead]);

  // Focus trap for details drawer
  useEffect(() => {
    if (!selectedClient) return;

    const focusableElements = drawerRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex="0"], a'
    );
    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedClient(null);
        return;
      }

      if (e.key !== 'Tab') return;

      const elements = Array.from(focusableElements || []);
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClient]);

  const fetchClientDetails = async (id) => {
    try {
      const res = await fetch(`/api/clients/${id}`);
      const data = await res.json();
      setSelectedClient(data);
      setEditForm(data);
      setIsEditing(false);
    } catch (error) {
      showToast('שגיאה בטעינת פרטי הלקוח', 'error');
    }
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/clients/${selectedClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          deal_value: parseFloat(editForm.deal_value) || 0
        })
      });
      if (res.ok) {
        showToast('פרטי הלקוח עודכנו בהצלחה');
        setIsEditing(false);
        fetchClientDetails(selectedClient.id);
        fetchClients();
      } else {
        showToast('שגיאה בעדכון הפרטים', 'error');
      }
    } catch (error) {
      showToast('שגיאה בחיבור לשרת', 'error');
    }
  };

  const handleDeleteClient = async () => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את ${selectedClient.name}? פעולה זו אינה הפיכה!`)) {
      return;
    }

    try {
      const res = await fetch(`/api/clients/${selectedClient.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('הלקוח נמחק בהצלחה');
        setSelectedClient(null);
        fetchClients();
      }
    } catch (error) {
      showToast('שגיאה במחיקת הלקוח', 'error');
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.content.trim()) return;

    try {
      const res = await fetch(`/api/clients/${selectedClient.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNote)
      });
      if (res.ok) {
        showToast('הערה נוספה בהצלחה');
        setNewNote({ content: '', type: 'note' });
        fetchClientDetails(selectedClient.id);
      }
    } catch (error) {
      showToast('שגיאה בהוספת הערה', 'error');
    }
  };

  const handleAddClientTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTask,
          client_id: selectedClient.id
        })
      });
      if (res.ok) {
        showToast('משימה נוספה בהצלחה');
        setNewTask({ title: '', due_date: '' });
        fetchClientDetails(selectedClient.id);
      }
    } catch (error) {
      showToast('שגיאה בהוספת משימה', 'error');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/clients/${selectedClient.id}/documents`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        showToast('הקובץ הועלה בהצלחה');
        fetchClientDetails(selectedClient.id);
      } else {
        showToast('שגיאה בהעלאת הקובץ', 'error');
      }
    } catch (error) {
      showToast('שגיאה בחיבור לשרת', 'error');
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('האם למחוק את המסמך לצמיתות?')) return;

    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('הקובץ נמחק');
        fetchClientDetails(selectedClient.id);
      }
    } catch (error) {
      showToast('שגיאה במחיקת הקובץ', 'error');
    }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!newLead.name) return;

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newLead,
          deal_value: parseFloat(newLead.deal_value) || 0
        })
      });

      if (res.ok) {
        showToast('ליד חדש נוצר בהצלחה');
        setShowAddLead(false);
        setNewLead({
          name: '', company: '', phone: '', email: '', deal_value: '', source: 'פייסבוק', status: 'lead'
        });
        fetchClients();
      }
    } catch (error) {
      showToast('שגיאה ביצירת הליד', 'error');
    }
  };

  // Helpers
  const formatCurrency = (val) => {
    const formatted = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(val || 0);
    return `\u2066${formatted}\u2069`;
  };

  const translateStatus = (s) => {
    const map = {
      'lead': 'ליד',
      'contacted': 'יצירת קשר',
      'proposal': 'הצעת מחיר',
      'negotiation': 'משא ומתן',
      'won': 'עסקה נסגרה',
      'lost': 'עסקה אבודה'
    };
    return map[s] || s;
  };

  return (
    <div className="clients-page">
      {/* Search and Filters Header */}
      <div className="clients-filter-bar glass-panel">
        <div className="search-box-container">
          <span className="search-icon"><Search size={14} /></span>
          <input 
            type="text" 
            placeholder="חיפוש לפי שם, חברה, טלפון..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-glass search-input"
          />
        </div>
        
        <div className="filter-actions">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-glass status-select text-mono"
          >
            <option value="">כל הסטטוסים</option>
            <option value="lead">ליד</option>
            <option value="contacted">יצירת קשר</option>
            <option value="proposal">הצעת מחיר</option>
            <option value="negotiation">משא ומתן</option>
            <option value="won">עסקה נסגרה</option>
            <option value="lost">עסקה אבודה</option>
          </select>
          
          <button 
            ref={addLeadBtnRef}
            className="btn btn-primary" 
            onClick={() => setShowAddLead(true)}
          >
            <Plus size={16} strokeWidth={2} /> לקוח חדש
          </button>
        </div>
      </div>

      {/* Main Grid List */}
      {loading ? (
        <div className="clients-loading-grid">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton-card"></div>)}
        </div>
      ) : clients.length === 0 ? (
        <div className="empty-state glass-panel">
          <div className="empty-icon"><FolderOpen size={48} /></div>
          <h3>לא נמצאו לקוחות מתאימים</h3>
          <p>התחל להכניס מידע אמיתי של העסק שלך על ידי הוספת ליד חדש.</p>
          <button className="btn btn-primary" onClick={() => setShowAddLead(true)}>
            הוסף לקוח ראשון
          </button>
        </div>
      ) : (
        <div className="clients-grid">
          {clients.map((client) => (
            <div 
              key={client.id} 
              className={`client-card glass-panel border-${client.status}`}
              onClick={() => fetchClientDetails(client.id)}
              tabIndex="0"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fetchClientDetails(client.id);
                }
              }}
              role="button"
              aria-label={`פרטי לקוח: ${client.name}`}
            >
              <div className="client-card-header">
                <span className={`badge badge-${client.status}`}>{translateStatus(client.status)}</span>
                <span className="client-value text-mono">{formatCurrency(client.deal_value)}</span>
              </div>
              <h4 className="client-name"><bdi>{client.name}</bdi></h4>
              <p className="client-company">{client.company || 'ללא חברה'}</p>
              
              <div className="client-card-footer text-mono">
                <span className="client-contact">
                  <Phone size={12} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '4px', verticalAlign: 'text-bottom' }} />
                  <bdi>{client.phone || '-'}</bdi>
                </span>
                <span className="client-source-tag">
                  <Tag size={12} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '4px', verticalAlign: 'text-bottom' }} />
                  {client.source}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Client Detail Drawer (Slides from the right edge logically) */}
      {selectedClient && (
        <div className="drawer-overlay" onClick={() => setSelectedClient(null)}>
          <div 
            ref={drawerRef}
            className="client-drawer glass-panel" 
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="drawer-header">
              <div className="drawer-title-group">
                <h2><bdi>{selectedClient.name}</bdi></h2>
                <p>{selectedClient.company || 'ללא חברה'}</p>
              </div>
              <button className="drawer-close" onClick={() => setSelectedClient(null)} aria-label="סגור">
                <X size={18} />
              </button>
            </div>

            <div className="drawer-tabs text-mono">
              <button 
                className={`tab-btn ${!isEditing ? 'active' : ''}`} 
                onClick={() => setIsEditing(false)}
              >
                כרטיס לקוח
              </button>
              <button 
                className={`tab-btn ${isEditing ? 'active' : ''}`} 
                onClick={() => setIsEditing(true)}
              >
                ערוך פרטים
              </button>
            </div>

            <div className="drawer-content">
              {!isEditing ? (
                // View Mode
                <div className="view-mode-container">
                  <div className="detail-section info-card glass-panel">
                    <div className="info-grid">
                      <div>
                        <span className="info-label">טלפון</span>
                        <p className="info-val text-mono"><bdi>{selectedClient.phone || '-'}</bdi></p>
                      </div>
                      <div>
                        <span className="info-label">אימייל</span>
                        <p className="info-val text-mono"><bdi>{selectedClient.email || '-'}</bdi></p>
                      </div>
                      <div>
                        <span className="info-label">שווי עבודה</span>
                        <p className="info-val text-won text-mono">{formatCurrency(selectedClient.deal_value)}</p>
                      </div>
                      <div>
                        <span className="info-label">מקור הגעה</span>
                        <p className="info-val">{selectedClient.source}</p>
                      </div>
                    </div>
                    {selectedClient.notes && (
                      <div className="general-notes">
                        <span className="info-label">תיאור ופרטים נוספים</span>
                        <p className="info-notes-content">{selectedClient.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Documents & Files Section */}
                  <div className="detail-section">
                    <h3>מסמכים וקבצים</h3>
                    <div className="files-panel glass-panel">
                      <div className="upload-trigger-container">
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileUpload} 
                          style={{ display: 'none' }} 
                        />
                        <button 
                          type="button" 
                          className="btn btn-secondary w-full"
                          onClick={() => fileInputRef.current.click()}
                        >
                          <Upload size={14} /> העלה מסמך חדש
                        </button>
                      </div>

                      {selectedClient.documents?.length === 0 ? (
                        <p className="empty-files-text">אין מסמכים מצורפים ללקוח זה.</p>
                      ) : (
                        <ul className="docs-list">
                          {selectedClient.documents?.map(doc => (
                            <li key={doc.id} className="doc-item">
                              <a 
                                href={`/uploads/${doc.file_path.split('/').pop()}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="doc-link"
                              >
                                <FileText size={14} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '6px', verticalAlign: 'text-bottom' }} /> <bdi>{doc.file_name}</bdi>
                                <span className="doc-size text-mono">({(doc.file_size / 1024).toFixed(1)} KB)</span>
                              </a>
                              <button 
                                className="doc-delete-btn" 
                                onClick={() => handleDeleteDoc(doc.id)}
                                aria-label="מחק מסמך"
                              >
                                <Trash2 size={14} className="text-danger" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Tasks Section */}
                  <div className="detail-section">
                    <h3>משימות משויכות</h3>
                    <div className="tasks-panel glass-panel">
                      <form onSubmit={handleAddClientTask} className="quick-task-form">
                        <input 
                          type="text" 
                          placeholder="משימה חדשה..." 
                          value={newTask.title}
                          onChange={e => setNewTask({...newTask, title: e.target.value})}
                          className="input-glass"
                          required
                        />
                        <input 
                          type="date" 
                          value={newTask.due_date}
                          onChange={e => setNewTask({...newTask, due_date: e.target.value})}
                          className="input-glass text-mono"
                        />
                        <button type="submit" className="btn btn-primary">הוסף</button>
                      </form>

                      {selectedClient.tasks?.length === 0 ? (
                        <p className="empty-files-text">אין משימות פתוחות ללקוח זה.</p>
                      ) : (
                        <ul className="client-tasks-list">
                          {selectedClient.tasks?.map(task => (
                            <li key={task.id} className={`client-task-item ${task.status}`}>
                              <span className="task-bullet"></span>
                              <div className="task-title-wrap">
                                <p className="task-name">{task.title}</p>
                                {task.due_date && (
                                  <span className="task-time text-mono">לתאריך: {new Date(task.due_date).toLocaleDateString('he-IL')}</span>
                                )}
                              </div>
                              <span className={`task-status-tag ${task.status} text-mono`}>
                                {task.status === 'completed' ? 'הושלם' : 'פתוח'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Interactions / Notes History */}
                  <div className="detail-section">
                    <h3>היסטוריית פעילות</h3>
                    <div className="activity-panel glass-panel">
                      <form onSubmit={handleAddNote} className="note-form">
                        <textarea 
                          placeholder="תיעוד שיחה או סיכום פגישה..."
                          value={newNote.content}
                          onChange={e => setNewNote({...newNote, content: e.target.value})}
                          className="input-glass note-textarea"
                          rows="3"
                          required
                        ></textarea>
                        <div className="note-form-actions">
                          <select 
                            value={newNote.type} 
                            onChange={e => setNewNote({...newNote, type: e.target.value})}
                            className="input-glass note-type-select text-mono"
                          >
                            <option value="note">הערה</option>
                            <option value="call">שיחת טלפון</option>
                            <option value="email">מייל</option>
                            <option value="meeting">פגישה</option>
                          </select>
                          <button type="submit" className="btn btn-primary">שמור</button>
                        </div>
                      </form>

                      <div className="notes-timeline">
                        {selectedClient.notes?.map(note => (
                          <div key={note.id} className="timeline-item">
                            <div className="timeline-badge">
                              {note.type === 'call' && <Phone size={10} />}
                              {note.type === 'email' && <Mail size={10} />}
                              {note.type === 'meeting' && <Users size={10} />}
                              {note.type === 'note' && <FileText size={10} />}
                            </div>
                            <div className="timeline-card glass-panel">
                              <p className="timeline-content">{note.content}</p>
                              <span className="timeline-date text-mono">
                                {new Date(note.created_at).toLocaleString('he-IL', {
                                  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Edit Mode
                <form onSubmit={handleUpdateClient} className="edit-form">
                  <div className="form-group">
                    <label>שם מלא *</label>
                    <input 
                      type="text" 
                      required 
                      value={editForm.name}
                      onChange={e => setEditForm({...editForm, name: e.target.value})}
                      className="input-glass text-mono"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>חברה / עסק</label>
                    <input 
                      type="text" 
                      value={editForm.company || ''}
                      onChange={e => setEditForm({...editForm, company: e.target.value})}
                      className="input-glass text-mono"
                    />
                  </div>

                  <div className="form-group-row">
                    <div className="form-group">
                      <label>טלפון</label>
                      <input 
                        type="tel" 
                        value={editForm.phone || ''}
                        onChange={e => setEditForm({...editForm, phone: e.target.value})}
                        className="input-glass text-mono"
                      />
                    </div>
                    <div className="form-group">
                      <label>אימייל</label>
                      <input 
                        type="email" 
                        value={editForm.email || ''}
                        onChange={e => setEditForm({...editForm, email: e.target.value})}
                        className="input-glass text-mono"
                      />
                    </div>
                  </div>

                  <div className="form-group-row">
                    <div className="form-group">
                      <label>סטטוס לקוח</label>
                      <select 
                        value={editForm.status} 
                        onChange={e => setEditForm({...editForm, status: e.target.value})}
                        className="input-glass text-mono"
                      >
                        <option value="lead">ליד</option>
                        <option value="contacted">יצירת קשר</option>
                        <option value="proposal">הצעת מחיר</option>
                        <option value="negotiation">משא ומתן</option>
                        <option value="won">עסקה נסגרה (Won)</option>
                        <option value="lost">עסקה אבודה (Lost)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>שווי עסקה (₪)</label>
                      <input 
                        type="number" 
                        value={editForm.deal_value || ''}
                        onChange={e => setEditForm({...editForm, deal_value: e.target.value})}
                        className="input-glass text-mono"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>מקור הגעה</label>
                    <select 
                      value={editForm.source} 
                      onChange={e => setEditForm({...editForm, source: e.target.value})}
                      className="input-glass text-mono"
                    >
                      <option value="פייסבוק">פייסבוק</option>
                      <option value="אינסטגרם">אינסטגרם</option>
                      <option value="גוגל">גוגל</option>
                      <option value="המלצה">המלצה</option>
                      <option value="אורגני">אורגני</option>
                      <option value="אחר">אחר</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>תיאור והערות כלליות</label>
                    <textarea 
                      value={editForm.notes || ''}
                      onChange={e => setEditForm({...editForm, notes: e.target.value})}
                      className="input-glass text-mono"
                      rows="4"
                    ></textarea>
                  </div>

                  <div className="edit-form-actions">
                    <button type="submit" className="btn btn-primary">שמור שינויים</button>
                    <button 
                      type="button" 
                      className="btn btn-danger"
                      onClick={handleDeleteClient}
                    >
                      <Trash2 size={14} /> מחק לקוח
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLead && (
        <div className="modal-overlay">
          <div 
            ref={addLeadModalRef}
            className="modal-content glass-panel"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h2>הוספת לקוח חדש</h2>
              <button className="modal-close-btn" onClick={() => setShowAddLead(false)} aria-label="סגור חלון">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateLead} className="lead-form">
              <div className="form-group">
                <label>שם מלא *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="ישראל ישראלי" 
                  value={newLead.name}
                  onChange={e => setNewLead({...newLead, name: e.target.value})}
                  className="input-glass"
                />
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label>חברה</label>
                  <input 
                    type="text" 
                    placeholder='חברה בע"מ' 
                    value={newLead.company}
                    onChange={e => setNewLead({...newLead, company: e.target.value})}
                    className="input-glass"
                  />
                </div>
                <div className="form-group">
                  <label>ערך עסקה מוערך (₪)</label>
                  <input 
                    type="number" 
                    placeholder="10,000" 
                    value={newLead.deal_value}
                    onChange={e => setNewLead({...newLead, deal_value: e.target.value})}
                    className="input-glass"
                  />
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label>טלפון</label>
                  <input 
                    type="tel" 
                    placeholder="054-0000000" 
                    value={newLead.phone}
                    onChange={e => setNewLead({...newLead, phone: e.target.value})}
                    className="input-glass"
                  />
                </div>
                <div className="form-group">
                  <label>אימייל</label>
                  <input 
                    type="email" 
                    placeholder="email@example.com" 
                    value={newLead.email}
                    onChange={e => setNewLead({...newLead, email: e.target.value})}
                    className="input-glass"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>מקור הגעה</label>
                <select 
                  value={newLead.source} 
                  onChange={e => setNewLead({...newLead, source: e.target.value})}
                  className="input-glass text-mono"
                >
                  <option value="פייסבוק">פייסבוק</option>
                  <option value="אינסטגרם">אינסטגרם</option>
                  <option value="גוגל">גוגל</option>
                  <option value="המלצה">המלצה</option>
                  <option value="אורגני">אורגני</option>
                  <option value="אחר">אחר</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">שמור ליד</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddLead(false)}>ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .clients-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .clients-filter-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          gap: 20px;
          border-radius: 8px;
        }

        .search-box-container {
          position: relative;
          flex: 1;
        }

        .search-icon {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 14px;
          color: var(--text-muted);
        }

        .search-input {
          padding-right: 44px;
        }

        .filter-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .status-select {
          width: 140px;
        }

        .clients-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .clients-loading-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .client-card {
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          cursor: pointer;
          border-radius: 6px;
          transition: var(--transition-fast);
        }

        .client-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .client-value {
          font-weight: 700;
          color: #ffffff;
          font-size: 14px;
        }

        .client-name {
          font-size: 18px;
          font-family: var(--font-display-he);
          color: #ffffff;
        }

        .client-company {
          font-size: 13px;
          color: var(--text-muted);
        }

        .client-card-footer {
          margin-top: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid var(--border-muted);
          padding-top: 12px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .border-lead { border-right: 4px solid var(--color-status-lead); }
        .border-contacted { border-right: 4px solid var(--color-status-contacted); }
        .border-proposal { border-right: 4px solid var(--color-status-proposal); }
        .border-negotiation { border-right: 4px solid var(--color-status-negotiation); }
        .border-won { border-right: 4px solid var(--color-status-won); }
        .border-lost { border-right: 4px solid var(--color-status-lost); }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
          text-align: center;
          gap: 16px;
          border-radius: 8px;
        }

        .empty-icon {
          font-size: 48px;
        }

        /* Drawer Overlay */
        .drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(2px);
          z-index: 1000;
          display: flex;
          justify-content: flex-end;
          flex-direction: row;
        }

        .client-drawer {
          width: 500px;
          height: 100vh;
          max-width: 100vw;
          border-radius: 0;
          border-top: none;
          border-bottom: none;
          display: flex;
          flex-direction: column;
          box-shadow: -10px 0 30px rgba(0,0,0,0.6);
          animation: slide-drawer 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          background-color: var(--bg-sidebar);
        }

        @keyframes slide-drawer {
          from { transform: translateX(100%); } /* Slide from right */
          to { transform: translateX(0); }
        }

        /* Enforce sliding in from the right edge in RTL */
        [dir="rtl"] .client-drawer {
          animation: slide-drawer-rtl 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes slide-drawer-rtl {
          from { transform: translateX(-100%); } /* Slide from left */
          to { transform: translateX(0); }
        }

        .drawer-header {
          padding: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-muted);
        }

        .drawer-title-group h2 {
          font-size: 20px;
          font-family: var(--font-display-he);
          color: #ffffff;
        }

        .drawer-title-group p {
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .drawer-close {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 20px;
          cursor: pointer;
        }

        .drawer-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-muted);
          background: rgba(0, 0, 0, 0.15);
        }

        .tab-btn {
          flex: 1;
          padding: 14px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-family: var(--font-display-he);
          font-size: 13px;
          transition: var(--transition-fast);
        }

        .tab-btn.active {
          color: var(--color-primary);
          background: rgba(79, 70, 229, 0.06);
          border-bottom: 2px solid var(--color-primary);
        }

        .drawer-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .detail-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .detail-section h3 {
          font-size: 15px;
          font-family: var(--font-display-he);
          color: #ffffff;
        }

        .info-card {
          padding: 20px;
          border-radius: 6px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .info-label {
          font-size: 11px;
          color: var(--text-muted);
          display: block;
          margin-bottom: 4px;
        }

        .info-val {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
        }

        .general-notes {
          margin-top: 18px;
          border-top: 1px solid var(--border-muted);
          padding-top: 14px;
        }

        .info-notes-content {
          font-size: 13px;
          color: var(--text-main);
          white-space: pre-wrap;
          line-height: 1.5;
        }

        /* Files Panel */
        .files-panel, .tasks-panel, .activity-panel {
          padding: 18px;
          border-radius: 6px;
        }

        .upload-trigger-container {
          margin-bottom: 12px;
        }

        .w-full {
          width: 100%;
        }

        .empty-files-text {
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
          padding: 10px 0;
        }

        .docs-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .doc-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--border-muted);
          border-radius: 4px;
        }

        .doc-link {
          color: var(--text-main);
          text-decoration: none;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .doc-link:hover {
          color: var(--color-primary);
        }

        .doc-size {
          font-size: 10px;
          color: var(--text-muted);
        }

        .doc-delete-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 12px;
        }

        /* Tasks Form & List in Drawer */
        .quick-task-form {
          display: grid;
          grid-template-columns: 2fr 1.2fr auto;
          gap: 8px;
          margin-bottom: 14px;
        }

        .client-tasks-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .client-task-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          border: 1px solid var(--border-muted);
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.01);
        }

        .client-task-item.completed {
          opacity: 0.6;
        }

        .task-bullet {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--color-primary);
        }

        .client-task-item.completed .task-bullet {
          background: var(--color-success);
        }

        .task-title-wrap {
          flex: 1;
        }

        .task-name {
          font-size: 13px;
          color: #ffffff;
        }

        .task-time {
          font-size: 10px;
          color: var(--text-muted);
          display: block;
          margin-top: 2px;
        }

        .task-status-tag {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .task-status-tag.pending { background: rgba(59, 130, 246, 0.1); color: #60a5fa; }
        .task-status-tag.completed { background: rgba(16, 185, 129, 0.1); color: #34d399; }

        /* Notes Timeline */
        .note-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }

        .note-textarea {
          resize: none;
        }

        .note-form-actions {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .note-type-select {
          width: 120px;
        }

        .notes-timeline {
          display: flex;
          flex-direction: column;
          gap: 16px;
          position: relative;
          padding-right: 16px;
        }

        .notes-timeline::after {
          content: '';
          position: absolute;
          right: 6px;
          top: 8px;
          bottom: 8px;
          width: 1px;
          background: var(--border-muted);
        }

        .timeline-item {
          display: flex;
          gap: 14px;
          position: relative;
        }

        .timeline-badge {
          width: 20px;
          height: 20px;
          background: var(--bg-app);
          border: 1px solid var(--border-muted);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          z-index: 2;
          position: absolute;
          right: -4px;
          top: 10px;
        }

        .timeline-card {
          flex: 1;
          padding: 12px 16px;
          margin-right: 20px;
          border-radius: 4px;
        }

        .timeline-content {
          font-size: 13px;
          line-height: 1.5;
          color: #ffffff;
        }

        .timeline-date {
          font-size: 10px;
          color: var(--text-muted);
          display: block;
          margin-top: 6px;
          text-align: left;
        }

        /* Edit Form style */
        .edit-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .edit-form-actions {
          display: flex;
          justify-content: space-between;
          margin-top: 14px;
        }

        @media (max-width: 768px) {
          .clients-filter-bar {
            flex-direction: column;
            align-items: stretch;
            padding: 14px;
          }
          .filter-actions {
            justify-content: space-between;
          }
          .status-select {
            flex: 1;
          }
          .client-drawer {
            width: 100vw;
          }
          .quick-task-form {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Clients;
