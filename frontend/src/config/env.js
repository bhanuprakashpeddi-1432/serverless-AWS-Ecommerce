export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

export const COGNITO_CONFIG = {
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  region: import.meta.env.VITE_COGNITO_REGION || 'us-east-1',
}
