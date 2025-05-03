const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld("api", {
    version: process.version,
    lastTime: (callback) => { ipcRenderer.on("lastTime", (_event, value) => { callback(value) }) },
    contentTmp: (callback) => { ipcRenderer.on("contentTmp", (_event, value) => { callback(value) }) },
    config: (callback) => { ipcRenderer.on("config", (_event, value) => { callback(value) }) },
    save: (callback) => { ipcRenderer.on("save", (_event) => { callback() }) },
    saveTmp: (callback) => { ipcRenderer.on("saveTmp", (_event) => { callback() }) },
    saveRes: (value) => { ipcRenderer.send("saveRes", value) },
    saveTmpRes: (value) => { ipcRenderer.send("saveTmpRes", value) },
    zoom: (value) => { ipcRenderer.send("zoom", value) },
    clear: (callback) => { ipcRenderer.on("clear", (_event) => { callback() }) },
    message: (callback) => { ipcRenderer.on("message", (_event, value) => { callback(value) }) },
    captionEdit: (value) => { ipcRenderer.send("captionEdit", value) },
    requestHistory: (params) => ipcRenderer.send("request-history", params),
    requestDayDetail: (date) => ipcRenderer.send("request-day-detail", date),
    onHistoryData: (callback) => ipcRenderer.on("history-data", (_event, value) => callback(value)),
    onDayDetail: (callback) => ipcRenderer.on("day-detail", (_event, value) => callback(value)),
})
