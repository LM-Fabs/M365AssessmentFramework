import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './config/auth';
import { useAuth } from './hooks/useAuth';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Settings from './pages/Settings';
import Login from './pages/Login';
import './App.css';

const msalInstance = new PublicClientApplication(msalConfig);

// Default to using redirect flow
msalInstance.handleRedirectPromise().catch(error => {
  console.error('Error handling redirect:', error);
});

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const Navigation: React.FC = () => {
  const { isAuthenticated, logout, account, isLoading } = useAuth();

  return (
    <nav className="navigation">
      <div className="nav-brand">
        {/* Use text branding instead of logo image until logo is available */}
        <span className="lm-logo-text">LM</span>
        <span>M365 Security Assessment</span>
      </div>
      
      {isAuthenticated && (
        <>
          <div className="nav-links">
            <Link to="/">Dashboard</Link>
            <Link to="/history">History</Link>
            <Link to="/settings">Settings</Link>
          </div>
          
          <div className="nav-account">
            {isLoading ? (
              <span className="loading-text">Loading...</span>
            ) : (
              <>
                <span className="username">{account?.username}</span>
                <button onClick={logout} className="lm-button-secondary">Logout</button>
              </>
            )}
          </div>
        </>
      )}
    </nav>
  );
};

const App: React.FC = () => {
  const { isLoading, error } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading application...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={() => window.location.reload()} className="lm-button">Retry</button>
      </div>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      <Router>
        <div className="app">
          <Navigation />
          
          <main className="main-content">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } />
              <Route path="/history" element={
                <PrivateRoute>
                  <History />
                </PrivateRoute>
              } />
              <Route path="/settings" element={
                <PrivateRoute>
                  <Settings />
                </PrivateRoute>
              } />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </Router>
    </MsalProvider>
  );
};

export default App;