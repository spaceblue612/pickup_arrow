const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "arrowEditor",
  Object.freeze({
    bootstrap: () => ipcRenderer.invoke("editor:bootstrap"),
    rememberSelection: (stageId, candidateId) => ipcRenderer.invoke("editor:rememberSelection", stageId, candidateId),
    save: (document, expectedRevision) =>
      ipcRenderer.invoke("editor:save", document, expectedRevision),
    deleteCandidate: (stageId, candidateId, expected) => ipcRenderer.invoke("editor:deleteCandidate", stageId, candidateId, expected),
    recover: (recovery) => ipcRenderer.invoke("editor:recover", recovery),
    core: (request) => ipcRenderer.invoke("editor:core", request),
    cancel: () => ipcRenderer.invoke("editor:cancel"),
    settings: (settings) => ipcRenderer.invoke("editor:settings", settings),
    importStage: () => ipcRenderer.invoke("editor:import"),
    exportStage: (stage) => ipcRenderer.invoke("editor:export", stage),
  }),
);
