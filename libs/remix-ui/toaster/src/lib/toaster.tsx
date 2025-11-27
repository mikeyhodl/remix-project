import React, {useEffect} from 'react' // eslint-disable-line
import {Toaster as SonnerToaster, toast} from 'sonner'

import './toaster.css'

// Export toast so callers can use toast.dismiss(id)
export {toast}

/* eslint-disable-next-line */
export interface ToasterProps {
  message: string | JSX.Element
  timeout?: number
  handleHide?: () => void
  timestamp?: number
  id?: string | number
  onToastCreated?: (toastId: string | number) => void
}

export const Toaster = (props: ToasterProps) => {
  useEffect(() => {
    if (props.message) {
      // Show toast using Sonner
      const duration = props.timeout || 2000
      const showCloseButton = duration > 5000

      let toastId: string | number

      if (typeof props.message === 'string') {
        toastId = toast(props.message, {
          id: props.id,
          unstyled: true,
          duration,
          closeButton: showCloseButton,
          onDismiss: () => {
            props.handleHide && props.handleHide()
          },
          onAutoClose: () => {
            props.handleHide && props.handleHide()
          }
        })
      } else {
        // For JSX elements, use toast.custom
        toastId = toast.custom(
          () => (
            <div className="remixui_sonner_toast alert alert-info bg-light">
              {props.message}
            </div>
          ),
          {
            id: props.id,
            duration,
            closeButton: showCloseButton,
            onDismiss: () => {
              props.handleHide && props.handleHide()
            },
            onAutoClose: () => {
              props.handleHide && props.handleHide()
            }
          }
        )
      }

      // Call the callback with the toast ID so caller can dismiss it later
      if (props.onToastCreated) {
        props.onToastCreated(toastId)
      }
    }
  }, [props.message, props.timestamp])

  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        className: 'remixui_sonner_toast alert alert-info bg-light',
        unstyled: true
      }}
    />
  )
}

export default Toaster
