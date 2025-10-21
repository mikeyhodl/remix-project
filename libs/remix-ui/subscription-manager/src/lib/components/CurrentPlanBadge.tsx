import React from 'react'

interface CurrentPlanBadgeProps {
  planName: string
  price: string
  interval: string
  imageUrl?: string
}

export const CurrentPlanBadge: React.FC<CurrentPlanBadgeProps> = ({
  planName,
  price,
  interval,
  imageUrl
}) => {
  return (
    <div className="card h-100 border-success">
      <div className="card-body text-center p-3">
        {imageUrl && (
          <img 
            src={imageUrl} 
            alt={planName}
            style={{ maxHeight: '28px', objectFit: 'contain', marginBottom: '6px' }}
          />
        )}
        <h6 className="mb-1">{planName}</h6>
        <div className="mb-2 small">
          <span className="fw-bold">{price}</span>
          <span className="text-muted">/{interval}</span>
        </div>
        <span className="badge bg-success">Current Plan</span>
      </div>
    </div>
  )
}
