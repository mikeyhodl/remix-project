import React from 'react'

interface PricingCardProps {
  title: string
  price: string
  period: string
  features: string[]
  highlighted?: boolean
  onSelect: () => void
  buttonText?: string
  badge?: string
  disabled?: boolean
  imageUrl?: string
}

export const PricingCard: React.FC<PricingCardProps> = ({
  title,
  price,
  period,
  features,
  highlighted = false,
  onSelect,
  buttonText = 'Select Plan',
  badge,
  disabled = false,
  imageUrl
}) => {
  return (
    <div className={`card h-100 ${highlighted ? 'border-primary' : ''}`}>
      {badge && (
        <div className="card-header bg-primary text-white text-center">
          <small>{badge}</small>
        </div>
      )}
      <div className="card-body d-flex flex-column p-3">
        {imageUrl && (
          <div className="text-center mb-2">
            <img 
              src={imageUrl} 
              alt={title}
              style={{ maxHeight: '40px', objectFit: 'contain' }}
            />
          </div>
        )}
        <h6 className="card-title text-center mb-2">{title}</h6>
        <div className="text-center mb-3">
          <h4 className="mb-0">{price}</h4>
          <small className="text-muted">{period}</small>
        </div>
        <ul className="list-unstyled mb-3 flex-grow-1 small">
          {features.map((feature, index) => (
            <li key={index} className="mb-1">
              <i className="fas fa-check fa-sm text-success me-2"></i>
              {feature}
            </li>
          ))}
        </ul>
        <button 
          className={`btn btn-sm ${highlighted ? 'btn-primary' : 'btn-outline-primary'} w-100`}
          onClick={onSelect}
          disabled={disabled}
          title={disabled ? 'Please log in with GitHub first' : undefined}
        >
          {disabled && <i className="fas fa-lock fa-sm me-2"></i>}
          {buttonText}
        </button>
      </div>
    </div>
  )
}
