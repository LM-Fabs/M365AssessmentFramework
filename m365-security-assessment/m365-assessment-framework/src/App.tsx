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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // For non-authenticated routes, render without navigation
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/consent-result" element={<ConsentResult />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  // For authenticated routes, render with navigation
  return (
    <CustomerProvider>
      <div className="app-layout">
        <Navigation userName={user?.email} onLogout={logout} />
        <main className="main-content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/best-practices" element={<BestPractices />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/consent-result" element={<ConsentResult />} />
            <Route path="/assessment-results/:assessmentId" element={<AssessmentResults />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </main>
      </div>
    </CustomerProvider>
  );
}

export default App;