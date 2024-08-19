const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  login: (username, password) => ipcRenderer.invoke('login', username, password),
  onLoginSuccess: (callback) => ipcRenderer.once('login-success', callback),
  requestPasswordReset: (email) => ipcRenderer.invoke('request-password-reset', email),
  resetPassword: (token, newPassword) => ipcRenderer.invoke('reset-password', token, newPassword),
  navigateToLogin: () => ipcRenderer.send('navigate-to-login')  
});
