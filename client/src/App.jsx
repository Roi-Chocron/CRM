import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Kanban from './pages/Kanban';
import Calendar from './pages/Calendar';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { ToastProvider, useToast } from './components/Toast';
import { API_URL } from './config';

const AppContent = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeClientId, setActiveClientId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Check login status on load (Me Endpoint with CORS credentials)
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          // Manual session check fallback for github pages cookies
          headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();
        if (res.ok && data.loggedIn) {
          setIsAuthenticated(true);
          setUser(data.user);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        // Fallback checks from document cookie parsing
        const hasSessionCookie = document.cookie.includes('crm_session=');
        if (hasSessionCookie) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const handleLoginSuccess = (loggedInUser) => {
    setIsAuthenticated(true);
    setUser(loggedInUser);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST' });
    } catch (e) {}
    
    // Clear cookies & state locally
    document.cookie = "crm_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; secure; SameSite=None";
    setIsAuthenticated(false);
    setUser(null);
    showToast('התנתקת מהמערכת בהצלחה');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard 
            setActiveClient={setActiveClientId} 
            setCurrentPage={setCurrentPage} 
          />
        );
      case 'clients':
        return (
          <Clients 
            activeClientId={activeClientId} 
            setActiveClientId={setActiveClientId} 
          />
        );
      case 'kanban':
        return (
          <Kanban 
            setActiveClient={setActiveClientId} 
            setCurrentPage={setCurrentPage} 
          />
        );
      case 'calendar':
        return <Calendar />;
      case 'settings':
        return <Settings />;
      default:
        return (
          <Dashboard 
            setActiveClient={setActiveClientId} 
            setCurrentPage={setCurrentPage} 
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="app-loader">
        <div className="loader-spinner"></div>
        <style>{`
          .app-loader {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-color: var(--bg-app);
          }
          .loader-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255, 255, 255, 0.05);
            border-top-color: var(--color-primary);
            border-radius: 50%;
            animation: spin 1s infinite linear;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Layout 
      currentPage={currentPage} 
      setCurrentPage={setCurrentPage}
      onLogout={handleLogout}
    >
      {renderPage()}
    </Layout>
  );
};

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
