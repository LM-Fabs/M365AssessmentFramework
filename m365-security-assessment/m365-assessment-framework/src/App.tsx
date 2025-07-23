import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ApiWarmupService } from './services/apiWarmupService';
import { CustomerProvider } from './contexts/CustomerContext';
import Navigation from './components/layout/Navigation';
import Dashboard from './pages/Dashboard';
import BestPractices from './pages/BestPractices';
import Reports from './pages/Reports';
import Login from './pages/Login';
import History from './pages/History';
import Settings from './pages/Settings';
import AuthCallback from './pages/AuthCallback';
import { AssessmentResults } from './components/AssessmentResults';
import ConsentResult from './components/ConsentResult';
import AdminConsentSuccess from './components/AdminConsentSuccess';
import './App.css';

function App() {
  // Start API warmup as early as possible, but don't let it crash the app
  useEffect(() => {
    try {
      const warmupService = ApiWarmupService.getInstance();
      warmupService.startBackgroundWarmup();
    } catch (error) {
      console.warn('Failed to start API warmup, but app continues:', error);
    }
  }, []);

  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function AppContent() {
  const { isAuthenticated, loading, user, logout } = useAuth();

  // Check if we're on the admin consent success page - bypass ALL auth logic
  const currentPath = window.location.pathname;
  if (currentPath === '/admin-consent-success') {
    return <AdminConsentSuccess />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Regular routing for all other pages
  return (
    <Routes>
      {!isAuthenticated ? (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/consent-result" element={<ConsentResult />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </>
      ) : (
        <>
          <Route path="/dashboard" element={
            <CustomerProvider>
              <div className="app-layout">
                <Navigation userName={user?.email} onLogout={logout} />
                <main className="main-content">
                  <Dashboard />
                </main>
              </div>
            </CustomerProvider>
          } />
          <Route path="/" element={
            <CustomerProvider>
              <div className="app-layout">
                <Navigation userName={user?.email} onLogout={logout} />
                <main className="main-content">
                  <Dashboard />
                </main>
              </div>
            </CustomerProvider>
          } />
          <Route path="/best-practices" element={
            <CustomerProvider>
              <div className="app-layout">
                <Navigation userName={user?.email} onLogout={logout} />
                <main className="main-content">
                  <BestPractices />
                </main>
              </div>
            </CustomerProvider>
          } />
          <Route path="/reports" element={
            <CustomerProvider>
              <div className="app-layout">
                <Navigation userName={user?.email} onLogout={logout} />
                <main className="main-content">
                  <Reports />
                </main>
              </div>
            </CustomerProvider>
          } />
          <Route path="/history" element={
            <CustomerProvider>
              <div className="app-layout">
                <Navigation userName={user?.email} onLogout={logout} />
                <main className="main-content">
                  <History />
                </main>
              </div>
            </CustomerProvider>
          } />
          <Route path="/settings" element={
            <CustomerProvider>
              <div className="app-layout">
                <Navigation userName={user?.email} onLogout={logout} />
                <main className="main-content">
                  <Settings />
                </main>
              </div>
            </CustomerProvider>
          } />
          <Route path="/consent-result" element={
            <CustomerProvider>
              <div className="app-layout">
                <Navigation userName={user?.email} onLogout={logout} />
                <main className="main-content">
                  <ConsentResult />
                </main>
              </div>
            </CustomerProvider>
          } />
          <Route path="/assessment-results/:assessmentId" element={
            <CustomerProvider>
              <div className="app-layout">
                <Navigation userName={user?.email} onLogout={logout} />
                <main className="main-content">
                  <AssessmentResults />
                </main>
              </div>
            </CustomerProvider>
          } />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </>
      )}
    </Routes>
  );
}

export default App;