import React from 'react';
import Sidebar from './Sidebar';
import { LogOut } from 'lucide-react';

const Layout = ({ children, currentPage, setCurrentPage, onLogout }) => {
  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard':
        return 'לוח בקרה ונתונים';
      case 'clients':
        return 'ניהול לקוחות ולידים';
      case 'kanban':
        return 'לוח קנבן מכירות';
      case 'calendar':
        return 'ניהול משימות ולוז';
      case 'settings':
        return 'הגדרות מערכת';
      default:
        return 'CRM';
    }
  };

  const getTodayHebrewDate = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('he-IL', options);
  };

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      
      {/* Main viewport */}
      <main className="main-content">
        <header className="content-header">
          <div className="header-info">
            <h1 className="page-title">{getPageTitle()}</h1>
            <p className="header-date text-mono">{getTodayHebrewDate()}</p>
          </div>
          
          <div className="header-actions">
            <button 
              onClick={onLogout}
              className="btn btn-secondary logout-btn text-mono"
              aria-label="התנתק מהמערכת"
            >
              <LogOut size={14} /> התנתק
            </button>
            <div className="user-profile">
              <div className="user-details">
                <span className="user-name">רועי</span>
                <span className="user-role text-mono">SYSTEM_ADMIN</span>
              </div>
              <div className="user-avatar text-mono">R</div>
            </div>
          </div>
        </header>

        <section className="page-body">
          {children}
        </section>
      </main>

      <style>{`
        .content-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border-muted);
        }

        .page-title {
          font-size: 24px;
          font-family: var(--font-display-he);
          color: #ffffff;
        }

        .header-date {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 6px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .logout-btn {
          padding: 8px 12px;
          font-size: 11px;
          border-color: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .logout-btn:hover {
          background-color: rgba(239, 68, 68, 0.05);
          border-color: #ef4444;
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 14px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-muted);
        }

        .user-details {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .user-name {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
        }

        .user-role {
          font-size: 10px;
          color: var(--text-muted);
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          background-color: var(--color-primary);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          color: #ffffff;
          box-shadow: 0 0 12px rgba(79, 70, 229, 0.2);
        }

        .page-body {
          animation: fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          padding-bottom: 80px; /* Mobile tab space */
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .content-header {
            margin-bottom: 20px;
            padding-bottom: 12px;
          }
          
          .page-title {
            font-size: 18px;
          }

          .user-profile {
            padding: 4px 8px;
          }

          .user-details {
            display: none;
          }
          
          .page-body {
            padding-bottom: 60px;
          }
        }
      `}</style>
    </div>
  );
};

export default Layout;
