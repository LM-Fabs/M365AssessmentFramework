import { Configuration, LogLevel } from '@azure/msal-browser';
import { GRAPH_SCOPES } from '../shared/constants';

export const msalConfig: Configuration = {
  auth: {
    clientId: 'd1cc9e16-9194-4892-92c5-473c9f65dcb3',
    authority: 'https://login.microsoftonline.com/organizations',
    redirectUri: window.location.origin,
    navigateToLoginRequestUrl: true,
    postLogoutRedirectUri: window.location.origin
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  },
  system: {
    windowHashTimeout: 9000,
    iframeHashTimeout: 9000,
    loadFrameTimeout: 9000,
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
      logLevel: LogLevel.Verbose,
      piiLoggingEnabled: false
    }
  }
};

export const loginRequest = {
  scopes: GRAPH_SCOPES,
  prompt: 'select_account'
};

export const tokenRequest = {
  ...loginRequest
};