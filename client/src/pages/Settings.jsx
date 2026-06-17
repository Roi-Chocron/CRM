import React, { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import { Calendar, RefreshCw, Database, Trash2, Download, Save, Info } from 'lucide-react';
import { API_URL } from '../config';

const Settings = () => {
  const { showToast } = useToast();
  const [clearing, setClearing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  
  // Google Calendar Integration states
  const [googleConnected, setGoogleConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncingGoogle, setSyncingGoogle] = useState(false);

  // Check Google integration status on load
  const checkGoogleStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/calendar/google/status`);
      const data = await res.json();
      if (res.ok) {
        setGoogleConnected(data.connected);
        if (data.lastSync) {
          setLastSyncTime(new Date(data.lastSync).toLocaleString('he-IL'));
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    checkGoogleStatus();

    // Listen to message from OAuth success popup window
    const handleOAuthMessage = (event) => {
      if (event.data === 'google-oauth-success') {
        showToast('יומן Google חובק בהצלחה!');
        checkGoogleStatus();
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  const handleConnectGoogle = () => {
    // Open Google OAuth redirect in a popup
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    window.open(
      `${API_URL}/api/auth/google/redirect`,
      'Google OAuth',
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
    );
  };

  const handleSyncGoogle = async () => {
    setSyncingGoogle(true);
    try {
      const res = await fetch(`${API_URL}/api/calendar/google/sync`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`סנכרון הושלם! נמצאו ${data.eventsSynced} אירועים, מתוכם ${data.newEventsAdded} משימות חדשות נוספו.`);
        checkGoogleStatus();
      } else {
        showToast(data.error || 'שגיאה בסנכרון יומן Google', 'error');
      }
    } catch (e) {
      showToast('שגיאה בתקשורת עם שרת הסנכרון', 'error');
    } finally {
      setSyncingGoogle(false);
    }
  };

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
        
        {/* Google Calendar OAuth Integration */}
        <div className="settings-card glass-panel">
          <h3>
            <Calendar size={16} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '8px', verticalAlign: 'text-bottom' }} />
            סנכרון Google Calendar
          </h3>
          <div className="card-content">
            <p className="settings-desc">
              סנכרן את המשימות של המערכת ישירות עם יומן ה-Google Calendar האישי שלך בצורה מאובטחת.
            </p>
            
            <div className="google-sync-status">
              <span className="info-label">סטטוס חיבור: </span>
              {googleConnected ? (
                <span className="status-badge connected text-mono">מחובר ✓</span>
              ) : (
                <span className="status-badge disconnected text-mono">לא מחובר ✕</span>
              )}
            </div>

            {lastSyncTime && (
              <p className="settings-helper-desc text-mono" style={{ fontSize: '10px' }}>
                סנכרון אחרון: {lastSyncTime}
              </p>
            )}

            {!googleConnected ? (
              <button 
                onClick={handleConnectGoogle}
                className="btn btn-primary w-full google-btn"
              >
                חבר יומן Google
              </button>
            ) : (
              <button 
                onClick={handleSyncGoogle}
                className="btn btn-secondary w-full"
                disabled={syncingGoogle}
              >
                {syncingGoogle ? 'מסנכרן יומן...' : (
                  <>
                    <RefreshCw size={14} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '6px', verticalAlign: 'middle' }} />
                    סנכרן משימות כעת
                  </>
                )}
              </button>
            )}
            
            <p className="settings-helper-desc">
              * המערכת תסרוק את האירועים העתידיים שלך ותשמור אותם תחת משימות ה-CRM.
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
              מחק את כל נתוני המערכת לצמיתות כדי להתחיל לעבוד עם נתונים נקיים:
            </p>
            <button 
              className="btn btn-danger w-full" 
              onClick={handleClearDatabase}
              disabled={clearing}
            >
              {clearing ? 'מנקה נתונים...' : (
                <>
                  <Trash2 size={14} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '6px', verticalAlign: 'middle' }} />
                  מחק את כל הנתונים
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
              <span className="info-val text-mono"><bdi>1.2.0 (Cookie Auth & Google OAuth)</bdi></span>
            </div>
            <div className="info-row">
              <span className="info-lbl text-mono">DATABASE_ENGINE</span>
              <span className="info-val text-mono">Cloudflare D1 (SQL)</span>
            </div>
            <div className="info-row">
              <span className="info-lbl text-mono">STACK_TECHNOLOGY</span>
              <span className="info-val text-mono">React + Hono + Workers</span>
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

        .google-sync-status {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
        }

        .status-badge {
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 3px;
          font-weight: 700;
        }

        .status-badge.connected {
          background-color: rgba(16, 185, 129, 0.1);
          color: var(--color-success);
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .status-badge.disconnected {
          background-color: rgba(239, 68, 68, 0.1);
          color: var(--color-danger);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .google-btn {
          background-color: #4285f4;
          border-color: #4285f4;
        }

        .google-btn:hover {
          background-color: #357ae8;
          border-color: #357ae8;
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
