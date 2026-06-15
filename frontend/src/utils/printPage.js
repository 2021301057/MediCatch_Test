export const openPrintPopup = (title = 'MediCatch Report') => {
  const originalTitle = document.title;

  document.title = title;
  window.print();
  window.setTimeout(() => {
    document.title = originalTitle;
  }, 300);
};
