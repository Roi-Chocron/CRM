import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Kanban from './pages/Kanban';
import Calendar from './pages/Calendar';
import Settings from './pages/Settings';
import { ToastProvider } from './components/Toast';

const AppContent = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeClientId, setActiveClientId] = useState(null);

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

  return (
    <Layout currentPage={currentPage} setCurrentPage={setCurrentPage}>
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
