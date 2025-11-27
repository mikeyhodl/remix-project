import React, {useEffect} from 'react' // eslint-disable-line
import {Toaster as SonnerToaster, toast} from 'sonner'

import './toaster.css'

/* eslint-disable-next-line */
export interface ToasterProps {
  message: string | JSX.Element
  timeOut?: number
  handleHide?: () => void
  timestamp?: number
}

export const Toaster = (props: ToasterProps) => {
  useEffect(() => {
    if (props.message) {
      // Show toast using Sonner
      const duration = props.timeOut || 120000
      const showCloseButton = duration > 5000

      if (typeof props.message === 'string') {
        toast(props.message, {
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
        toast.custom(
          () => (
            <div className="remixui_sonner_toast alert alert-info bg-light">
              {props.message}
            </div>
          ),
          {
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
