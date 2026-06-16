import React, { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import { FolderOpen, Tag } from 'lucide-react';

const Kanban = ({ setActiveClient, setCurrentPage }) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedOverCol, setDraggedOverCol] = useState(null);
  const { showToast } = useToast();

  const columns = [
    { id: 'lead', title: 'ליד חדש', color: 'var(--color-status-lead)' },
    { id: 'contacted', title: 'יצירת קשר', color: 'var(--color-status-contacted)' },
    { id: 'proposal', title: 'הצעת מחיר', color: 'var(--color-status-proposal)' },
    { id: 'negotiation', title: 'משא ומתן', color: 'var(--color-status-negotiation)' },
    { id: 'won', title: 'עסקה נסגרה', color: 'var(--color-status-won)' },
    { id: 'lost', title: 'עסקה אבודה', color: 'var(--color-status-lost)' }
  ];

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      setClients(data);
    } catch (error) {
      showToast('שגיאה בטעינת לוח קנבן', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // HTML5 Drag & Drop handlers
  const handleDragStart = (e, clientId) => {
    e.dataTransfer.setData('clientId', clientId.toString());
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    if (draggedOverCol !== colId) {
      setDraggedOverCol(colId);
    }
  };

  const handleDragLeave = () => {
    setDraggedOverCol(null);
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    setDraggedOverCol(null);
    const clientIdStr = e.dataTransfer.getData('clientId');
    if (!clientIdStr) return;
    const clientId = parseInt(clientIdStr, 10);

    const clientToUpdate = clients.find(c => c.id === clientId);
    if (!clientToUpdate || clientToUpdate.status === targetStatus) return;

    // Optimistic UI Update
    const previousClients = [...clients];
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: targetStatus } : c));

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...clientToUpdate,
          status: targetStatus
        })
      });

      if (res.ok) {
        showToast('סטטוס הליד עודכן בהצלחה');
        fetchClients();
      } else {
        throw new Error('Failed to update status on server');
      }
    } catch (error) {
      showToast('שגיאה בעדכון הסטטוס', 'error');
      setClients(previousClients); // Rollback on error
    }
  };

  const handleCardClick = (clientId) => {
    setActiveClient(clientId);
    setCurrentPage('clients');
  };

  const formatCurrency = (val) => {
    const formatted = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(val || 0);
    return `\u2066${formatted}\u2069`;
  };

  const getColumnSum = (status) => {
    return clients
      .filter(c => c.status === status)
      .reduce((sum, c) => sum + (c.deal_value || 0), 0);
  };

  const totalPipeline = clients.reduce((sum, c) => sum + (c.deal_value || 0), 0);

  if (loading) {
    return (
      <div className="skeleton-container">
        <div className="skeleton-double">
          <div className="skeleton-card large"></div>
          <div className="skeleton-card large"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="kanban-page">
      <div className="kanban-header-bar glass-panel">
        <div className="kanban-title-group">
          <h2>צנרת המכירות (Kanban)</h2>
          <p className="text-muted text-mono">SYSTEM_SALES_PIPELINE</p>
        </div>
        <div className="pipeline-aggregate-card">
          <span className="agg-label text-mono">סה"כ בצנרת המכירות</span>
          <h3 className="agg-value text-won text-mono">
            <bdi>{formatCurrency(totalPipeline)}</bdi>
          </h3>
        </div>
      </div>

      <div className="kanban-board-container">
        {columns.map(col => {
          const colClients = clients.filter(c => c.status === col.id);
          const colValue = getColumnSum(col.id);
          const isDraggingOver = draggedOverCol === col.id;

          return (
            <div 
              key={col.id} 
              className={`kanban-column glass-panel ${isDraggingOver ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="column-header" style={{ borderBottomColor: col.color }}>
                <div className="column-title-group">
                  <span className="column-bullet" style={{ backgroundColor: col.color }}></span>
                  <h3>{col.title}</h3>
                  <span className="column-count text-mono">{colClients.length}</span>
                </div>
                <div className="column-sum text-mono">
                  <bdi>{formatCurrency(colValue)}</bdi>
                </div>
              </div>

              <div className="column-cards-list">
                {colClients.length === 0 ? (
                  <div className="empty-column-placeholder">
                    <span className="empty-icon"><FolderOpen size={24} /></span>
                    <p>גרור לקוחות לכאן</p>
                  </div>
                ) : (
                  colClients.map(client => (
                    <div 
                      key={client.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, client.id)}
                      onClick={() => handleCardClick(client.id)}
                      className="kanban-card glass-panel"
                    >
                      <h4 className="card-client-name">{client.name}</h4>
                      {client.company && <p className="card-client-company text-mono">{client.company}</p>}
                      
                      <div className="card-details-footer">
                        <span className="card-value text-mono">
                          <bdi>{formatCurrency(client.deal_value)}</bdi>
                        </span>
                        {client.source && (
                          <span className="card-source-tag text-mono">
                            <Tag size={10} style={{ display: 'inline-flex', alignItems: 'center', marginInlineEnd: '4px', verticalAlign: 'text-bottom' }} />
                            {client.source}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .kanban-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
          height: calc(100vh - 180px);
        }

        .kanban-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 30px;
          background-color: var(--bg-card);
          border-radius: 6px;
        }

        .kanban-title-group h2 {
          font-family: var(--font-display-he);
          font-size: 20px;
          color: #ffffff;
        }

        .text-muted {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .pipeline-aggregate-card {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .agg-label {
          font-size: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .agg-value {
          font-size: 20px;
          font-weight: 700;
        }

        .kanban-board-container {
          display: flex;
          gap: 20px;
          overflow-x: auto;
          flex: 1;
          padding-bottom: 20px;
          scroll-snap-type: x mandatory;
        }

        .kanban-column {
          width: 320px;
          min-width: 290px;
          display: flex;
          flex-direction: column;
          border-radius: 6px;
          height: 100%;
          background: #0e1320;
          border: 1px solid var(--border-muted);
          scroll-snap-align: start;
          transition: var(--transition-fast);
        }

        .kanban-column.drag-over {
          border-color: var(--color-primary);
          background: #141b2c;
          box-shadow: var(--shadow-active);
        }

        .column-header {
          padding: 16px 20px;
          border-bottom: 2px solid var(--border-muted);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .column-title-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .column-bullet {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .column-title-group h3 {
          font-family: var(--font-display-he);
          font-size: 14px;
          color: #ffffff;
        }

        .column-count {
          font-size: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-muted);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--text-muted);
        }

        .column-sum {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
        }

        .column-cards-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .empty-column-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 0;
          gap: 10px;
          color: rgba(255, 255, 255, 0.08);
          border: 2px dashed var(--border-muted);
          border-radius: 6px;
          height: 100%;
        }

        .empty-icon {
          font-size: 28px;
        }

        .empty-column-placeholder p {
          font-size: 11px;
        }

        .kanban-card {
          padding: 16px;
          cursor: grab;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: var(--bg-card);
          border: 1px solid var(--border-muted);
          border-radius: 6px;
          transition: var(--transition-fast);
        }

        .kanban-card:active {
          cursor: grabbing;
        }

        .kanban-card:hover {
          transform: translateY(-2px);
          border-color: var(--color-primary);
          background: var(--bg-card-hover);
          box-shadow: var(--shadow-active);
        }

        .card-client-name {
          font-size: 13px;
          color: #ffffff;
          font-weight: 600;
        }

        .card-client-company {
          font-size: 11px;
          color: var(--text-muted);
        }

        .card-details-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid var(--border-muted);
          padding-top: 8px;
          margin-top: 4px;
        }

        .card-value {
          font-size: 11px;
          font-weight: 700;
          color: #ffffff;
        }

        .card-source-tag {
          font-size: 10px;
          color: var(--text-muted);
        }

        @media (max-width: 768px) {
          .kanban-page {
            height: auto;
          }
          .kanban-header-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            padding: 16px 20px;
          }
          .pipeline-aggregate-card {
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default Kanban;
