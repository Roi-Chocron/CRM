import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../components/Toast';
import { Plus, Calendar as CalendarIcon, User, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';

const Calendar = () => {
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null); // format: YYYY-MM-DD
  const [showAddTask, setShowAddTask] = useState(false);
  const { showToast } = useToast();

  const modalRef = useRef(null);
  const openTriggerRef = useRef(null);

  // New task form state
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    due_date: '',
    client_id: ''
  });

  const fetchData = async () => {
    try {
      const tasksRes = await fetch('/api/tasks');
      const tasksData = await tasksRes.json();
      setTasks(tasksData);

      const clientsRes = await fetch('/api/clients');
      const clientsData = await clientsRes.json();
      setClients(clientsData);
    } catch (error) {
      showToast('שגיאה בטעינת המשימות והיומן', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Modal Focus Trap and Escape key handler
  useEffect(() => {
    if (!showAddTask) {
      if (openTriggerRef.current) {
        openTriggerRef.current.focus();
      }
      return;
    }

    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex="0"]'
    );
    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowAddTask(false);
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
  }, [showAddTask]);

  const handleToggleTask = async (task) => {
    const nextStatus = task.status === 'pending' ? 'completed' : 'pending';
    
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        showToast('המשימה עודכנה בהצלחה');
        fetchData();
      } else {
        throw new Error('Failed to update task');
      }
    } catch (error) {
      showToast('שגיאה בעדכון המשימה', 'error');
      fetchData(); // Rollback
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('האם למחוק משימה זו?')) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('המשימה נמחקה בהצלחה');
        fetchData();
      }
    } catch (error) {
      showToast('שגיאה במחיקת המשימה', 'error');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTask,
          client_id: newTask.client_id ? parseInt(newTask.client_id) : null,
          due_date: newTask.due_date ? new Date(newTask.due_date).toISOString() : null
        })
      });

      if (res.ok) {
        showToast('משימה חדשה נוצרה');
        setShowAddTask(false);
        setSelectedDay(null);
        setNewTask({ title: '', description: '', due_date: '', client_id: '' });
        fetchData();
      } else {
        showToast('שגיאה ביצירת המשימה', 'error');
      }
    } catch (error) {
      showToast('שגיאה בחיבור לשרת', 'error');
    }
  };

  const openAddTaskForDate = (dateStr) => {
    setNewTask({
      title: '',
      description: '',
      due_date: dateStr,
      client_id: ''
    });
    setSelectedDay(dateStr);
    setShowAddTask(true);
  };

  // Calendar logic helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getDayTasks = (year, month, day) => {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.filter(t => {
      if (!t.due_date) return false;
      const tDate = new Date(t.due_date);
      const tStr = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}-${String(tDate.getDate()).padStart(2, '0')}`;
      return tStr === dateString;
    });
  };

  const renderCalendarDays = () => {
    const days = [];
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Empty cells before first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayTasks = getDayTasks(year, month, day);
      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

      days.push(
        <div 
          key={day} 
          className={`calendar-day ${isToday ? 'today' : ''} glass-panel`}
          onClick={() => openAddTaskForDate(dateString)}
        >
          <span className="day-number text-mono">{day}</span>
          <div className="day-tasks-dots">
            {dayTasks.map(t => (
              <span 
                key={t.id} 
                className={`task-dot ${t.status}`}
                title={t.title}
              ></span>
            ))}
          </div>
        </div>
      );
    }

    return days;
  };

  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  const pendingTasksCount = tasks.filter(t => t.status === 'pending').length;
  const completedTasksCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="calendar-page">
      <div className="calendar-layout-grid">
        
        {/* Left Side: Tasks List Panel */}
        <div className="tasks-panel-col glass-panel">
          <div className="panel-header">
            <h3>משימות</h3>
            <button 
              ref={openTriggerRef}
              className="btn btn-primary" 
              onClick={() => {
                setNewTask({ title: '', description: '', due_date: '', client_id: '' });
                setSelectedDay(null);
                setShowAddTask(true);
              }}
            >
              <Plus size={16} strokeWidth={2} />
              משימה חדשה
            </button>
          </div>

          {loading ? (
            <div className="skeleton-card"></div>
          ) : tasks.length === 0 ? (
            <div className="empty-tasks-text">אין משימות במערכת.</div>
          ) : (
            <div className="tasks-lists-wrapper">
              <div className="tasks-section-list">
                <h4 className="list-section-title">
                  לביצוע (<bdi>{pendingTasksCount}</bdi>)
                </h4>
                <ul className="calendar-tasks-list">
                  {tasks.filter(t => t.status === 'pending').map(task => (
                    <li key={task.id} className="calendar-task-item glass-panel">
                      <label className="checkbox-wrap">
                        <input 
                          type="checkbox" 
                          checked={task.status === 'completed'}
                          onChange={() => handleToggleTask(task)} 
                        />
                        <span className="checkbox-checkmark"></span>
                      </label>
                      
                      <div className="task-content">
                        <p className="task-title">{task.title}</p>
                        {task.description && <p className="task-desc">{task.description}</p>}
                        
                        <div className="task-meta-row">
                          {task.due_date && (
                            <span className="meta-tag text-mono">
                              <CalendarIcon size={12} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '4px', verticalAlign: 'text-bottom' }} />
                              <bdi>{new Date(task.due_date).toLocaleDateString('he-IL')}</bdi>
                            </span>
                          )}
                          {task.client_name && (
                            <span className="meta-tag client-tag">
                              <User size={12} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '4px', verticalAlign: 'text-bottom' }} />
                              {task.client_name}
                            </span>
                          )}
                        </div>
                      </div>

                      <button 
                        className="task-delete-btn" 
                        onClick={() => handleDeleteTask(task.id)}
                        aria-label="מחק משימה"
                      >
                        <Trash2 size={14} className="text-danger" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="tasks-section-list completed">
                <h4 className="list-section-title">
                  הושלמו (<bdi>{completedTasksCount}</bdi>)
                </h4>
                <ul className="calendar-tasks-list">
                  {tasks.filter(t => t.status === 'completed').map(task => (
                    <li key={task.id} className="calendar-task-item completed glass-panel">
                      <label className="checkbox-wrap">
                        <input 
                          type="checkbox" 
                          checked={task.status === 'completed'}
                          onChange={() => handleToggleTask(task)} 
                        />
                        <span className="checkbox-checkmark"></span>
                      </label>
                      <div className="task-content">
                        <p className="task-title">{task.title}</p>
                      </div>
                      <button 
                        className="task-delete-btn" 
                        onClick={() => handleDeleteTask(task.id)}
                        aria-label="מחק משימה"
                      >
                        <Trash2 size={14} className="text-danger" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Calendar Grid Panel */}
        <div className="calendar-panel-col glass-panel">
          <div className="calendar-nav-header">
            <button className="btn btn-secondary" onClick={handlePrevMonth} aria-label="חודש קודם">
              <ChevronRight size={16} />
            </button>
            <h2 className="current-month-label">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button className="btn btn-secondary" onClick={handleNextMonth} aria-label="חודש הבא">
              <ChevronLeft size={16} />
            </button>
          </div>

          <div className="calendar-grid-wrapper">
            <div className="weekday-header">
              <div>ראשון</div>
              <div>שני</div>
              <div>שלישי</div>
              <div>רביעי</div>
              <div>חמישי</div>
              <div>שישי</div>
              <div>שבת</div>
            </div>

            <div className="calendar-days-grid">
              {renderCalendarDays()}
            </div>
          </div>
        </div>

      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="modal-overlay">
          <div 
            className="modal-content glass-panel" 
            ref={modalRef}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h2>
                {selectedDay 
                  ? `משימה לתאריך ${new Date(selectedDay).toLocaleDateString('he-IL')}`
                  : 'הוספת משימה חדשה'
                }
              </h2>
              <button className="modal-close-btn" onClick={() => setShowAddTask(false)} aria-label="סגור חלון">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateTask} className="lead-form">
              <div className="form-group">
                <label htmlFor="task-title-input">כותרת המשימה *</label>
                <input 
                  id="task-title-input"
                  type="text" 
                  required 
                  placeholder="לדוגמה: שליחת הצעת מחיר סופית" 
                  value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  className="input-glass"
                />
              </div>

              <div className="form-group">
                <label htmlFor="task-desc-input">תיאור</label>
                <textarea 
                  id="task-desc-input"
                  placeholder="פרטים נוספים על המשימה..." 
                  value={newTask.description}
                  onChange={e => setNewTask({...newTask, description: e.target.value})}
                  className="input-glass"
                  rows="3"
                ></textarea>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label htmlFor="task-date-input">תאריך יעד</label>
                  <input 
                    id="task-date-input"
                    type="date" 
                    value={newTask.due_date}
                    onChange={e => setNewTask({...newTask, due_date: e.target.value})}
                    className="input-glass"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="task-client-select">שיוך לקוח / ליד</label>
                  <select 
                    id="task-client-select"
                    value={newTask.client_id}
                    onChange={e => setNewTask({...newTask, client_id: e.target.value})}
                    className="input-glass"
                  >
                    <option value="">ללא לקוח (משימה כללית)</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">שמור משימה</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddTask(false)}>ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .calendar-page {
          height: 100%;
        }

        .calendar-layout-grid {
          display: grid;
          grid-template-columns: 1.2fr 2fr;
          gap: 24px;
          height: calc(100vh - 150px);
        }

        .tasks-panel-col {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          overflow-y: auto;
          background-color: var(--bg-card);
          border-radius: 6px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-muted);
          padding-bottom: 14px;
        }

        .panel-header h3 {
          font-family: var(--font-display-he);
          font-size: 16px;
          color: #ffffff;
        }

        .tasks-lists-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .list-section-title {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .calendar-tasks-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .calendar-task-item {
          padding: 14px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--border-muted);
          border-radius: 6px;
          transition: var(--transition-fast);
        }

        .calendar-task-item:hover {
          background: var(--bg-card-hover);
          border-color: var(--color-primary);
        }

        .calendar-task-item.completed {
          opacity: 0.5;
        }

        .checkbox-wrap {
          position: relative;
          width: 18px;
          height: 18px;
          cursor: pointer;
          margin-top: 2px;
        }

        .checkbox-wrap input {
          position: absolute;
          opacity: 0;
          cursor: pointer;
          height: 0;
          width: 0;
        }

        .checkbox-checkmark {
          position: absolute;
          top: 0;
          left: 0;
          height: 18px;
          width: 18px;
          background-color: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-muted);
          border-radius: 4px;
          transition: var(--transition-fast);
        }

        .checkbox-wrap input:checked ~ .checkbox-checkmark {
          background-color: var(--color-success);
          border-color: var(--color-success);
        }

        .checkbox-checkmark:after {
          content: "";
          position: absolute;
          display: none;
        }

        .checkbox-wrap input:checked ~ .checkbox-checkmark:after {
          display: block;
        }

        .checkbox-wrap .checkbox-checkmark:after {
          left: 5px;
          top: 1.5px;
          width: 4px;
          height: 9px;
          border: solid #000000;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }

        .task-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .task-title {
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
        }

        .task-desc {
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1.4;
        }

        .task-meta-row {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .meta-tag {
          font-size: 10px;
          padding: 2px 6px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 4px;
          color: var(--text-muted);
          border: 1px solid var(--border-muted);
        }

        .meta-tag.client-tag {
          color: var(--color-primary);
          background: rgba(79, 70, 229, 0.08);
          border-color: rgba(79, 70, 229, 0.15);
        }

        .task-delete-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 12px;
          opacity: 0.5;
          padding: 4px;
          border-radius: 4px;
          transition: var(--transition-fast);
        }

        .task-delete-btn:hover {
          opacity: 1;
          background: rgba(255, 255, 255, 0.05);
        }

        /* Calendar Grid Panel */
        .calendar-panel-col {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          background-color: var(--bg-card);
          border-radius: 6px;
        }

        .calendar-nav-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-muted);
          padding-bottom: 14px;
        }

        .current-month-label {
          font-family: var(--font-display-he);
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
        }

        .calendar-grid-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .weekday-header {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          padding-bottom: 10px;
        }

        .calendar-days-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          grid-auto-rows: 1fr;
          gap: 8px;
          flex: 1;
        }

        .calendar-day {
          min-height: 64px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: flex-end;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--border-muted);
          border-radius: 6px;
          transition: var(--transition-fast);
        }

        .calendar-day:hover {
          background: var(--bg-card-hover);
          border-color: var(--color-primary);
        }

        .calendar-day.empty {
          background: transparent;
          border: none;
          cursor: default;
          pointer-events: none;
        }

        .calendar-day.today {
          border: 1px solid var(--color-primary);
          background: rgba(79, 70, 229, 0.04);
          box-shadow: 0 0 10px rgba(79, 70, 229, 0.1);
        }

        .day-number {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
        }

        .calendar-day.today .day-number {
          color: var(--color-primary);
          font-weight: 700;
        }

        .day-tasks-dots {
          display: flex;
          gap: 4px;
          width: 100%;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .task-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }

        .task-dot.pending { background-color: var(--color-primary); }
        .task-dot.completed { background-color: var(--color-success); }

        .empty-tasks-text {
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
          padding: 30px 0;
        }

        /* Modals accessibility properties */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          width: 500px;
          max-width: calc(100% - 32px);
          padding: 30px;
          border-radius: 6px;
          background-color: var(--bg-card);
          border: 1px solid var(--border-muted);
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: var(--shadow-active);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-muted);
          padding-bottom: 12px;
        }

        .modal-header h2 {
          font-family: var(--font-display-he);
          font-size: 16px;
          color: #ffffff;
        }

        .modal-close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 18px;
          cursor: pointer;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: var(--transition-fast);
        }

        .modal-close-btn:hover {
          color: #ffffff;
          background-color: rgba(255, 255, 255, 0.05);
        }

        .lead-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-group label {
          font-size: 11px;
          color: var(--text-muted);
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 10px;
        }

        @media (max-width: 992px) {
          .calendar-layout-grid {
            grid-template-columns: 1fr;
            height: auto;
          }
          
          .calendar-day {
            min-height: 50px;
          }
        }
      `}</style>
    </div>
  );
};

export default Calendar;
