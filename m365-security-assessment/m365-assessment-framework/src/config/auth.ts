import { Configuration, LogLevel } from '@azure/msal-browser';
import { GRAPH_SCOPES } from '../shared/constants';

// Ensure client ID is available before initializing MSAL
const clientId = process.env.REACT_APP_CLIENT_ID;
if (!clientId) {
  console.error('Client ID is not configured. Please set REACT_APP_CLIENT_ID environment variable.');
}

export const msalConfig: Configuration = {
  auth: {
    clientId: clientId || '',
    authority: 'https://login.microsoftonline.com/organizations',
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: true
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  },
  system: {
    loggerOptions: {
      loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Info:
            console.info(message);
            return;
          case LogLevel.Verbose:
            console.debug(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
          default:
            return;
        }
      },
      logLevel: LogLevel.Info
    }
  }
};

export const loginRequest = {
  scopes: GRAPH_SCOPES
};

export const tokenRequest = {
  scopes: GRAPH_SCOPES
};