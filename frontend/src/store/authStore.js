import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('accessToken'),

  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.clear();
    set({ user: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user }),
}));

export default useAuthStore;
