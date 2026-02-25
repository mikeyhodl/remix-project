import React, { useState } from 'react'
import { MembershipGroup, MembershipStatusResponse } from '@remix-api'
import { LoginButton } from '@remix-ui/login'
import './invite-overlay.css'
import './membership-request-overlay.css'

export type MembershipRequestView = 'loading' | 'form' | 'submitting' | 'success' | 'pending' | 'error'

export interface MembershipRequestState {
  show: boolean
  view: MembershipRequestView
  groups: MembershipGroup[]
  selectedGroup: MembershipGroup | null
  pendingStatus: MembershipStatusResponse | null
  error: string | null
}

interface MembershipRequestOverlayProps {
  state: MembershipRequestState
  onSubmit: (groupId: number, nickname: string, email: string, comment: string) => Promise<void>
  onClose: () => void
  onLogin: () => void
}

export const MembershipRequestOverlay: React.FC<MembershipRequestOverlayProps> = ({
  state,
  onSubmit,
  onClose,
  onLogin
}) => {
  if (!state.show) return null

  const { view, selectedGroup, pendingStatus, error } = state

  if (view === 'loading') {
    return (
      <div className="invite-overlay" onClick={onClose}>
        <div className="invite-modal-dialog" onClick={e => e.stopPropagation()}>
          <div className="invite-modal-card">
            <div className="invite-modal-left invite-modal-left--beta">
              <div className="invite-modal-left-gradient invite-modal-left-gradient--beta" />
              <div className="invite-modal-left-content">
                <div className="invite-modal-hero-icon">
                  <i className="fas fa-flask"></i>
                </div>
                <h3 className="invite-modal-hero-title">Remix Beta</h3>
              </div>
            </div>
            <div className="invite-modal-right">
              <div className="invite-modal-right-body d-flex align-items-center justify-content-center" style={{ minHeight: 200 }}>
                <i className="fas fa-spinner fa-spin fa-2x" style={{ color: 'var(--bs-secondary-color, #888)' }}></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'error') {
    return (
      <div className="invite-overlay" onClick={onClose}>
        <div className="invite-modal-dialog" onClick={e => e.stopPropagation()}>
          <div className="invite-modal-card">
            <div className="invite-modal-left invite-modal-left--error">
              <div className="invite-modal-left-gradient invite-modal-left-gradient--error" />
              <div className="invite-modal-left-content">
                <div className="invite-modal-hero-icon">
                  <i className="fas fa-exclamation-triangle"></i>
                </div>
                <h3 className="invite-modal-hero-title">Oops</h3>
              </div>
            </div>
            <div className="invite-modal-right">
              <div className="invite-modal-right-header">
                <h5>Something went wrong</h5>
                <button className="invite-modal-close-btn" onClick={onClose}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="invite-modal-right-body">
                <p className="invite-modal-error-text">{error || 'An unexpected error occurred. Please try again later.'}</p>
              </div>
              <div className="invite-modal-right-footer">
                <button className="btn invite-modal-btn-secondary" onClick={onClose}>Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'success') {
    return (
      <div className="invite-overlay" onClick={onClose}>
        <div className="invite-modal-dialog invite-modal-dialog--wide" onClick={e => e.stopPropagation()}>
          <div className="invite-modal-card">
            <div className="invite-modal-left invite-modal-left--success">
              <div className="invite-modal-left-gradient invite-modal-left-gradient--success" />
              <div className="invite-modal-left-content">
                <div className="invite-modal-hero-icon invite-modal-hero-icon--success">
                  <i className="fas fa-check-circle"></i>
                </div>
                <h3 className="invite-modal-hero-title">Request Submitted!</h3>
                <p className="invite-modal-hero-subtitle">
                  We've received your request
                </p>
              </div>
            </div>
            <div className="invite-modal-right">
              <div className="invite-modal-right-header">
                <h5>You're on the list!</h5>
                <button className="invite-modal-close-btn" onClick={onClose}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="invite-modal-right-body">
                <p className="invite-modal-success-message">
                  Thanks for your interest in the <strong>Remix Beta Program</strong>! We're rolling out access in phases
                  to ensure the best experience for everyone.
                </p>
                <p className="invite-modal-success-message">
                  We'll notify you when your request is approved and you'll receive an invite to join.
                  Keep an eye on the notification bell — your invite will appear there when it's ready.
                </p>
                <div className="invite-modal-walkthrough-cta">
                  <div className="invite-modal-walkthrough-icon">
                    <i className="fas fa-bell"></i>
                  </div>
                  <div className="invite-modal-walkthrough-text">
                    <strong>What happens next?</strong>
                    <span>We review requests and approve them in waves. When approved, you'll get a notification with your personal invite link.</span>
                  </div>
                </div>
              </div>
              <div className="invite-modal-right-footer">
                <button className="btn invite-modal-btn-primary w-100" onClick={onClose}>
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'pending' && pendingStatus) {
    const createdAt = new Date(pendingStatus.request.created_at).toLocaleDateString()
    return (
      <div className="invite-overlay" onClick={onClose}>
        <div className="invite-modal-dialog" onClick={e => e.stopPropagation()}>
          <div className="invite-modal-card">
            <div className="invite-modal-left invite-modal-left--info">
              <div className="invite-modal-left-gradient invite-modal-left-gradient--info" />
              <div className="invite-modal-left-content">
                <div className="invite-modal-hero-icon">
                  <i className="fas fa-hourglass-half"></i>
                </div>
                <h3 className="invite-modal-hero-title">Under Review</h3>
              </div>
            </div>
            <div className="invite-modal-right">
              <div className="invite-modal-right-header">
                <h5>Request Pending</h5>
                <button className="invite-modal-close-btn" onClick={onClose}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="invite-modal-right-body">
                <p>You've already requested access to <strong>{pendingStatus.request.feature_group_display_name}</strong>.</p>
                <div className="membership-pending-card">
                  <div className="membership-pending-icon">
                    <i className="fas fa-clock"></i>
                  </div>
                  <div className="membership-pending-text">
                    <strong>We're reviewing your request</strong>
                    <span>Submitted on {createdAt}. You'll be notified when it's approved.</span>
                  </div>
                </div>
              </div>
              <div className="invite-modal-right-footer">
                <button className="btn invite-modal-btn-secondary w-100" onClick={onClose}>Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main form view
  return <RequestFormModal
    group={selectedGroup}
    error={error}
    submitting={view === 'submitting'}
    onSubmit={onSubmit}
    onClose={onClose}
    onLogin={onLogin}
  />
}

/* ==================== Request Form Modal ==================== */

const RequestFormModal: React.FC<{
  group: MembershipGroup | null
  error: string | null
  submitting: boolean
  onSubmit: (groupId: number, nickname: string, email: string, comment: string) => Promise<void>
  onClose: () => void
  onLogin: () => void
}> = ({ group, error, submitting, onSubmit, onClose, onLogin }) => {
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [comment, setComment] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!group) return
    onSubmit(group.id, nickname, email, comment)
  }

  return (
    <div className="invite-overlay" onClick={onClose}>
      <div className="invite-modal-dialog invite-modal-dialog--wide" onClick={e => e.stopPropagation()}>
        <div className="invite-modal-card">
          {/* Left swirl panel */}
          <div className="invite-modal-left invite-modal-left--beta">
            <div className="invite-modal-left-gradient invite-modal-left-gradient--beta" />
            <div className="invite-modal-left-content">
              <div className="invite-modal-hero-icon">
                <i className="fas fa-flask"></i>
              </div>
              <h3 className="invite-modal-hero-title">Remix Beta</h3>
              <p className="invite-modal-hero-subtitle">
                Be part of the future of Web3 tooling
              </p>
            </div>
          </div>

          {/* Right content panel */}
          <div className="invite-modal-right">
            <div className="invite-modal-right-header">
              <div>
                <h5>Request Beta Access</h5>
                <p className="invite-modal-muted mb-0">
                  {group?.description || 'Join our beta testing program and get early access to new features'}
                </p>
              </div>
              <button className="invite-modal-close-btn" onClick={onClose}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="invite-modal-right-body">
              {/* Already a beta user? */}
              <div className="membership-already-member">
                <i className="fas fa-user-check"></i>
                <span>
                  Already a beta user?{' '}
                  <button className="membership-already-member-link" onClick={onLogin}>
                    Sign in here
                  </button>
                </span>
              </div>

              {/* Benefits */}
              <div className="invite-modal-section">
                <h6 className="invite-modal-section-label">WHY JOIN</h6>
                <ul className="invite-modal-benefits">
                  <li>
                    <div className="invite-modal-benefit-dot invite-modal-benefit-dot--teal"></div>
                    <div>
                      <strong>First Access</strong>
                      <span>Try new features before anyone else</span>
                    </div>
                  </li>
                  <li>
                    <div className="invite-modal-benefit-dot invite-modal-benefit-dot--cyan"></div>
                    <div>
                      <strong>Direct Feedback</strong>
                      <span>Your input goes straight to the core team</span>
                    </div>
                  </li>
                  <li>
                    <div className="invite-modal-benefit-dot invite-modal-benefit-dot--blue"></div>
                    <div>
                      <strong>Early Mastery</strong>
                      <span>Master the new workflow before the crowd</span>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit}>
                <div className="invite-modal-section">
                  <h6 className="invite-modal-section-label">YOUR DETAILS</h6>

                  <div className="membership-form-group">
                    <label className="membership-form-label">Nickname</label>
                    <input
                      type="text"
                      className="membership-form-input"
                      placeholder="How should we call you?"
                      value={nickname}
                      onChange={e => setNickname(e.target.value)}
                      maxLength={50}
                    />
                  </div>

                  <div className="membership-form-group">
                    <label className="membership-form-label">
                      Email <span className="membership-form-hint">(optional)</span>
                    </label>
                    <input
                      type="email"
                      className="membership-form-input"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                    <div className="membership-form-hint">We'll only use this to send you your invite</div>
                  </div>

                  <div className="membership-form-group">
                    <label className="membership-form-label">
                      Comment <span className="membership-form-hint">(optional)</span>
                    </label>
                    <textarea
                      className="membership-form-textarea"
                      placeholder="Tell us what you're building or why you'd like to join..."
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      maxLength={500}
                    />
                  </div>
                </div>

                {error && (
                  <div className="invite-modal-error">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    {error}
                  </div>
                )}
              </form>
            </div>

            <div className="invite-modal-right-footer">
              <button
                className="btn invite-modal-btn-primary invite-modal-btn--glow w-100"
                onClick={handleSubmit}
                disabled={submitting || !nickname.trim()}
              >
                {submitting ? (
                  <><i className="fas fa-spinner fa-spin me-2"></i>Submitting...</>
                ) : (
                  <><i className="fas fa-rocket me-2"></i>Request Access</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
