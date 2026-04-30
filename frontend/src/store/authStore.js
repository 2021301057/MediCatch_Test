import { create } from 'zustand';

const savedUserId = localStorage.getItem('userId');

const useAuthStore = create((set) => ({
  user: savedUserId ? { userId: Number(savedUserId) } : null,
  isAuthenticated: !!localStorage.getItem('accessToken'),

  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    if (user?.userId) localStorage.setItem('userId', String(user.userId));
    if (user?.codefId) localStorage.setItem('codefId', user.codefId);
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.clear();
    set({ user: null, isAuthenticated: false });
  },

  setUser: (user) => {
    const id = user?.userId ?? user?.id;
    if (id) localStorage.setItem('userId', String(id));
    set({ user: user ? { ...user, userId: id } : null });
  },
}));

export default useAuthStore;
