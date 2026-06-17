import React, { useState } from 'react';
import { useToast } from '../components/Toast';
import { Calendar, RefreshCw, Database, Trash2, Download, Save, Info } from 'lucide-react';
import { API_URL } from '../config';

const Settings = () => {
  const { showToast } = useToast();
  const [calendarUrl, setCalendarUrl] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleBackupData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/clients`);
      const data = await res.json();
      
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `crm_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showToast('קובץ גיבוי של הלקוחות הורד בהצלחה!');
    } catch (error) {
      showToast('שגיאה ביצירת הגיבוי', 'error');
    }
  };

  const handleSyncCalendar = async (e) => {
    e.preventDefault();
    if (!calendarUrl.trim()) return;

    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/calendar/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: calendarUrl })
      });
      const data = await res.json();

      if (res.ok) {
        showToast(`סנכרון הושלם! סונכרנו ${data.eventsSynced} משימות, מתוכן ${data.newEventsAdded} חדשות.`);
        setCalendarUrl('');
      } else {
        showToast(data.error || 'שגיאה בסנכרון היומן', 'error');
      }
    } catch (error) {
      showToast('שגיאה בתקשורת עם השרת', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק את כל הנתונים במערכת ולהתחיל מחדש עם בסיס נתונים נקי? פעולה זו אינה הפיכה!')) {
      return;
    }

    setClearing(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/reset`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast('בסיס הנתונים אופס לחלוטין. כעת המערכת נקייה מנתוני הדגמה!');
      } else {
        showToast('שגיאה באיפוס בסיס הנתונים', 'error');
      }
    } catch (error) {
      showToast('שגיאה בתקשורת עם השרת', 'error');
    } finally {
      setClearing(false);
    }
  };

  const handleSeedDatabase = async () => {
    if (!window.confirm('האם לטעון מחדש את נתוני ההדגמה? פעולה זו תנקה את הנתונים הקיימים.')) {
      return;
    }

    setSeeding(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/seed`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast('נתוני הדגמה נטענו בהצלחה למערכת!');
      } else {
        showToast('שגיאה בטעינת נתוני ההדגמה', 'error');
      }
    } catch (error) {
      showToast('שגיאה בתקשורת עם השרת', 'error');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-grid">
        
        {/* iCal Calendar Integration */}
        <div className="settings-card glass-panel">
          <h3>
            <Calendar size={16} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '8px', verticalAlign: 'text-bottom' }} />
            סנכרון יומן חיצוני
          </h3>
          <div className="card-content">
            <p className="settings-desc">
              סנכרן פגישות ומשימות מיומן גוגל, אאוטלוק או אפל. 
              הדבק את כתובת ה-iCal הסודית של היומן שלך:
            </p>
            
            <form onSubmit={handleSyncCalendar} className="calendar-sync-form">
              <input 
                type="url" 
                placeholder="https://calendar.google.com/calendar/ical/.../basic.ics" 
                value={calendarUrl}
                onChange={e => setCalendarUrl(e.target.value)}
                className="input-glass"
                required
              />
              <button 
                type="submit" 
                className="btn btn-primary w-full"
                disabled={syncing}
              >
                {syncing ? 'מסנכרן יומן...' : (
                  <>
                    <RefreshCw size={14} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '6px', verticalAlign: 'middle' }} />
                    סנכרון יומן כעת
                  </>
                )}
              </button>
            </form>
            <p className="settings-helper-desc">
              * אירועים מהיומן החיצוני יתווספו אוטומטית כמתקיים לרשימת המשימות במערכת.
            </p>
          </div>
        </div>

        {/* Database Clean Slate / Maintenance */}
        <div className="settings-card glass-panel">
          <h3>
            <Database size={16} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '8px', verticalAlign: 'text-bottom' }} />
            תחזוקת נתונים
          </h3>
          <div className="card-content">
            <p className="settings-desc">
              התחל לעבוד עם נתונים אמיתיים! מחק את נתוני הדגמה המדומים שהוזנו במערכת לצורך המחשה:
            </p>
            <button 
              className="btn btn-danger w-full" 
              onClick={handleClearDatabase}
              disabled={clearing}
            >
              {clearing ? 'מנקה נתונים...' : (
                <>
                  <Trash2 size={14} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '6px', verticalAlign: 'middle' }} />
                  מחק נתוני הדגמה
                </>
              )}
            </button>
            
            <div className="settings-divider">
              <p className="settings-desc">במידת הצורך, תוכל לטעון מחדש את נתוני ההדגמה בכל עת:</p>
              <button 
                className="btn btn-secondary w-full" 
                onClick={handleSeedDatabase}
                disabled={seeding}
              >
                {seeding ? 'טוען נתוני הדגמה...' : (
                  <>
                    <Download size={14} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '6px', verticalAlign: 'middle' }} />
                    טען נתוני הדגמה
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Backup and Data Export */}
        <div className="settings-card glass-panel">
          <h3>
            <Save size={16} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '8px', verticalAlign: 'text-bottom' }} />
            ייצוא וגיבוי נתונים
          </h3>
          <div className="card-content">
            <p className="settings-desc">מומלץ לבצע גיבוי תקופתי. הגיבוי ייצא את רשימת הלקוחות וההיסטוריה לקובץ JSON במחשב שלך.</p>
            <button className="btn btn-primary w-full" onClick={handleBackupData}>
              <Download size={14} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '6px', verticalAlign: 'middle' }} />
              הורד קובץ גיבוי (JSON)
            </button>
          </div>
        </div>

        {/* System Info card */}
        <div className="settings-card glass-panel">
          <h3>
            <Info size={16} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '8px', verticalAlign: 'text-bottom' }} />
            מידע על המערכת
          </h3>
          <div className="card-content">
            <div className="info-row">
              <span className="info-lbl text-mono">SYSTEM_VERSION</span>
              <span className="info-val text-mono"><bdi>1.1.0 (Real Data & iCal Sync)</bdi></span>
            </div>
            <div className="info-row">
              <span className="info-lbl text-mono">DATABASE_ENGINE</span>
              <span className="info-val text-mono">SQLite 3</span>
            </div>
            <div className="info-row">
              <span className="info-lbl text-mono">STACK_TECHNOLOGY</span>
              <span className="info-val text-mono">React + Express + Node</span>
            </div>
            <div className="info-row">
              <span className="info-lbl text-mono">SERVER_STATUS</span>
              <span className="info-val text-won text-mono">ONLINE ✓</span>
            </div>
          </div>
        </div>

      </div>

      <style>{`
        .settings-page {
          height: 100%;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 24px;
        }

        .settings-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          background-color: var(--bg-card);
          border-radius: 6px;
        }

        .settings-card h3 {
          font-family: var(--font-display-he);
          font-size: 15px;
          color: #ffffff;
          border-bottom: 1px solid var(--border-muted);
          padding-bottom: 12px;
        }

        .card-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .calendar-sync-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .settings-divider {
          margin-top: 8px;
          border-top: 1px solid var(--border-muted);
          padding-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.02);
          padding-bottom: 8px;
        }

        .info-lbl {
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .info-val {
          color: #ffffff;
          font-weight: 700;
        }

        .settings-desc {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .settings-helper-desc {
          font-size: 11px;
          color: var(--text-muted);
          font-style: italic;
        }

        .w-full {
          width: 100%;
        }
      `}</style>
    </div>
  );
};

export default Settings;
