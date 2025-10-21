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
      <div className="card-body d-flex flex-column">
        {imageUrl && (
          <div className="text-center mb-3">
            <img 
              src={imageUrl} 
              alt={title}
              style={{ maxHeight: '60px', objectFit: 'contain' }}
            />
          </div>
        )}
        <h5 className="card-title text-center">{title}</h5>
        <div className="text-center mb-4">
          <h2 className="display-4">{price}</h2>
          <p className="text-muted">{period}</p>
        </div>
        <ul className="list-unstyled mb-4 flex-grow-1">
          {features.map((feature, index) => (
            <li key={index} className="mb-2">
              <i className="fas fa-check text-success me-2"></i>
              {feature}
            </li>
          ))}
        </ul>
        <button 
          className={`btn ${highlighted ? 'btn-primary' : 'btn-outline-primary'} w-100`}
          onClick={onSelect}
          disabled={disabled}
          title={disabled ? 'Please log in with GitHub first' : undefined}
        >
          {disabled && <i className="fas fa-lock me-2"></i>}
          {buttonText}
        </button>
      </div>
    </div>
  )
}
