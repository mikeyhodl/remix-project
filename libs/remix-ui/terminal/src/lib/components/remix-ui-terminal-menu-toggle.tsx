import { CustomTooltip } from '@remix-ui/helper'
import React, { useEffect, useState } from 'react' // eslint-disable-line
import { FormattedMessage } from 'react-intl'
import { RemixUiTerminalProps } from '../types/terminalTypes'
export const RemixUITerminalMenuToggle = (props: RemixUiTerminalProps) => {

  const [isPanelHidden, setIsPanelHidden] = useState(false)

  useEffect(() => {
    // Initialize panel hidden state
    const initPanelState = async () => {
      const hidden = await props.plugin.call('terminal', 'isPanelHidden')
      setIsPanelHidden(hidden)
    }
    initPanelState()

    // Listen for panel visibility changes
    const handlePanelShown = () => setIsPanelHidden(false)
    const handlePanelHidden = () => setIsPanelHidden(true)

    props.plugin.on('terminal', 'terminalPanelShown', handlePanelShown)
    props.plugin.on('terminal', 'terminalPanelHidden', handlePanelHidden)

    return () => {
      props.plugin.off('terminal', 'terminalPanelShown')
      props.plugin.off('terminal', 'terminalPanelHidden')
    }
  }, [])

  async function handleToggleTerminal(): Promise<void> {
    // Toggle the bottom terminal panel using terminal-wrap component
    await props.plugin.call('terminal', 'togglePanel')
  }

  return (
    <>
      <CustomTooltip
        placement="top"
        tooltipId="terminalToggle"
        tooltipClasses="text-nowrap"
        tooltipText={<FormattedMessage id="terminal.hideTerminal" />}
      >
        <i
          className={`mx-2 codicon codicon-close fw-bold fs-5`}
          data-id="terminalToggleIcon"
          onClick={handleToggleTerminal}
        ></i>
      </CustomTooltip>
    </>
  )
}