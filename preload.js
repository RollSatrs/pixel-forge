const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pixelForge', {
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value)
  },
  generateStableDiffusion: (params) => ipcRenderer.invoke('generate:stable-diffusion', params),
  checkStableDiffusionConnection: (params) => ipcRenderer.invoke('sd:check-connection', params),
  generateGemini: (params) => ipcRenderer.invoke('generate:gemini', params),
  searchReferences: (params) => ipcRenderer.invoke('references:search', params)
});
