import {
  NightwatchBrowser
} from 'nightwatch'
import EventEmitter from 'events'

class ClickFunction extends EventEmitter {
  command(
    this: NightwatchBrowser,
    instanceIndex: number,
    functionIndex: number,
    expectedInput?: string[]
  ): NightwatchBrowser {
    this.api
      .execute(function (instanceIndex, functionIndex) {
        // Use JavaScript to click the button, avoiding sticky header issues
        const contractFunction = document.querySelector(`[data-id="deployedContractItem-${instanceIndex}-function-${functionIndex}"]`) as HTMLElement
        if (contractFunction) {
          contractFunction.scrollIntoView({ behavior: 'auto', block: 'center' })
          contractFunction.click()
        }
      }, [instanceIndex, functionIndex])
      .waitForElementPresent('[data-id="btnExecute"]')
      .execute(function () {
        const executeBtn = document.querySelector(`[data-id="btnExecute"]`) as HTMLElement
        if (executeBtn) {
          executeBtn.scrollIntoView({ behavior: 'auto', block: 'center' })
        }
      }, [])
      .perform(function (client, done) {
        (expectedInput || []).forEach((input, index) => {
          client.setValue(
            `[data-id="selectedFunction-${index}"]`,
            input,
            (_) => _
          )
        })
        done()
      })
      .click(`[data-id="btnExecute"]`)
      .pause(2000)
      .perform(() => {
        this.emit('complete')
      })
    return this
  }
}

module.exports = ClickFunction
