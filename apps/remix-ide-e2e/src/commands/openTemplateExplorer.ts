/* eslint-disable @typescript-eslint/no-unused-vars */
import EventEmitter from 'events'
import { NightwatchBrowser } from 'nightwatch'

class OpenTemplateExplorer extends EventEmitter {

  command (this: NightwatchBrowser) {
    this.api.perform((done) => {
      openTemplateExplorer(this.api, () => {
        done()
        this.api.pause(2000).perform(() => this.emit('complete'))
      })
    })
    return this
  }
}

function openTemplateExplorer (browser: NightwatchBrowser, done: VoidFunction) {
  browser.perform((done) => {
    browser
      .click('*[data-id="workspacesSelect"]')
      .pause(3000)
      .click('*[data-id="workspacecreate"]')
      .waitForElementVisible('*[data-id="template-explorer-modal-react"]')
      .waitForElementVisible('*[data-id="template-explorer-template-container"]')
      .click('*[data-id="template-explorer-template-container"]')
      .perform(() => {
        done()
      })
  })
}

module.exports = OpenTemplateExplorer
