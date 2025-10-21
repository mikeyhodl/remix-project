import React from 'react'

export type CheckoutMode = 'inline' | 'overlay'

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
        className={`btn ${mode === 'inline' ? 'btn-primary' : 'btn-outline-primary'}`}
        onClick={() => onModeChange('inline')}
      >
        <i className="fas fa-window-maximize me-1"></i>
        Inline
      </button>
      <button
        type="button"
        className={`btn ${mode === 'overlay' ? 'btn-primary' : 'btn-outline-primary'}`}
        onClick={() => onModeChange('overlay')}
      >
        <i className="fas fa-layer-group me-1"></i>
        Overlay
      </button>
    </div>
  )
}
