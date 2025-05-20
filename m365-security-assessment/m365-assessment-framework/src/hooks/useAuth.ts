import { useState, useCallback, useEffect } from 'react';
import { PublicClientApplication, AccountInfo, InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalConfig, loginRequest } from '../config/auth';
import { GraphService } from '../services/graphService';

interface AuthState {
  isAuthenticated: boolean;
  account: AccountInfo | null;
  error: string | null;
}

export const useAuth = () => {
  const [msalInstance] = useState(() => new PublicClientApplication(msalConfig));
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    account: null,
    error: null
  });

  useEffect(() => {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: true,
        account: accounts[0]
      }));
      msalInstance.setActiveAccount(accounts[0]);
      
      // Initialize Graph client
      const graphService = GraphService.getInstance();
      graphService.initializeGraphClient().catch(error => {
        console.error('Failed to initialize Graph client:', error);
      });
    }
  }, [msalInstance]);

  const login = useCallback(async () => {
    try {
      const response = await msalInstance.loginPopup(loginRequest);
      if (response.account) {
        setAuthState({
          isAuthenticated: true,
          account: response.account,
          error: null
        });
        msalInstance.setActiveAccount(response.account);

        // Initialize Graph client after successful login
        const graphService = GraphService.getInstance();
        await graphService.initializeGraphClient();
      }
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
      await msalInstance.logoutPopup();
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
        // fallback to interaction when silent call fails
        const response = await msalInstance.acquireTokenPopup(loginRequest);
        return response.accessToken;
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