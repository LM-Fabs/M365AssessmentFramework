import { useState, useCallback, useEffect } from 'react';
import { PublicClientApplication, AccountInfo, InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalConfig } from '../config/auth';

interface AuthState {
  isAuthenticated: boolean;
  account: AccountInfo | null;
  error: string | null;
  isLoading: boolean;
}

interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    account: null,
    error: null,
    isLoading: true
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/.auth/me');
        const payload = await response.json();
        
        if (payload.clientPrincipal) {
          const userDetails = payload.clientPrincipal as ClientPrincipal;
          setAuthState({
            isAuthenticated: true,
            account: {
              username: userDetails.userDetails,
              environment: 'azure',
              homeAccountId: userDetails.userId,
              localAccountId: userDetails.userId,
              tenantId: userDetails.userId.split('@')[1],
              name: userDetails.userDetails
            },
            error: null,
            isLoading: false
          });
        } else {
          setAuthState(prev => ({
            ...prev,
            isLoading: false
          }));
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthState({
          isAuthenticated: false,
          account: null,
          error: 'Failed to check authentication status',
          isLoading: false
        });
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(() => {
    window.location.href = '/.auth/login/aad';
  }, []);

  const logout = useCallback(() => {
    // Add post_logout_redirect_uri to prevent automatic re-authentication
    // This redirects to the /login page after logout without automatically triggering login
    const logoutUrl = '/.auth/logout?post_logout_redirect_uri=/login?noauto=true';
    window.location.href = logoutUrl;
  }, []);

  const getToken = useCallback(async () => {
    try {
      const response = await fetch('/.auth/me');
      const payload = await response.json();
      if (payload.clientPrincipal) {
        const tokenResponse = await fetch('/.auth/token');
        const tokenPayload = await tokenResponse.json();
        return tokenPayload.access_token;
      }
      throw new Error('Not authenticated');
    } catch (error) {
      console.error('Token acquisition failed:', error);
      throw new Error('Failed to get access token');
    }
  }, []);

  const clearError = useCallback(() => {
    setAuthState(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  return {
    ...authState,
    login,
    logout,
    getToken,
    clearError
  };
};