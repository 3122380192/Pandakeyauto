const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getDevices: () => ipcRenderer.invoke('get-devices'),
  restartAdb: () => ipcRenderer.invoke('restart-adb'),
  connectWifi: (payload) => ipcRenderer.invoke('connect-wifi', payload),
  activatePanda: (payload) => ipcRenderer.invoke('activate-panda', payload),
  takeScreenshot: (payload) => ipcRenderer.invoke('take-screenshot', payload),
  sendTextToPhone: (payload) => ipcRenderer.invoke('send-text-to-phone', payload),
  openUrlOnPhone: (payload) => ipcRenderer.invoke('open-url-on-phone', payload),
  startControl: (options) => ipcRenderer.invoke('start-control', options),
  stopControl: () => ipcRenderer.invoke('stop-control'),
  sendKeyEvent: (payload) => ipcRenderer.invoke('send-keyevent', payload),
  onRequestStartControl: (callback) => ipcRenderer.on('request-start-control', () => callback()),
  onOtgLog: (callback) => ipcRenderer.on('otg-log', (_event, value) => callback(value)),
  onOtgStatus: (callback) => ipcRenderer.on('otg-status', (_event, value) => callback(value))
});
