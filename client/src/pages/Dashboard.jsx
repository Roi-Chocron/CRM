import React, { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import { Plus, Calendar, Coins, TrendingUp, Users, Target, CheckCircle, X } from 'lucide-react';
import { API_URL } from '../config';

const Dashboard = ({ setActiveClient, setCurrentPage }) => {
  const [stats, setStats] = useState(null);
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddLead, setShowAddLead] = useState(false);
  const { showToast } = useToast();

  // New Lead Form State
  const [newLead, setNewLead] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    deal_value: '',
    source: 'פייסבוק',
    status: 'lead'
  });

  const fetchDashboardData = async () => {
    try {
      const statsRes = await fetch(`${API_URL}/api/stats`);
      const statsData = await statsRes.json();
      setStats(statsData);

      const tasksRes = await fetch(`${API_URL}/api/tasks`);
      const tasksData = await tasksRes.json();
      setRecentTasks(tasksData.filter(t => t.status === 'pending').slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      showToast('שגיאה בטעינת נתוני ה-Dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleToggleTask = async (task) => {
    try {
      const updatedStatus = task.status === 'pending' ? 'completed' : 'pending';
      const res = await fetch(`${API_URL}/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: updatedStatus })
      });
      if (res.ok) {
        showToast('המשימה עודכנה בהצלחה');
        fetchDashboardData();
      }
    } catch (error) {
      showToast('שגיאה בעדכון המשימה', 'error');
    }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!newLead.name) return;

    try {
      const res = await fetch(`${API_URL}/api/clients`, {
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
          name: '',
          company: '',
          phone: '',
          email: '',
          deal_value: '',
          source: 'פייסבוק',
          status: 'lead'
        });
        fetchDashboardData();
      } else {
        showToast('שגיאה ביצירת הליד', 'error');
      }
    } catch (error) {
      showToast('שגיאה בחיבור לשרת', 'error');
    }
  };

  if (loading) {
    return (
      <div className="skeleton-container">
        <div className="skeleton-card header"></div>
        <div className="skeleton-grid">
          <div className="skeleton-card"></div>
          <div className="skeleton-card"></div>
        </div>
      </div>
    );
  }

  // BiDi isolated formatter
  const formatCurrency = (val) => {
    const formatted = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(val || 0);
    return `\u2066${formatted}\u2069`;
  };

  const formatNumber = (val) => {
    const formatted = new Intl.NumberFormat('he-IL').format(val || 0);
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
    <div className="dashboard-page">
      {/* Brand Hero Grid Pattern */}
      <div className="brand-hero-grid glass-panel">
        <div className="hero-watermark text-brand-en">SYSTEM</div>
        <div className="hero-text-col">
          <span className="hero-meta text-mono">PROJECT_MASCOT_PIXEL</span>
          <h2>שלום רועי, ברוך הבא למערכת הניהול שלך</h2>
          <p className="hero-desc">
            מערכת ה-CRM מותאמת באופן מלא לזהות המותג שלך, תוך שימוש במדדים א-סימטריים, 
            נתונים מבודדי כיווניות וכלים מתקדמים לניהול לקוחות, משימות וקבצים.
          </p>
          <div className="hero-ctas">
            <button className="btn btn-primary" onClick={() => setShowAddLead(true)}>
              <Plus size={16} strokeWidth={2} />
              רישום ליד חדש
            </button>
            <button className="btn btn-secondary" onClick={() => setCurrentPage('calendar')}>
              <Calendar size={16} strokeWidth={2} />
              הצג משימות
            </button>
          </div>
        </div>
        <div className="hero-visual-col">
          <img src="/mascot.png" alt="Pixel the Cyber Owl" className="mascot-img" />
        </div>
      </div>

      {/* Asymmetrical Metrics Layout */}
      <div className="metrics-asymmetric-layout">
        
        {/* Right Side: Hero Card (Revenue) */}
        <div className="metric-hero-card glass-panel border-won">
          <div className="hero-icon-wrap">
            <Coins size={32} className="text-won" />
          </div>
          <div className="hero-content">
            <span className="metric-label">הכנסות שנסגרו בהצלחה (Won)</span>
            <h2 className="metric-value-large text-won text-mono">{formatCurrency(stats?.revenue)}</h2>
            <p className="hero-helper-desc text-mono">STABLE_REVENUE_METRIC</p>
          </div>
        </div>

        {/* Left Side: Subgrid of 3 smaller cards */}
        <div className="metrics-secondary-subgrid">
          <div className="metric-card glass-panel border-pipeline">
            <div className="metric-icon">
              <TrendingUp size={24} className="text-pipeline" />
            </div>
            <div className="metric-info">
              <span className="metric-label">עסקאות בקנה (Pipeline)</span>
              <h2 className="metric-value text-pipeline text-mono">{formatCurrency(stats?.pipeline)}</h2>
            </div>
          </div>

          <div className="metric-card glass-panel border-leads">
            <div className="metric-icon">
              <Users size={24} style={{ color: '#8b5cf6' }} />
            </div>
            <div className="metric-info">
              <span className="metric-label">לידים ולקוחות פעילים</span>
              <h2 className="metric-value text-mono">{formatNumber(stats?.totalLeads)}</h2>
            </div>
          </div>

          <div className="metric-card glass-panel border-conversion">
            <div className="metric-icon">
              <Target size={24} className="text-conversion" />
            </div>
            <div className="metric-info">
              <span className="metric-label">אחוז המרת לידים</span>
              <h2 className="metric-value text-conversion text-mono">{stats?.conversionRate}%</h2>
            </div>
          </div>
        </div>
        
      </div>

      {/* Main Charts & Actions Row */}
      <div className="dashboard-content">
        {/* Sales Pipeline Distribution */}
        <div className="dashboard-card glass-panel charts-section">
          <h3>התפלגות עסקאות לפי שלב</h3>
          <div className="chart-wrapper">
            <div className="status-bars">
              {['lead', 'contacted', 'proposal', 'negotiation', 'won', 'lost'].map(stage => {
                const stageData = stats?.statusDistribution.find(d => d.status === stage) || { count: 0, value: 0 };
                const maxCount = Math.max(...(stats?.statusDistribution.map(d => d.count) || [1]));
                const percent = maxCount > 0 ? (stageData.count / maxCount) * 100 : 0;
                
                return (
                  <div key={stage} className="chart-bar-row">
                    <div className="bar-label">{translateStatus(stage)}</div>
                    <div className="bar-track">
                      <div 
                        className={`bar-fill bg-status-${stage}`} 
                        style={{ width: `${percent}%` }}
                      >
                        {stageData.count > 0 && <span className="bar-count text-mono">{stageData.count}</span>}
                      </div>
                    </div>
                    <div className="bar-value text-mono">{formatCurrency(stageData.value)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="dashboard-card glass-panel tasks-card">
          <h3>משימות דחופות לביצוע</h3>
          {recentTasks.length === 0 ? (
            <div className="empty-tasks">
              <span><CheckCircle size={24} style={{ color: 'var(--color-success)' }} /></span>
              <p>אין לך משימות פתוחות להיום!</p>
            </div>
          ) : (
            <ul className="tasks-list">
              {recentTasks.map(task => (
                <li key={task.id} className="task-item">
                  <label className="task-checkbox-container">
                    <input 
                      type="checkbox" 
                      checked={task.status === 'completed'} 
                      onChange={() => handleToggleTask(task)}
                    />
                    <span className="task-checkmark"></span>
                  </label>
                  <div className="task-details">
                    <span className="task-title">{task.title}</span>
                    {task.client_name && (
                      <span className="task-client-link">
                        שייך לליד: {task.client_name}
                      </span>
                    )}
                  </div>
                  {task.due_date && (
                    <span className="task-due-date text-mono">
                      {new Date(task.due_date).toLocaleDateString('he-IL', {month: 'numeric', day: 'numeric'})}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddLead && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>הוספת ליד חדש למערכת</h2>
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
                  <label>שם חברה / עסק</label>
                  <input 
                    type="text" 
                    placeholder='טק בע"מ' 
                    value={newLead.company}
                    onChange={e => setNewLead({...newLead, company: e.target.value})}
                    className="input-glass"
                  />
                </div>
                <div className="form-group">
                  <label>שווי עסקה מוערך (₪)</label>
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
                    placeholder="054-1234567" 
                    value={newLead.phone}
                    onChange={e => setNewLead({...newLead, phone: e.target.value})}
                    className="input-glass"
                  />
                </div>
                <div className="form-group">
                  <label>אימייל</label>
                  <input 
                    type="email" 
                    placeholder="name@company.com" 
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
                  className="input-glass"
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
                <button type="submit" className="btn btn-primary">צור ליד</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddLead(false)}>ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .dashboard-page {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        /* Hero Grid Pattern */
        .brand-hero-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 30px;
          padding: 40px;
          border-radius: 8px;
          position: relative;
          overflow: hidden;
          background-color: var(--bg-card);
        }

        .hero-watermark {
          position: absolute;
          right: -20px;
          bottom: -30px;
          font-size: 160px;
          color: rgba(255, 255, 255, 0.015);
          font-weight: 900;
          pointer-events: none;
        }

        .hero-text-col {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 16px;
          z-index: 2;
        }

        .hero-meta {
          font-size: 11px;
          color: var(--color-primary);
          font-weight: 700;
          letter-spacing: 0.1em;
        }

        .brand-hero-grid h2 {
          font-size: 32px;
          line-height: 1.25;
        }

        .hero-desc {
          color: var(--text-muted);
          font-size: 15px;
          line-height: 1.6;
          max-width: 600px;
        }

        .hero-ctas {
          display: flex;
          gap: 12px;
          margin-top: 10px;
        }

        .hero-visual-col {
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }

        .mascot-img {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          border: 2px solid var(--color-primary);
          background-color: #0b0f19;
          object-fit: cover;
          box-shadow: 0 0 20px rgba(79, 70, 229, 0.2);
        }

        /* Asymmetric Layout */
        .metrics-asymmetric-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }

        .metric-hero-card {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 30px;
          border-radius: 8px;
        }

        .hero-icon-wrap {
          font-size: 42px;
          background: rgba(255, 255, 255, 0.03);
          width: 72px;
          height: 72px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hero-content {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .metric-value-large {
          font-size: 34px;
          font-weight: 700;
        }

        .hero-helper-desc {
          font-size: 11px;
          color: var(--text-muted);
        }

        .metrics-secondary-subgrid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .metric-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 24px;
          border-radius: 8px;
        }

        .metric-icon {
          font-size: 28px;
          background: rgba(255, 255, 255, 0.04);
          width: 50px;
          height: 50px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .metric-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .metric-label {
          font-size: 12px;
          color: var(--text-muted);
        }

        .metric-value {
          font-size: 24px;
          font-weight: 700;
        }

        .text-won { color: var(--color-success); }
        .text-pipeline { color: var(--color-primary); }
        .text-conversion { color: #ec4899; }

        .border-won { border-right: 4px solid var(--color-success); }
        .border-pipeline { border-right: 4px solid var(--color-primary); }
        .border-leads { border-right: 4px solid #8b5cf6; }
        .border-conversion { border-right: 4px solid #ec4899; }

        .dashboard-content {
          display: grid;
          grid-template-columns: 1.8fr 1.2fr;
          gap: 24px;
        }

        .dashboard-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          border-radius: 8px;
        }

        .dashboard-card h3 {
          font-size: 16px;
          font-family: var(--font-display-he);
          border-bottom: 1px solid var(--border-muted);
          padding-bottom: 12px;
        }

        /* Chart Styles */
        .status-bars {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .chart-bar-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .bar-label {
          width: 90px;
          font-size: 13px;
          color: var(--text-muted);
        }

        .bar-track {
          flex: 1;
          height: 24px;
          background: rgba(255, 255, 255, 0.01);
          border-radius: 4px;
          overflow: hidden;
          border: 1px solid var(--border-muted);
        }

        .bar-fill {
          height: 100%;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-left: 10px;
          font-size: 11px;
          font-weight: 700;
          color: #ffffff;
          transition: width 0.8s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        .bg-status-lead { background-color: #3b82f6; }
        .bg-status-contacted { background-color: #8b5cf6; }
        .bg-status-proposal { background-color: #f59e0b; }
        .bg-status-negotiation { background-color: #ec4899; }
        .bg-status-won { background-color: #10b981; }
        .bg-status-lost { background-color: #ef4444; }

        .bar-count {
          background: rgba(0, 0, 0, 0.2);
          padding: 1px 4px;
          border-radius: 3px;
        }

        .bar-value {
          width: 90px;
          text-align: left;
          font-size: 13px;
          font-weight: 700;
        }

        /* Tasks styling */
        .empty-tasks {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px 0;
          gap: 8px;
          color: var(--text-muted);
        }

        .tasks-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .task-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--border-muted);
          border-radius: 4px;
          transition: var(--transition-fast);
        }

        .task-item:hover {
          background: rgba(255, 255, 255, 0.02);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .task-checkbox-container {
          position: relative;
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .task-checkbox-container input {
          position: absolute;
          opacity: 0;
          cursor: pointer;
          height: 0;
          width: 0;
        }

        .task-checkmark {
          position: absolute;
          top: 0;
          left: 0;
          height: 18px;
          width: 18px;
          background-color: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-muted);
          border-radius: 3px;
          transition: var(--transition-fast);
        }

        .task-checkbox-container input:checked ~ .task-checkmark {
          background-color: var(--color-success);
          border-color: var(--color-success);
        }

        .task-checkmark:after {
          content: "";
          position: absolute;
          display: none;
        }

        .task-checkbox-container input:checked ~ .task-checkmark:after {
          display: block;
        }

        .task-checkbox-container .task-checkmark:after {
          left: 5px;
          top: 1px;
          width: 5px;
          height: 10px;
          border: solid #000;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }

        .task-details {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .task-title {
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
        }

        .task-client-link {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .task-due-date {
          font-size: 11px;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.04);
          padding: 2px 6px;
          border-radius: 2px;
        }

        /* Modals */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          width: 500px;
          max-width: calc(100% - 32px);
          padding: 30px;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-muted);
          padding-bottom: 12px;
        }

        .modal-close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 18px;
          cursor: pointer;
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
          font-size: 12px;
          color: var(--text-muted);
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 10px;
        }

        @media (max-width: 992px) {
          .brand-hero-grid {
            grid-template-columns: 1fr;
            padding: 24px;
          }
          .hero-visual-col {
            display: none;
          }
          .dashboard-content {
            grid-template-columns: 1fr;
          }
        }

        @media (min-width: 768px) {
          .metrics-secondary-subgrid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (min-width: 1200px) {
          .metrics-asymmetric-layout {
            grid-template-columns: 1.2fr 1.8fr;
          }
          .metrics-secondary-subgrid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
