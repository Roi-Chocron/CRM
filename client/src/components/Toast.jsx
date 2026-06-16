import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type} glass-panel`}>
            <div className="toast-icon">
              {toast.type === 'success' && '✓'}
              {toast.type === 'error' && '✕'}
              {toast.type === 'info' && 'ℹ'}
            </div>
            <div className="toast-message">{toast.message}</div>
          </div>
        ))}
      </div>
      <style>{`
        .toast-container {
          position: fixed;
          bottom: 24px;
          left: 24px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 380px;
          width: calc(100% - 48px);
          pointer-events: none;
        }

        .toast {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          border-radius: 12px;
          color: #ffffff;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          animation: slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          pointer-events: auto;
          border-right: 4px solid var(--color-primary);
        }

        .toast-success {
          border-right-color: var(--color-success);
          background: rgba(16, 185, 129, 0.15);
        }
        
        .toast-error {
          border-right-color: var(--color-danger);
          background: rgba(239, 68, 68, 0.15);
        }

        .toast-info {
          border-right-color: var(--color-primary);
          background: rgba(59, 130, 246, 0.15);
        }

        .toast-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          font-weight: bold;
          font-size: 12px;
          flex-shrink: 0;
        }

        .toast-success .toast-icon {
          background: var(--color-success);
          color: #0f172a;
        }

        .toast-error .toast-icon {
          background: var(--color-danger);
          color: #ffffff;
        }

        .toast-info .toast-icon {
          background: var(--color-primary);
          color: #ffffff;
        }

        .toast-message {
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 500;
        }

        @keyframes slide-in {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
};
