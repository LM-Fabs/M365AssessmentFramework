import { useState, useCallback, useEffect } from 'react';
import { PublicClientApplication, AccountInfo, InteractionRequiredAuthError, IPublicClientApplication, AuthenticationResult } from '@azure/msal-browser';
import { msalConfig, loginRequest } from '../config/auth';
import { GraphService } from '../services/graphService';

interface AuthState {
  isAuthenticated: boolean;
  account: AccountInfo | null;
  error: string | null;
}

export const useAuth = () => {
  const [msalInstance] = useState<IPublicClientApplication>(() => {
    const instance = new PublicClientApplication(msalConfig);
    instance.enableAccountStorageEvents();
    return instance;
  });
  
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    account: null,
    error: null
  });

  useEffect(() => {
    const initializeAuth = async () => {
      await msalInstance.initialize();
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        setAuthState({
          isAuthenticated: true,
          account: accounts[0],
          error: null
        });
        msalInstance.setActiveAccount(accounts[0]);
        
        try {
          const graphService = GraphService.getInstance();
          await graphService.initializeGraphClient();
        } catch (error) {
          console.error('Failed to initialize Graph client:', error);
        }
      }
    };

    initializeAuth();
  }, [msalInstance]);

  const login = useCallback(async () => {
    try {
      const result = await msalInstance.loginRedirect({
        ...loginRequest,
        redirectStartPage: window.location.href
      });

      // Note: With redirect flow, this code won't execute as the page will reload
      // The actual auth state update happens in the useEffect above after redirect
      
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        error: error.message
      }));
      console.error('Login failed:', error);
    }
  }, [msalInstance]);

  const logout = useCallback(async () => {
    try {
      await msalInstance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin
      });
      
      setAuthState({
        isAuthenticated: false,
        account: null,
        error: null
      });
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        error: error.message
      }));
      console.error('Logout failed:', error);
    }
  }, [msalInstance]);

  const getToken = useCallback(async () => {
    try {
      const account = msalInstance.getActiveAccount();
      if (!account) {
        throw new Error('No active account! Verify a user has been signed in and setActiveAccount has been called.');
      }

      const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: account
      });

      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        return msalInstance.acquireTokenRedirect(loginRequest);
      }
      throw error;
    }
  }, [msalInstance]);

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