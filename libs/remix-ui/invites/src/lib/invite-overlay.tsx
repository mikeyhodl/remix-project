import React from 'react'
import { InviteValidateResponse, InviteRedeemResponse, InviteTokenAction } from '@remix-api'
import { LoginButton } from '@remix-ui/login'
import './invite-overlay.css'

export interface InviteState {
  show: boolean
  token: string | null
  validation: InviteValidateResponse | null
  isAuthenticated: boolean
  redeeming: boolean
  redeemResult: InviteRedeemResponse | null
  error: string | null
}

interface InviteOverlayProps {
  state: InviteState
  onRedeem: (token: string) => Promise<InviteRedeemResponse>
  onClose: () => void
  onStartWalkthrough?: (slug: string) => void
}

/**
 * InviteOverlay - UI component for the InvitationManagerPlugin
 * Renders type-specific invite modals (default, beta_program, etc.)
 */
export const InviteOverlay: React.FC<InviteOverlayProps> = ({
  state,
  onRedeem,
  onClose,
  onStartWalkthrough
}) => {
  if (!state.show || !state.token || !state.validation) {
    return null
  }

  const { token, validation, isAuthenticated, redeeming, redeemResult, error } = state
  const inviteType = validation.invite_type || 'default'

  // --- Error / Invalid states ---
  if (!validation.valid) {
    return (
      <ErrorModal
        errorCode={validation.error_code}
        onClose={onClose}
        inviteType={inviteType}
      />
    )
  }

  if (validation.already_redeemed) {
    return (
      <AlreadyRedeemedModal
        redeemedAt={validation.redeemed_at}
        onClose={onClose}
        inviteType={inviteType}
      />
    )
  }

  // Already redeemed error from redeem attempt
  if (redeemResult && !redeemResult.success && redeemResult.error_code === 'ALREADY_REDEEMED') {
    return (
      <AlreadyRedeemedModal
        redeemedAt={redeemResult.redeemed_at}
        onClose={onClose}
        inviteType={inviteType}
      />
    )
  }

  // --- Success state ---
  if (redeemResult?.success) {
    const walkthroughAction = validation.actions?.find(a => a.type === 'walkthrough')
    return (
      <SuccessModal
        validation={validation}
        walkthroughAction={walkthroughAction}
        onClose={onClose}
        onStartWalkthrough={onStartWalkthrough}
        inviteType={inviteType}
      />
    )
  }

  // --- Main invite modal (type-based) ---
  if (inviteType === 'beta_program') {
    return (
      <BetaProgramInviteModal
        token={token}
        validation={validation}
        isAuthenticated={isAuthenticated}
        redeeming={redeeming}
        error={error}
        onRedeem={onRedeem}
        onClose={onClose}
      />
    )
  }

  return (
    <DefaultInviteModal
      token={token}
      validation={validation}
      isAuthenticated={isAuthenticated}
      redeeming={redeeming}
      error={error}
      onRedeem={onRedeem}
      onClose={onClose}
    />
  )
}

/* ==================== Shared Helpers ==================== */

const SWIRL_BG = 'https://raw.githubusercontent.com/remix-project-org/remix-dynamics/refs/heads/live/images/illusion.svg'

function formatExpiry(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null
  const date = new Date(expiresAt)
  const diff = date.getTime() - Date.now()
  if (diff < 0) return 'Expired'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days > 0) return `${days}d remaining`
  if (hours > 0) return `${hours}h remaining`
  return 'Expires soon'
}

function getErrorMessage(errorCode?: string): string {
  switch (errorCode) {
  case 'NOT_FOUND': return 'This invite code does not exist or is no longer valid.'
  case 'INACTIVE': return 'This invite code has been deactivated.'
  case 'EXPIRED': return 'This invite code has expired.'
  case 'NOT_STARTED': return 'This invite code is not yet active.'
  case 'EXHAUSTED':
  case 'MAX_USES_REACHED': return 'This invite code has reached its maximum number of uses.'
  case 'ALREADY_REDEEMED': return 'You have already used this invite code.'
  default: return 'This invitation is no longer valid.'
  }
}

/* ==================== Error Modal ==================== */

const ErrorModal: React.FC<{
  errorCode?: string
  onClose: () => void
  inviteType: string
}> = ({ errorCode, onClose, inviteType }) => (
  <div className="invite-overlay" onClick={onClose}>
    <div className="invite-modal-dialog" onClick={e => e.stopPropagation()}>
      <div className="invite-modal-card">
        <div className="invite-modal-left invite-modal-left--error">
          <div className="invite-modal-left-gradient invite-modal-left-gradient--error" />
          <div className="invite-modal-left-content">
            <div className="invite-modal-hero-icon">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <h3 className="invite-modal-hero-title">Invalid Invite</h3>
          </div>
        </div>
        <div className="invite-modal-right">
          <div className="invite-modal-right-header">
            <h5>Unable to Process</h5>
            <button className="invite-modal-close-btn" onClick={onClose}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="invite-modal-right-body">
            <p className="invite-modal-error-text">{getErrorMessage(errorCode)}</p>
          </div>
          <div className="invite-modal-right-footer">
            <button className="btn invite-modal-btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  </div>
)

/* ==================== Already Redeemed Modal ==================== */

const AlreadyRedeemedModal: React.FC<{
  redeemedAt?: string | null
  onClose: () => void
  inviteType: string
}> = ({ redeemedAt, onClose }) => (
  <div className="invite-overlay" onClick={onClose}>
    <div className="invite-modal-dialog" onClick={e => e.stopPropagation()}>
      <div className="invite-modal-card">
        <div className="invite-modal-left invite-modal-left--info">
          <div className="invite-modal-left-gradient invite-modal-left-gradient--info" />
          <div className="invite-modal-left-content">
            <div className="invite-modal-hero-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <h3 className="invite-modal-hero-title">Already Active</h3>
          </div>
        </div>
        <div className="invite-modal-right">
          <div className="invite-modal-right-header">
            <h5>Already Activated</h5>
            <button className="invite-modal-close-btn" onClick={onClose}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="invite-modal-right-body">
            <p>You have already redeemed this invite code.</p>
            {redeemedAt && (
              <p className="invite-modal-muted small">
                Activated on {new Date(redeemedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="invite-modal-right-footer">
            <button className="btn invite-modal-btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  </div>
)

/* ==================== Success Modal ==================== */

const SuccessModal: React.FC<{
  validation: InviteValidateResponse
  walkthroughAction?: InviteTokenAction
  onClose: () => void
  onStartWalkthrough?: (slug: string) => void
  inviteType: string
}> = ({ validation, walkthroughAction, onClose, onStartWalkthrough, inviteType }) => {
  const isBeta = inviteType === 'beta_program'

  const handleStartWalkthrough = () => {
    if (walkthroughAction?.walkthrough_slug && onStartWalkthrough) {
      onStartWalkthrough(walkthroughAction.walkthrough_slug)
    }
    onClose()
  }

  return (
    <div className="invite-overlay" onClick={onClose}>
      <div className="invite-modal-dialog invite-modal-dialog--wide" onClick={e => e.stopPropagation()}>
        <div className="invite-modal-card">
          <div className={`invite-modal-left ${isBeta ? 'invite-modal-left--beta' : 'invite-modal-left--success'}`}>
            <div className={`invite-modal-left-gradient ${isBeta ? 'invite-modal-left-gradient--beta' : 'invite-modal-left-gradient--success'}`} />
            <div className="invite-modal-left-content">
              <div className="invite-modal-hero-icon invite-modal-hero-icon--success">
                <i className={`fas ${isBeta ? 'fa-flask' : 'fa-check-circle'}`}></i>
              </div>
              <h3 className="invite-modal-hero-title">
                {isBeta ? 'Welcome to Beta!' : 'You\'re In!'}
              </h3>
              <p className="invite-modal-hero-subtitle">
                {isBeta
                  ? 'You\'re now part of the Remix Beta Program'
                  : `Successfully activated ${validation.name || 'your invite'}`}
              </p>
            </div>
          </div>
          <div className="invite-modal-right">
            <div className="invite-modal-right-header">
              <h5>{isBeta ? 'Beta Program Activated' : 'Invite Activated!'}</h5>
              <button className="invite-modal-close-btn" onClick={onClose}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="invite-modal-right-body">
              {isBeta ? (
                <>
                  <p className="invite-modal-success-message">
                    You now have access to cutting-edge features and tools before anyone else.
                  </p>
                  <div className="invite-modal-section">
                    <h6 className="invite-modal-section-label">WHAT'S UNLOCKED</h6>
                    <div className="invite-modal-perks-grid">
                      <div className="invite-modal-perk">
                        <i className="fas fa-cloud invite-modal-perk-icon"></i>
                        <span>Cloud Storage</span>
                      </div>
                      <div className="invite-modal-perk">
                        <i className="fas fa-robot invite-modal-perk-icon"></i>
                        <span>AI Assistant</span>
                      </div>
                      <div className="invite-modal-perk">
                        <i className="fas fa-code-branch invite-modal-perk-icon"></i>
                        <span>Remix MCP</span>
                      </div>
                      <div className="invite-modal-perk">
                        <i className="fas fa-palette invite-modal-perk-icon"></i>
                        <span>Frontend Builder</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="invite-modal-success-message">
                  <strong>{validation.name}</strong> has been activated on your account.
                </p>
              )}

              {walkthroughAction && (
                <div className="invite-modal-walkthrough-cta">
                  <div className="invite-modal-walkthrough-icon">
                    <i className="fas fa-route"></i>
                  </div>
                  <div className="invite-modal-walkthrough-text">
                    <strong>Guided Tour Available</strong>
                    <span>Take a quick walkthrough to discover what's new</span>
                  </div>
                </div>
              )}
            </div>
            <div className="invite-modal-right-footer">
              {walkthroughAction ? (
                <div className="invite-modal-footer-actions">
                  <button className="btn invite-modal-btn-secondary" onClick={onClose}>
                    Skip for now
                  </button>
                  <button className="btn invite-modal-btn-primary invite-modal-btn--glow" onClick={handleStartWalkthrough}>
                    <i className="fas fa-play me-2"></i>
                    Let's Start!
                  </button>
                </div>
              ) : (
                <button className="btn invite-modal-btn-primary w-100" onClick={onClose}>
                  Get Started
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ==================== Beta Program Invite Modal ==================== */

const BetaProgramInviteModal: React.FC<{
  token: string
  validation: InviteValidateResponse
  isAuthenticated: boolean
  redeeming: boolean
  error: string | null
  onRedeem: (token: string) => Promise<InviteRedeemResponse>
  onClose: () => void
}> = ({ token, validation, isAuthenticated, redeeming, error, onRedeem, onClose }) => (
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
              You've been invited to shape the future of Web3 tooling
            </p>
          </div>
        </div>

        {/* Right content panel */}
        <div className="invite-modal-right">
          <div className="invite-modal-right-header">
            <div>
              <h5>{validation.name || 'Beta Program'}</h5>
              <p className="invite-modal-muted mb-0">
                {validation.description || 'Join our exclusive beta testing program'}
              </p>
            </div>
            <button className="invite-modal-close-btn" onClick={onClose}>
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="invite-modal-right-body">
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

            {/* Meta badges */}
            <div className="invite-modal-meta">
              {validation.expires_at && (
                <span className="invite-modal-meta-badge">
                  <i className="fas fa-clock me-1"></i>
                  {formatExpiry(validation.expires_at)}
                </span>
              )}
              {validation.uses_remaining != null && (
                <span className="invite-modal-meta-badge">
                  <i className="fas fa-ticket-alt me-1"></i>
                  {validation.uses_remaining} left
                </span>
              )}
            </div>

            {error && (
              <div className="invite-modal-error">
                <i className="fas fa-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}
          </div>

          <div className="invite-modal-right-footer">
            {isAuthenticated ? (
              <button
                className="btn invite-modal-btn-primary invite-modal-btn--glow w-100"
                onClick={() => onRedeem(token)}
                disabled={redeeming}
              >
                {redeeming ? (
                  <><i className="fas fa-spinner fa-spin me-2"></i>Activating...</>
                ) : (
                  <><i className="fas fa-rocket me-2"></i>Join the Beta</>
                )}
              </button>
            ) : (
              <div className="w-100">
                <p className="invite-modal-muted text-center mb-3">
                  <i className="fas fa-lock me-1"></i>
                  Sign in to activate this invite
                </p>
                <LoginButton className="btn-lg w-100" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
)

/* ==================== Default Invite Modal ==================== */

const DefaultInviteModal: React.FC<{
  token: string
  validation: InviteValidateResponse
  isAuthenticated: boolean
  redeeming: boolean
  error: string | null
  onRedeem: (token: string) => Promise<InviteRedeemResponse>
  onClose: () => void
}> = ({ token, validation, isAuthenticated, redeeming, error, onRedeem, onClose }) => (
  <div className="invite-overlay" onClick={onClose}>
    <div className="invite-modal-dialog" onClick={e => e.stopPropagation()}>
      <div className="invite-modal-card">
        {/* Left swirl panel */}
        <div className="invite-modal-left invite-modal-left--default">
          <div className="invite-modal-left-gradient invite-modal-left-gradient--default" />
          <div className="invite-modal-left-content">
            <div className="invite-modal-hero-icon">
              <i className="fas fa-gift"></i>
            </div>
            <h3 className="invite-modal-hero-title">You're Invited!</h3>
          </div>
        </div>

        {/* Right content panel */}
        <div className="invite-modal-right">
          <div className="invite-modal-right-header">
            <div>
              <h5>{validation.name || 'Invitation'}</h5>
              {validation.description && (
                <p className="invite-modal-muted mb-0">{validation.description}</p>
              )}
            </div>
            <button className="invite-modal-close-btn" onClick={onClose}>
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="invite-modal-right-body">
            {/* Meta badges */}
            <div className="invite-modal-meta">
              {validation.expires_at && (
                <span className="invite-modal-meta-badge">
                  <i className="fas fa-clock me-1"></i>
                  {formatExpiry(validation.expires_at)}
                </span>
              )}
              {validation.uses_remaining != null && (
                <span className="invite-modal-meta-badge">
                  <i className="fas fa-ticket-alt me-1"></i>
                  {validation.uses_remaining} left
                </span>
              )}
            </div>

            {error && (
              <div className="invite-modal-error">
                <i className="fas fa-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}
          </div>

          <div className="invite-modal-right-footer">
            {isAuthenticated ? (
              <button
                className="btn invite-modal-btn-primary w-100"
                onClick={() => onRedeem(token)}
                disabled={redeeming}
              >
                {redeeming ? (
                  <><i className="fas fa-spinner fa-spin me-2"></i>Activating...</>
                ) : (
                  <><i className="fas fa-check me-2"></i>Activate Invite</>
                )}
              </button>
            ) : (
              <div className="w-100">
                <p className="invite-modal-muted text-center mb-3">
                  <i className="fas fa-lock me-1"></i>
                  Sign in to activate this invite
                </p>
                <LoginButton className="btn-lg w-100" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
)
