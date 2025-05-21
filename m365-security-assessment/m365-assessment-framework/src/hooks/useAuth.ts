import { useState, useCallback, useEffect } from 'react';
import { PublicClientApplication, AccountInfo, InteractionRequiredAuthError, IPublicClientApplication } from '@azure/msal-browser';
import { msalConfig, loginRequest } from '../config/auth';
import { GraphService } from '../services/graphService';

interface AuthState {
  isAuthenticated: boolean;
  account: AccountInfo | null;
  error: string | null;
  isLoading: boolean;
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
    error: null,
    isLoading: true
  });

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      if (!mounted) return;

      try {
        await msalInstance.initialize();
        console.log('MSAL initialized successfully');
        
        const currentAccounts = msalInstance.getAllAccounts();
        console.log('Current accounts:', currentAccounts);
        
        if (currentAccounts.length > 0) {
          console.log('Active account found:', currentAccounts[0].username);
          if (mounted) {
            setAuthState({
              isAuthenticated: true,
              account: currentAccounts[0],
              error: null,
              isLoading: false
            });
            msalInstance.setActiveAccount(currentAccounts[0]);
          }
          
          try {
            const graphService = GraphService.getInstance();
            await graphService.initializeGraphClient();
            console.log('Graph client initialized successfully');
          } catch (error) {
            console.error('Failed to initialize Graph client:', error);
          }
        } else {
          console.log('No active account found');
          if (mounted) {
            setAuthState(prev => ({ ...prev, isLoading: false }));
          }
        }
      } catch (error) {
        console.error('Error during authentication initialization:', error);
        if (mounted) {
          setAuthState(prev => ({
            ...prev,
            error: 'Failed to initialize authentication',
            isLoading: false
          }));
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, [msalInstance]);

  const login = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      await msalInstance.loginPopup(loginRequest);
      
      const account = msalInstance.getAllAccounts()[0];
      if (account) {
        setAuthState({
          isAuthenticated: true,
          account: account,
          error: null,
          isLoading: false
        });
        msalInstance.setActiveAccount(account);
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      setAuthState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false
      }));
    }
  }, [msalInstance]);

  const logout = useCallback(async () => {
    try {
      await msalInstance.logoutPopup({
        postLogoutRedirectUri: window.location.origin
      });
      
      setAuthState({
        isAuthenticated: false,
        account: null,
        error: null,
        isLoading: false
      });
    } catch (error: any) {
      console.error('Logout failed:', error);
      setAuthState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false
      }));
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