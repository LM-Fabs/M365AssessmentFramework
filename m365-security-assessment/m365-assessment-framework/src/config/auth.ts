import { GRAPH_SCOPES } from '../shared/constants';

// Configuration for Azure Static Web Apps authentication
export const authConfig = {
  clientId: process.env.REACT_APP_CLIENT_ID || 'your-client-id',
  authority: process.env.REACT_APP_AUTHORITY || 'https://login.microsoftonline.com/common',
  redirectUri: process.env.REACT_APP_REDIRECT_URI || window.location.origin + '/auth/callback',
};

// Azure Static Web Apps auth endpoints
export const staticWebAppAuth = {
  loginUrl: '/.auth/login/aad',
  logoutUrl: '/.auth/logout',
  meUrl: '/.auth/me',
};

// Legacy configuration for backward compatibility (will be phased out)
export const msalConfig = {
  auth: {
    clientId: 'd1cc9e16-9194-4892-92c5-473c9f65dcb3',
    authority: 'https://login.microsoftonline.com/organizations',
    redirectUri: window.location.origin,
    navigateToLoginRequestUrl: true
  }
};

export const loginRequest = {
  scopes: GRAPH_SCOPES,
  prompt: 'select_account'
};

export const tokenRequest = {
  ...loginRequest
};