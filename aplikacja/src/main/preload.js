'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('planerApi', {
  loadData: () => ipcRenderer.invoke('data:load'),
  exportPlan: (payload) => ipcRenderer.invoke('export:run', payload),
  openExportDir: () => ipcRenderer.invoke('export:openDir'),
  startFetch: () => ipcRenderer.invoke('fetch:start'),
  cancelFetch: () => ipcRenderer.invoke('fetch:cancel'),
  onFetchProgress: (callback) => ipcRenderer.on('fetch:progress', (_event, payload) => callback(payload)),
  onFetchDone: (callback) => ipcRenderer.on('fetch:done', (_event, result) => callback(result)),
});
