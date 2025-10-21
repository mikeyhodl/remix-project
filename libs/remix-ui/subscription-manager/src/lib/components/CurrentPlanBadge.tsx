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
      <div className="card-body text-center">
        {imageUrl && (
          <img 
            src={imageUrl} 
            alt={planName}
            style={{ maxHeight: '32px', objectFit: 'contain', marginBottom: '8px' }}
          />
        )}
        <h6 className="mb-2">{planName}</h6>
        <div className="mb-2">
          <span className="h5 fw-bold">{price}</span>
          <span className="text-muted">/{interval}</span>
        </div>
        <span className="badge bg-success">Current Plan</span>
      </div>
    </div>
  )
}
