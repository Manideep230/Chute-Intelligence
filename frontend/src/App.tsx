import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CircularProgress } from '@mui/material';

function App() {
  const { isAuthenticated, isInitializing, setInitializing, setAuth, logout } = useAuthStore();

  useEffect(() => {
    const initSession = async () => {
      if (!isInitializing) return;

      const storedToken = localStorage.getItem('ng_token');
      const storedUser = localStorage.getItem('ng_user');
      if (storedToken && storedUser) {
        // Access token exists and is persistent, so we can skip refresh on boot!
        setInitializing(false);
        return;
      }

      try {
        const res = await fetch('/_/backend/auth/refresh', {
          method: 'POST',
        });
        if (res.ok) {
          const data = await res.json();
          const storedUser = localStorage.getItem('ng_user');
          if (storedUser && data.accessToken) {
            setAuth(JSON.parse(storedUser), data.accessToken);
          } else {
            logout();
          }
        } else if (res.status === 401 || res.status === 403) {
          // Refresh token is explicitly rejected by the server — log out
          logout();
        } else {
          // Server returned an unexpected error (5xx etc.) — don't log out,
          // just mark session as authenticated from localStorage so the user
          // can keep working. The access token will be refreshed on next API call.
          const storedUser = localStorage.getItem('ng_user');
          if (storedUser) {
            // Keep the user logged in; token will be null until next refresh succeeds
            setInitializing(false);
            return;
          }
          logout();
        }
      } catch (err) {
        // Network error (server down / restarting) — do NOT log out.
        // Preserve the stored session; the interceptor will retry on next request.
        console.warn('Session init: server unreachable, keeping stored session.', err);
        const storedUser = localStorage.getItem('ng_user');
        if (!storedUser) {
          logout(); // Nothing stored either — clear state
        } else {
          setInitializing(false);
          return;
        }
      } finally {
        setInitializing(false);
      }
    };

    initSession();
  }, [isInitializing, setInitializing, setAuth, logout]);

  if (isInitializing) {
    return (
      <div 
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'radial-gradient(circle at center, #111827 0%, #030712 100%)',
          color: 'white',
          fontFamily: 'Share Tech Mono, monospace',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div 
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backgroundImage: 'radial-gradient(rgba(255, 107, 53, 0.08) 1px, transparent 0)',
            backgroundSize: '24px 24px',
            opacity: 0.5,
            zIndex: 1
          }}
        ></div>
        <div style={{ zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CircularProgress style={{ color: '#ff6b35', marginBottom: '20px' }} size={50} />
          <div style={{ fontSize: '14px', letterSpacing: '3px', textTransform: 'uppercase', color: '#ff6b35', fontWeight: 600 }}>
            Establishing Secure Session
          </div>
          <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#6b7280', marginTop: '8px', textTransform: 'uppercase' }}>
            Nigha Radar Enterprise
          </div>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Dashboard /> : <Login />;
}

export default App;

