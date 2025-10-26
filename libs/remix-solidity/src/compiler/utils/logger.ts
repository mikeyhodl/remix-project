import type { Plugin } from '@remixproject/engine'

export type TerminalLogType = 'info' | 'warn' | 'error'

export class Logger {
  private pluginApi?: Plugin
  private debug: boolean

  constructor(pluginApi?: Plugin, debug = false) {
    this.pluginApi = pluginApi
    this.debug = debug
  }

  log(message: string, ...args: any[]) {
    if (this.debug) console.log(message, ...args)
  }

  warn(message: string, ...args: any[]) {
    if (this.debug) console.warn(message, ...args)
  }

  error(message: string, ...args: any[]) {
    console.error(message, ...args)
  }

  async terminal(type: TerminalLogType, value: string) {
    try {
      if (this.pluginApi) {
        await this.pluginApi.call('terminal', 'log', { type, value })
        return
      }
    } catch {
      // Fallback to console
    }
    // Fallback to console if no plugin or call failed
    if (type === 'error') console.error(value)
    else if (type === 'warn') console.warn(value)
    else console.log(value)
  }
}
