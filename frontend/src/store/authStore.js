import { create } from 'zustand';

const savedUserId = localStorage.getItem('userId');
const savedUserName = localStorage.getItem('userName');
const savedCodefId = localStorage.getItem('codefId');
const savedEmail = localStorage.getItem('email');
const savedPhoneNo = localStorage.getItem('phoneNo');

const useAuthStore = create((set) => ({
  user: savedUserId
    ? {
        userId: Number(savedUserId),
        name: savedUserName || '',
        codefId: savedCodefId || '',
        email: savedEmail || '',
        phoneNo: savedPhoneNo || '',
      }
    : null,
  isAuthenticated: !!localStorage.getItem('accessToken'),

  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    if (user?.userId) localStorage.setItem('userId', String(user.userId));
    if (user?.codefId) localStorage.setItem('codefId', user.codefId);
    if (user?.name) localStorage.setItem('userName', user.name);
    if (user?.email) localStorage.setItem('email', user.email);
    if (user?.phoneNo) localStorage.setItem('phoneNo', user.phoneNo);
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.clear();
    set({ user: null, isAuthenticated: false });
  },

  setUser: (user) => {
    if (user?.userId) localStorage.setItem('userId', String(user.userId));
    if (user?.codefId) localStorage.setItem('codefId', user.codefId);
    if (user?.name) localStorage.setItem('userName', user.name);
    if (user?.email) localStorage.setItem('email', user.email);
    if (user?.phoneNo) localStorage.setItem('phoneNo', user.phoneNo);
    set({ user });
  },
}));

export default useAuthStore;
