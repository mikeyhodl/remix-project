
import { Message } from '@remixproject/plugin-utils'
import { contextBridge, ipcRenderer } from 'electron'

console.log('preload.ts', new Date().toLocaleTimeString())

/* preload script needs statically defined API for each plugin */

const exposedPLugins = ['fs', 'git', 'xterm', 'isogit', 'electronconfig', 'electronTemplates', 'ripgrep', 'compilerloader', 'appUpdater', 'slither', 'foundry', 'hardhat', 'remixAID', 'circom', 'desktopHost', 'githubAuthHandler']

let webContentsId: number | undefined

ipcRenderer.invoke('getWebContentsID').then((id: number) => {
  webContentsId = id
})

contextBridge.exposeInMainWorld('electronAPI', {
  isPackaged: () => ipcRenderer.invoke('config:isPackaged'),
  isE2E: () => ipcRenderer.invoke('config:isE2E'),
  canTrackMatomo: () => ipcRenderer.invoke('config:canTrackMatomo'),
  // New granular tracking APIs
  trackDesktopEvent: (category: string, action: string, name?: string, value?: string | number) =>
    {
      const payload = ['trackEvent', category, action, name, value]
      if (process.env.MATOMO_DEBUG === '1') console.log('[Matomo][preload] trackDesktopEvent', payload)
      return ipcRenderer.invoke('matomo:trackEvent', payload)
    },
  setTrackingMode: (mode: 'cookie' | 'anon') => ipcRenderer.invoke('matomo:setMode', mode),
  openFolder: (path: string) => ipcRenderer.invoke('fs:openFolder', webContentsId, path),
  openFolderInSameWindow: (path: string) => ipcRenderer.invoke('fs:openFolderInSameWindow', webContentsId, path),
  activatePlugin: (name: string) => {
    return ipcRenderer.invoke('manager:activatePlugin', name)
  },

  plugins: exposedPLugins.map(name => {
    return {
      name,
      on: (cb:any) => {
        ipcRenderer.on(`${name}:send`, cb)
      },
      send: (message: Partial<Message>) => {
        //if(name === 'isogit') console.log(name, message)
        //if(name === 'isogit') ipcRenderer.invoke(`logger`, name, message)
        ipcRenderer.send(`${name}:on:${webContentsId}`, message)
      }
    }
  })


})