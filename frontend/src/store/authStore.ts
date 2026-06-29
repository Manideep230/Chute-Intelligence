import { create } from 'zustand';

interface User {
  _id: string;
  ngId: string;
  name: string;
  phone: string;
  role: 'Super Admin' | 'Admin' | 'Manager' | 'Worker';
  profilePic?: string;
  isActive: boolean;
  assignedPlantIds?: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setAuth: (user: User, token: string) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
  setInitializing: (initializing: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const storedUser = localStorage.getItem('ng_user');
  const storedToken = localStorage.getItem('ng_token');

  return {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken || null,
    isAuthenticated: !!(storedUser && storedToken),
    isInitializing: !!storedUser,

    setAuth: (user, token) => {
      localStorage.setItem('ng_user', JSON.stringify(user));
      localStorage.setItem('ng_token', token);
      set({ user, token, isAuthenticated: true, isInitializing: false });
    },

    updateUser: (updatedFields) => {
      set((state) => {
        if (!state.user) return state;
        const newUser = { ...state.user, ...updatedFields };
        localStorage.setItem('ng_user', JSON.stringify(newUser));
        return { user: newUser };
      });
    },

    logout: async () => {
      localStorage.removeItem('ng_user');
      localStorage.removeItem('ng_token');
      set({ user: null, token: null, isAuthenticated: false, isInitializing: false });
      try {
        await fetch('http://localhost:5000/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('Failed to revoke session on logout:', err);
      }
    },

    setInitializing: (initializing) => {
      set({ isInitializing: initializing });
    },
  };
});

