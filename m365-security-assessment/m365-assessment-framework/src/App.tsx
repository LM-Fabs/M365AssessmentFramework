import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './config/auth';
import { useAuth } from './hooks/useAuth';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Settings from './pages/Settings';

const msalInstance = new PublicClientApplication(msalConfig);

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const Navigation: React.FC = () => {
  const { isAuthenticated, logout, account } = useAuth();

  return (
    <nav className="navigation">
      <div className="nav-brand">
        M365 Security Assessment v1.0.1
      </div>
      
      {isAuthenticated && (
        <>
          <div className="nav-links">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/history">History</Link>
            <Link to="/settings">Settings</Link>
          </div>
          
          <div className="nav-account">
            <span className="username">{account?.username}</span>
            <button onClick={logout}>Logout</button>
          </div>
        </>
      )}
    </nav>
  );
};

const LoginPage: React.FC = () => {
  const { login, error, clearError } = useAuth();

  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>M365 Security Assessment</h1>
        <p>Sign in with your Microsoft account to continue</p>
        {error && <div className="error-message">{error}</div>}
        <button onClick={login}>Sign In</button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <MsalProvider instance={msalInstance}>
      <Router>
        <div className="app">
          <Navigation />
          
          <main className="main-content">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route 
                path="/dashboard" 
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/history" 
                element={
                  <PrivateRoute>
                    <History />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/settings" 
                element={
                  <PrivateRoute>
                    <Settings />
                  </PrivateRoute>
                } 
              />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>

          <style>{`
            .app {
              min-height: 100vh;
              display: flex;
              flex-direction: column;
            }

            .navigation {
              background: #0078d4;
              color: white;
              padding: 1rem;
              display: flex;
              align-items: center;
              justify-content: space-between;
            }

            .nav-brand {
              font-size: 1.25rem;
              font-weight: bold;
            }

            .nav-links {
              display: flex;
              gap: 1.5rem;
            }

            .nav-links a {
              color: white;
              text-decoration: none;
              padding: 0.5rem;
              border-radius: 4px;
              transition: background-color 0.2s;
            }

            .nav-links a:hover {
              background: rgba(255, 255, 255, 0.1);
            }

            .nav-account {
              display: flex;
              align-items: center;
              gap: 1rem;
            }

            .username {
              font-size: 0.9rem;
              opacity: 0.9;
            }

            .main-content {
              flex: 1;
              padding: 2rem;
              background: #f5f5f5;
            }

            .login-page {
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #f5f5f5;
            }

            .login-container {
              background: white;
              padding: 2rem;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              text-align: center;
              max-width: 400px;
              width: 100%;
            }

            .login-container h1 {
              margin-bottom: 1rem;
              color: #333;
            }

            .login-container p {
              color: #666;
              margin-bottom: 1.5rem;
            }

            button {
              background: #0078d4;
              color: white;
              padding: 0.5rem 1rem;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 1rem;
              transition: background-color 0.2s;
            }

            button:hover {
              background: #006cbe;
            }

            .error-message {
              background: #fed9cc;
              color: #d83b01;
              padding: 0.75rem;
              border-radius: 4px;
              margin-bottom: 1rem;
            }

            @media (max-width: 768px) {
              .navigation {
                flex-direction: column;
                gap: 1rem;
                text-align: center;
              }

              .nav-links {
                flex-direction: column;
                gap: 0.5rem;
              }

              .nav-account {
                flex-direction: column;
                gap: 0.5rem;
              }

              .main-content {
                padding: 1rem;
              }
            }
          `}</style>
        </div>
      </Router>
    </MsalProvider>
  );
};

export default App;