import { useState, useEffect, useCallback } from 'react';
import { staticWebAppAuth } from '../config/auth';

interface User {
  displayName: string;
  email: string;
  id: string;
  tenantId?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
    error: null,
  });

  const checkAuthStatus = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await fetch(staticWebAppAuth.meUrl);
      
      if (response.ok) {
        const authData = await response.json();
        
        if (authData.clientPrincipal) {
          const user: User = {
            displayName: authData.clientPrincipal.userDetails,
            email: authData.clientPrincipal.userDetails,
            id: authData.clientPrincipal.userId,
            tenantId: authData.clientPrincipal.claims?.find((claim: any) => claim.typ === 'tid')?.val
          };
          
          setAuthState({
            isAuthenticated: true,
            user,
            loading: false,
            error: null,
          });
        } else {
          setAuthState({
            isAuthenticated: false,
            user: null,
            loading: false,
            error: null,
          });
        }
      } else {
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: 'Failed to check authentication status',
      });
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = useCallback(async () => {
    window.location.href = staticWebAppAuth.loginUrl;
  }, []);

  const logout = useCallback(async () => {
    window.location.href = staticWebAppAuth.logoutUrl;
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      // For Azure Static Web Apps, we'll need to get tokens through the API
      // This is a placeholder - actual implementation depends on your backend
      const response = await fetch('/api/auth/token');
      if (response.ok) {
        const data = await response.json();
        return data.accessToken;
      }
      return null;
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }, []);

  return {
    ...authState,
    login,
    logout,
    getAccessToken,
    checkAuthStatus,
  };
};