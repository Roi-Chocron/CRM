import React, { useState } from 'react';
import { useToast } from '../components/Toast';
import { Lock, User, Eye, EyeOff, Terminal } from 'lucide-react';
import { API_URL } from '../config';

const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        showToast(`ברוך הבא, ${data.user.name || username}!`);
        // Notify parent App component
        onLoginSuccess(data.user);
      } else {
        showToast(data.error || 'שם משתמש או סיסמה שגויים', 'error');
      }
    } catch (error) {
      showToast('שגיאה בחיבור לשרת האימות', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-panel">
        <div className="login-header">
          <div className="brand-badge text-mono">
            <Terminal size={14} /> SECURITY_ENCRYPTED_SESSION
          </div>
          <h2>מערכת CRM - כניסת מנהל</h2>
          <p>הזן שם משתמש וסיסמה כדי לגשת לנתוני העסק</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="text-mono">USERNAME</label>
            <div className="input-with-icon">
              <User size={16} className="input-icon" />
              <input 
                type="text" 
                required 
                placeholder="שם משתמש (למשל: roi)" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="input-glass"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="text-mono">PASSWORD</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input 
                type={showPassword ? 'text' : 'password'} 
                required 
                placeholder="סיסמה" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-glass password-input"
                disabled={loading}
              />
              <button 
                type="button" 
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary w-full login-btn"
            disabled={loading}
          >
            {loading ? 'מתחבר למערכת...' : 'התחבר למערכת'}
          </button>
        </form>

        <div className="login-footer text-mono">
          <span>CRM_CLIENT_PORTAL_v1.2</span>
        </div>
      </div>

      <style>{`
        .login-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          width: 100vw;
          background-color: var(--bg-app);
          padding: 20px;
          position: fixed;
          top: 0;
          left: 0;
          z-index: 99999;
          overflow: hidden;
        }

        .login-card {
          width: 420px;
          max-width: 100%;
          padding: 40px;
          display: flex;
          flex-direction: column;
          gap: 30px;
          border-radius: 8px;
          border: 1px solid var(--border-muted);
          background-color: var(--bg-sidebar);
        }

        .login-header {
          display: flex;
          flex-direction: column;
          gap: 10px;
          text-align: center;
        }

        .brand-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          align-self: center;
          padding: 4px 10px;
          background: rgba(79, 70, 229, 0.08);
          border: 1px solid rgba(79, 70, 229, 0.2);
          color: var(--color-primary);
          font-size: 10px;
          border-radius: 4px;
        }

        .login-header h2 {
          font-size: 22px;
          color: #ffffff;
        }

        .login-header p {
          font-size: 13px;
          color: var(--text-muted);
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          right: 14px;
          color: var(--text-muted);
        }

        .input-glass {
          padding-right: 42px;
        }

        .password-input {
          padding-left: 42px;
        }

        .toggle-password {
          position: absolute;
          left: 14px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }

        .toggle-password:hover {
          color: #ffffff;
        }

        .login-btn {
          margin-top: 10px;
          padding: 12px;
        }

        .login-footer {
          text-align: center;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.15);
          border-top: 1px solid var(--border-muted);
          padding-top: 20px;
        }

        .w-full {
          width: 100%;
        }
      `}</style>
    </div>
  );
};

export default Login;
