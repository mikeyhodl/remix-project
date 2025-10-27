import type { Plugin } from '@remixproject/engine'

export type TerminalLogType = 'info' | 'warn' | 'error'

export class Logger {
  constructor(private pluginApi?: Plugin, private debug = false) {}

  log(message: string, ...args: any[]) { if (this.debug) console.log(message, ...args) }
  warn(message: string, ...args: any[]) { if (this.debug) console.warn(message, ...args) }
  error(message: string, ...args: any[]) { console.error(message, ...args) }

  async terminal(type: TerminalLogType, value: string) {
    try {
      if (this.pluginApi) {
        await this.pluginApi.call('terminal', 'log', { type, value })
        return
      }
    } catch {}
    if (type === 'error') console.error(value)
    else if (type === 'warn') console.warn(value)
    else console.log(value)
  }
}
