import React from 'react';
import { LayoutDashboard, Users, Columns, Calendar, Settings } from 'lucide-react';

const Sidebar = ({ currentPage, setCurrentPage }) => {
  const menuItems = [
    { id: 'dashboard', label: 'לוח בקרה', icon: LayoutDashboard },
    { id: 'clients', label: 'לקוחות ולידים', icon: Users },
    { id: 'kanban', label: 'לוח קנבן', icon: Columns },
    { id: 'calendar', label: 'משימות ויומן', icon: Calendar },
    { id: 'settings', label: 'הגדרות', icon: Settings }
  ];

  return (
    <nav className="crm-sidebar glass-panel">
      <div className="sidebar-brand">
        <div className="brand-logo text-brand-en">AB</div>
        <div className="brand-title">TOM CRM</div>
      </div>
      
      <ul className="sidebar-menu text-mono">
        {menuItems.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => setCurrentPage(item.id)}
              className={`menu-btn btn-active ${currentPage === item.id ? 'active' : ''}`}
              aria-label={item.label}
            >
              <span className="menu-icon">
                <item.icon size={16} strokeWidth={2} />
              </span>
              <span className="menu-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* Subtle brand lines watermark */}
      <div className="sidebar-watermark">SYSTEM</div>

      <style>{`
        .crm-sidebar {
          width: 250px;
          height: calc(100vh - 40px);
          margin: 20px 20px 20px 0; /* Align right side margin */
          display: flex;
          flex-direction: column;
          padding: 24px;
          position: sticky;
          top: 20px;
          border-radius: 8px;
          z-index: 100;
          overflow: hidden;
          background-color: var(--bg-sidebar);
          border: 1px solid var(--border-muted);
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 40px;
        }

        .brand-logo {
          width: 42px;
          height: 42px;
          background-color: var(--color-primary);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: normal;
          color: #ffffff;
        }

        .brand-title {
          font-family: var(--font-display-he);
          font-size: 16px;
          color: #ffffff;
          letter-spacing: 0.05em;
        }

        .sidebar-menu {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .menu-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          background: transparent;
          border: none;
          border-radius: 4px;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 13px;
          cursor: pointer;
          transition: var(--transition-fast);
          text-align: right;
          border: 1px solid transparent;
        }

        .menu-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.02);
          border-color: rgba(255, 255, 255, 0.04);
          transform: translateX(-2px); /* RTL slide-in */
        }

        .menu-btn.active {
          color: #ffffff;
          background: var(--bg-card);
          border: 1px solid var(--color-primary);
          box-shadow: inset 2px 0 0 var(--color-primary); /* RTL: Right side indicator */
        }

        .menu-icon {
          font-size: 16px;
        }

        .sidebar-watermark {
          position: absolute;
          bottom: 12px;
          left: 12px;
          font-family: var(--font-display-en);
          font-size: 32px;
          color: rgba(255, 255, 255, 0.02);
          pointer-events: none;
        }

        /* Responsive Mobile Layout (Bottom Tab Bar) */
        @media (max-width: 768px) {
          .crm-sidebar {
            width: 100%;
            height: 60px;
            margin: 0;
            padding: 0 10px;
            position: fixed;
            bottom: 0;
            top: auto;
            left: 0;
            right: 0;
            border-radius: 0;
            border-top: 1px solid var(--border-muted);
            border-left: none;
            border-right: none;
            border-bottom: none;
            flex-direction: row;
            justify-content: space-around;
            align-items: center;
            background-color: var(--bg-sidebar);
            box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.5);
          }

          .sidebar-brand {
            display: none;
          }

          .sidebar-menu {
            flex-direction: row;
            width: 100%;
            justify-content: space-between;
            gap: 0;
          }

          .sidebar-menu li {
            flex: 1;
            display: flex;
            justify-content: center;
          }

          .menu-btn {
            flex-direction: column;
            gap: 4px;
            padding: 8px 4px;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            border-radius: 4px;
          }

          .menu-btn:hover {
            transform: none;
            background: transparent;
            border-color: transparent;
          }

          .menu-btn.active {
            background: transparent;
            border: none;
            box-shadow: none;
            color: var(--color-primary);
          }

          .menu-icon {
            font-size: 18px;
          }

          .menu-label {
            font-size: 9px;
          }
          
          .sidebar-watermark {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
};

export default Sidebar;
