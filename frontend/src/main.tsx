import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useAuthStore } from './store/authStore'

// Global Fetch Interceptor for Access Token Injection & Auto-Refresh
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const token = useAuthStore.getState().token;
  const headers = new Headers(init?.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const updatedInit: RequestInit = {
    ...init,
    headers,
    credentials: init?.credentials || 'include', // Ensure httpOnly cookies are sent
  };

  const requestUrl = typeof input === 'string' 
    ? input 
    : (input instanceof URL ? input.toString() : (input as Request).url);
  
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const apiBase = isLocal ? 'http://localhost:5000' : '/_/backend';
  const finalUrl = requestUrl.startsWith('http://localhost:5000')
    ? requestUrl.replace('http://localhost:5000', apiBase)
    : requestUrl;

  console.log(`[Fetch-Interceptor] input=${requestUrl} -> finalUrl=${finalUrl}`);

  const isAuthRoute =
    finalUrl.includes('/auth/request-otp') ||
    finalUrl.includes('/auth/verify-otp') ||
    finalUrl.includes('/auth/refresh') ||
    finalUrl.includes('/auth/logout');

  const response = await originalFetch(finalUrl, updatedInit);

  // If 401 Unauthorized and not an auth route, attempt token refresh
  if (response.status === 401 && !isAuthRoute) {
    try {
      const refreshRes = await originalFetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const newAccessToken = refreshData.accessToken;
        
        // Update store with new token
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          useAuthStore.getState().setAuth(currentUser, newAccessToken);
        }

        // Retry the original request
        headers.set('Authorization', `Bearer ${newAccessToken}`);
        return originalFetch(finalUrl, {
          ...updatedInit,
          headers,
        });
      } else if (refreshRes.status === 401 || refreshRes.status === 403) {
        // Server explicitly rejected the refresh token — session is truly invalid
        useAuthStore.getState().logout();
      }
      // Any other HTTP error (5xx) or network failure: don't log out,
      // just return the original 401 response and let the UI handle it.
    } catch (err) {
      // Network error during refresh (server restarting) — do NOT log out.
      console.warn('Token refresh failed (server unreachable):', err);
    }
  }

  return response;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

