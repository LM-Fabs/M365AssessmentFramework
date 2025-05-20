declare namespace NodeJS {
  interface ProcessEnv {
    REACT_APP_CLIENT_ID: string;
    REACT_APP_TENANT_ID: string;
    NODE_ENV: 'development' | 'production' | 'test';
    PUBLIC_URL: string;
  }
}