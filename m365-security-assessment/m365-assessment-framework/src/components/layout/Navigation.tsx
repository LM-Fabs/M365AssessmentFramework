import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Navigation.css';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

interface NavigationProps {
  userName?: string;
  onLogout: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ userName, onLogout }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  
  // Close menu when route changes (on mobile)
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Get user initials for avatar
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const navItems: NavItem[] = [
    {
      path: '/',
      label: 'Dashboard',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      path: '/assessments',
      label: 'Assessments',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      path: '/best-practices',
      label: 'Best Practices',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      path: '/reports',
      label: 'Reports',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      path: '/settings',
      label: 'Assessment Settings',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login?noauto=true');
  };

  return (
    <>
      <nav className={`lm-navigation ${isMenuOpen ? 'menu-open' : ''}`}>
        <div className="nav-header">
          <div className="nav-logo-container">
            <img src="/images/lm-logo.svg" alt="LM Logo" className="nav-logo" />
          </div>
          <button 
            className="mobile-menu-toggle" 
            onClick={() => setIsMenuOpen(false)}
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="nav-menu">
          <ul className="nav-list">
            {navItems.map((item) => (
              <li key={item.path} className="nav-item">
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-text">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="recent-assessments">
          <h2 className="recent-assessments-title">Recent Assessments</h2>
          <ul className="recent-assessment-list">
            <li className="recent-assessment-item">
              <span>Contoso Ltd</span>
              <span>2 days ago</span>
            </li>
            <li className="recent-assessment-item">
              <span>Fabrikam Inc</span>
              <span>1 week ago</span>
            </li>
            <li className="recent-assessment-item">
              <span>Northwind Traders</span>
              <span>2 weeks ago</span>
            </li>
          </ul>
        </div>
        
        {userName && (
          <div className="nav-footer">
            <div className="user-profile">
              <div className="user-avatar">{getInitials(userName)}</div>
              <div className="user-info">
                <div className="user-name">{userName.split('@')[0]}</div>
                <div className="user-email">{userName}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="logout-button">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </nav>
      
      {/* Mobile menu toggle button and backdrop */}
      <button 
        className="mobile-menu-toggle" 
        style={{ 
          position: 'fixed', 
          top: '1rem', 
          left: '1rem', 
          zIndex: 99,
          display: isMenuOpen ? 'none' : 'flex',
          backgroundColor: '#0e2a4d', /* LM-AG dark blue color */
          color: 'white',
          borderRadius: '4px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}
        onClick={() => setIsMenuOpen(true)}
        aria-label="Open menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      <div 
        className="mobile-menu-backdrop" 
        style={{ display: isMenuOpen ? 'block' : 'none' }}
        onClick={() => setIsMenuOpen(false)}
      />
      
      <div className="mobile-menu">
        <div className="mobile-menu-header">
          <div className="mobile-nav-logo">
            <img src="/images/lm-logo.svg" alt="LM Logo" className="mobile-logo" />
          </div>
          <button className="close-mobile-menu" onClick={() => setIsMenuOpen(false)}>
            <span className="close-icon">&times;</span>
          </button>
        </div>
        
        {userName && (
          <div className="mobile-user-info">
            <div className="mobile-user-avatar">{getInitials(userName)}</div>
            <div className="mobile-user-details">
              <div className="mobile-username">{userName || 'User'}</div>
              <div className="mobile-user-email">{userName ? `${userName.toLowerCase()}@lm-ag.de` : ''}</div>
            </div>
          </div>
        )}
        
        <div className="mobile-nav-menu">
          <ul className="mobile-nav-list">
            {navItems.map((item) => (
              <li key={item.path} className="mobile-nav-item">
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="mobile-nav-icon">{item.icon}</span>
                  <span className="mobile-nav-text">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
        
        {userName && (
          <div className="mobile-nav-footer">
            <button onClick={handleLogout} className="mobile-logout-button">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Navigation;