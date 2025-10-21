import React from 'react'

export type CheckoutMode = 'popup' | 'inline'

interface CheckoutModeSelectorProps {
  mode: CheckoutMode
  onModeChange: (mode: CheckoutMode) => void
}

export const CheckoutModeSelector: React.FC<CheckoutModeSelectorProps> = ({
  mode,
  onModeChange
}) => {
  return (
    <div className="btn-group btn-group-sm mb-3" role="group">
      <button
        type="button"
        className={`btn ${mode === 'popup' ? 'btn-primary' : 'btn-outline-primary'}`}
        onClick={() => onModeChange('popup')}
      >
        <i className="fas fa-external-link-alt me-1"></i>
        Popup
      </button>
      <button
        type="button"
        className={`btn ${mode === 'inline' ? 'btn-primary' : 'btn-outline-primary'}`}
        onClick={() => onModeChange('inline')}
      >
        <i className="fas fa-window-maximize me-1"></i>
        Inline
      </button>
    </div>
  )
}
