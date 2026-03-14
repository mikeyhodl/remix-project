import { PluginClient } from '@remixproject/plugin'
import { createClient } from '@remixproject/plugin-webview'
import { store } from './redux/store'
import { router } from './App'

class RemixClient extends PluginClient {
  private currentTutorialId: string | null = null

  constructor() {
    super()
    createClient(this)
  }

  startTutorial(name: any, branch: any, id: any): void {
    (window as any).startTutorialCalled = true
    void router.navigate('/home')
    store.dispatch({
      type: 'workshop/loadRepo',
      payload: {
        name,
        branch,
        id,
      },
    })
  }

  currentTutorial(): string {
    return this.currentTutorialId
  }

  addRepository(name: any, branch: any) {
    void router.navigate('/home')
    store.dispatch({
      type: 'workshop/loadRepo',
      payload: {
        name,
        branch,
      },
    })
  }

  setCurrentTutorialId(id: string): void {
    this.currentTutorialId = id
  }

  clearCurrentTutorialId(): void {
    this.currentTutorialId = null
  }
}

export default new RemixClient()
