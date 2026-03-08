import React, { useEffect, useState } from 'react'
import { ModalDialog } from '@remix-ui/modal-dialog'
import { useDialogDispatchers } from '../../context/provider'
import { useIntl } from 'react-intl'

const OriginWarning = () => {
  const { alert } = useDialogDispatchers()
  const [content, setContent] = useState<string>(null)
  const intl = useIntl()

  useEffect(() => {
    // check the origin and warn message
    if (window.location.hostname === 'yann300.github.io') {
      setContent(intl.formatMessage({ id: 'remixApp.originWarningUnstable' }))
    } else if (
      window.location.hostname === 'alpha.remix.live' ||
      (window.location.hostname === 'ethereum.github.io' && window.location.pathname.indexOf('/remix-live-alpha') === 0)
    ) {
      setContent(intl.formatMessage({ id: 'remixApp.originWarningAlpha' }))
    } else if (
      window.location.protocol.indexOf('http') === 0 &&
      window.location.hostname !== 'remix.ethereum.org' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setContent(intl.formatMessage({ id: 'remixApp.originWarningMoved' }))
    }
  }, [])

  useEffect(() => {
    if (content) {
      alert({ id: 'warningOriging', title: null, message: content })
    }
  }, [content])

  return <></>
}

export default OriginWarning
