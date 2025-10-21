import React from 'react'

interface NoSubscriptionViewProps {
  onUpgrade: () => void
}

export const NoSubscriptionView: React.FC<NoSubscriptionViewProps> = ({ onUpgrade }) => {
  return (
    <div className="text-center py-5">
      <i className="fas fa-rocket fa-3x text-primary mb-3"></i>
      <h4>No Active Subscription</h4>
      <p className="text-muted mb-4">
        Upgrade to access premium features and support the project
      </p>
      <button className="btn btn-primary btn-lg" onClick={onUpgrade}>
        <i className="fas fa-star me-2"></i>
        Upgrade to Pro
      </button>
    </div>
  )
}
