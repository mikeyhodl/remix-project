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

/* ==================== Survey / Request Form Modal ==================== */

const AI_TOOLS_OPTIONS = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'copilot', label: 'GitHub Copilot' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'claude', label: 'Claude' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'remix_ai', label: 'Remix AI' },
  { id: 'other', label: 'Other' },
]

const AI_FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'A few times a week' },
  { value: 'occasionally', label: 'Occasionally' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'never', label: 'Never tried AI for coding' },
]

const REMIX_AI_RATING_OPTIONS = [
  { value: '5', label: '⭐ Excellent — it does what I need' },
  { value: '4', label: '👍 Good — room for improvement' },
  { value: '3', label: '🤷 Okay — gets the job done sometimes' },
  { value: '2', label: '👎 Limited — I usually switch to another tool' },
  { value: '1', label: '🚫 Haven\'t used it' },
]

const WILLINGNESS_OPTIONS = [
  { value: 'yes_definitely', label: 'Yes, I\'d pay for premium AI models' },
  { value: 'yes_if_good', label: 'Maybe, if the models are top-tier' },
  { value: 'only_cheap', label: 'Only if it\'s very affordable' },
  { value: 'free_only', label: 'I only use free tools' },
  { value: 'need_more_info', label: 'I\'d need to see what\'s offered first' },
]

const PRICE_RANGE_OPTIONS = [
  { value: '5-10', label: '$5–$10/month' },
  { value: '10-20', label: '$10–$20/month' },
  { value: '20-50', label: '$20–$50/month' },
  { value: '50+', label: '$50+/month' },
  { value: 'unsure', label: 'Not sure yet' },
]

const IMPORTANT_FEATURES_OPTIONS = [
  { id: 'advanced_models', label: 'Advanced AI models (GPT-4, Claude, etc.)' },
  { id: 'code_completion', label: 'Smarter code completion for Solidity' },
  { id: 'audit_analysis', label: 'AI-powered security audits' },
  { id: 'cloud_storage', label: 'Cloud workspace & storage' },
  { id: 'chat_history', label: 'Persistent AI chat history' },
  { id: 'contract_explain', label: 'Contract explanation & documentation' },
  { id: 'test_generation', label: 'AI-generated test cases' },
  { id: 'gas_optimization', label: 'Gas optimization suggestions' },
]

interface SurveyData {
  aiToolsUsed: string[]
  aiToolsOther: string
  aiFrequency: string
  remixAiRating: string
  remixAiFeedback: string
  willingnessToPayAI: string
  priceRange: string
  importantFeatures: string[]
  additionalThoughts: string
}

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
  const [emailConsent, setEmailConsent] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  const [survey, setSurvey] = useState<SurveyData>({
    aiToolsUsed: [],
    aiToolsOther: '',
    aiFrequency: '',
    remixAiRating: '',
    remixAiFeedback: '',
    willingnessToPayAI: '',
    priceRange: '',
    importantFeatures: [],
    additionalThoughts: '',
  })

  const toggleMulti = (field: 'aiToolsUsed' | 'importantFeatures', id: string) => {
    setSurvey(prev => {
      const arr = prev[field]
      return { ...prev, [field]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] }
    })
  }

  const canProceedStep1 = nickname.trim().length > 0
  const canSubmit = survey.aiFrequency && survey.willingnessToPayAI && emailConsent

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!group || !canSubmit) return

    // Serialize survey data + email consent as JSON comment
    const commentPayload = JSON.stringify({
      version: 1,
      type: 'ai_interest_survey',
      emailConsent,
      ...survey,
    })
    onSubmit(group.id, nickname, email, commentPayload)
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
                <i className="fas fa-robot"></i>
              </div>
              <h3 className="invite-modal-hero-title">Remix AI Beta</h3>
              <p className="invite-modal-hero-subtitle">
                Help us bring top-tier AI to Solidity development
              </p>

              {/* Step indicator */}
              <div className="survey-step-indicator">
                <div className={`survey-step-dot ${step >= 1 ? 'survey-step-dot--active' : ''}`}>1</div>
                <div className="survey-step-line"></div>
                <div className={`survey-step-dot ${step >= 2 ? 'survey-step-dot--active' : ''}`}>2</div>
              </div>
              <p className="invite-modal-hero-subtitle" style={{ fontSize: '0.72rem', marginTop: '0.5rem' }}>
                {step === 1 ? 'Your details' : 'AI & Pricing survey'}
              </p>
            </div>
          </div>

          {/* Right content panel */}
          <div className="invite-modal-right">
            <div className="invite-modal-right-header">
              <div>
                <h5>{step === 1 ? 'Join the AI Beta Program' : 'Help us shape Remix AI'}</h5>
                <p className="invite-modal-muted mb-0">
                  {step === 1
                    ? 'Get early access to advanced AI models for Solidity development'
                    : 'Your answers help us provide the best AI experience for Web3 developers'}
                </p>
              </div>
              <button className="invite-modal-close-btn" onClick={onClose}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="invite-modal-right-body">
              {step === 1 ? (
                <>
                  {/* What you get */}
                  <div className="invite-modal-section">
                    <h6 className="invite-modal-section-label">WHAT YOU GET</h6>
                    <ul className="invite-modal-benefits">
                      <li>
                        <div className="invite-modal-benefit-dot invite-modal-benefit-dot--teal"></div>
                        <div>
                          <strong>Premium AI Models</strong>
                          <span>Access to GPT-4, Claude, and other frontier models for Solidity</span>
                        </div>
                      </li>
                      <li>
                        <div className="invite-modal-benefit-dot invite-modal-benefit-dot--cyan"></div>
                        <div>
                          <strong>Cloud Storage</strong>
                          <span>Sync your workspace and AI chat history across devices</span>
                        </div>
                      </li>
                      <li>
                        <div className="invite-modal-benefit-dot invite-modal-benefit-dot--blue"></div>
                        <div>
                          <strong>QuickDapp AI</strong>
                          <span>Generate functional front-ends for your smart contracts instantly</span>
                        </div>
                      </li>
                      <li>
                        <div className="invite-modal-benefit-dot invite-modal-benefit-dot--teal"></div>
                        <div>
                          <strong>Shape the Product</strong>
                          <span>Your feedback directly influences which AI features we build next</span>
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* Details form */}
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
                      <label className="membership-form-label">Email</label>
                      <input
                        type="email"
                        className="membership-form-input"
                        placeholder="your@email.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                      <div className="membership-form-hint">So we can notify you when we open beta access</div>
                    </div>
                  </div>
                </>
              ) : (
                /* ===== Step 2: AI Survey ===== */
                <form onSubmit={handleSubmit}>
                  {/* Q1: AI Tools */}
                  <div className="invite-modal-section">
                    <h6 className="invite-modal-section-label">
                      <i className="fas fa-tools me-1"></i> WHICH AI TOOLS DO YOU USE FOR CODING?
                    </h6>
                    <div className="survey-chip-grid">
                      {AI_TOOLS_OPTIONS.map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          className={`survey-chip ${survey.aiToolsUsed.includes(opt.id) ? 'survey-chip--selected' : ''}`}
                          onClick={() => toggleMulti('aiToolsUsed', opt.id)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {survey.aiToolsUsed.includes('other') && (
                      <input
                        type="text"
                        className="membership-form-input mt-2"
                        placeholder="Which other tools?"
                        value={survey.aiToolsOther}
                        onChange={e => setSurvey(prev => ({ ...prev, aiToolsOther: e.target.value }))}
                        maxLength={100}
                      />
                    )}
                  </div>

                  {/* Q2: Frequency */}
                  <div className="invite-modal-section">
                    <h6 className="invite-modal-section-label">
                      <i className="fas fa-clock me-1"></i> HOW OFTEN DO YOU USE AI WHEN CODING FOR BLOCKCHAIN?
                    </h6>
                    <div className="survey-radio-list">
                      {AI_FREQUENCY_OPTIONS.map(opt => (
                        <label key={opt.value} className={`survey-radio-item ${survey.aiFrequency === opt.value ? 'survey-radio-item--selected' : ''}`}>
                          <input
                            type="radio"
                            name="aiFrequency"
                            value={opt.value}
                            checked={survey.aiFrequency === opt.value}
                            onChange={() => setSurvey(prev => ({ ...prev, aiFrequency: opt.value }))}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Q3: Remix AI Rating */}
                  <div className="invite-modal-section">
                    <h6 className="invite-modal-section-label">
                      <i className="fas fa-star me-1"></i> HOW DO YOU RATE THE CURRENT REMIX AI?
                    </h6>
                    <div className="survey-radio-list">
                      {REMIX_AI_RATING_OPTIONS.map(opt => (
                        <label key={opt.value} className={`survey-radio-item ${survey.remixAiRating === opt.value ? 'survey-radio-item--selected' : ''}`}>
                          <input
                            type="radio"
                            name="remixAiRating"
                            value={opt.value}
                            checked={survey.remixAiRating === opt.value}
                            onChange={() => setSurvey(prev => ({ ...prev, remixAiRating: opt.value }))}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                    <textarea
                      className="membership-form-textarea mt-2"
                      placeholder="Any specific feedback on Remix AI? (optional)"
                      value={survey.remixAiFeedback}
                      onChange={e => setSurvey(prev => ({ ...prev, remixAiFeedback: e.target.value }))}
                      maxLength={500}
                      style={{ minHeight: '50px' }}
                    />
                  </div>

                  {/* Q4: Willingness to pay */}
                  <div className="invite-modal-section">
                    <h6 className="invite-modal-section-label">
                      <i className="fas fa-credit-card me-1"></i> WOULD YOU PAY FOR ADVANCED AI + CLOUD FEATURES IN REMIX?
                    </h6>
                    <div className="survey-radio-list">
                      {WILLINGNESS_OPTIONS.map(opt => (
                        <label key={opt.value} className={`survey-radio-item ${survey.willingnessToPayAI === opt.value ? 'survey-radio-item--selected' : ''}`}>
                          <input
                            type="radio"
                            name="willingnessToPayAI"
                            value={opt.value}
                            checked={survey.willingnessToPayAI === opt.value}
                            onChange={() => setSurvey(prev => ({ ...prev, willingnessToPayAI: opt.value }))}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Q5: Price range — only if interested */}
                  {(survey.willingnessToPayAI === 'yes_definitely' || survey.willingnessToPayAI === 'yes_if_good' || survey.willingnessToPayAI === 'only_cheap') && (
                    <div className="invite-modal-section">
                      <h6 className="invite-modal-section-label">
                        <i className="fas fa-tag me-1"></i> WHAT MONTHLY PRICE FEELS RIGHT?
                      </h6>
                      <div className="survey-chip-grid">
                        {PRICE_RANGE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`survey-chip ${survey.priceRange === opt.value ? 'survey-chip--selected' : ''}`}
                            onClick={() => setSurvey(prev => ({ ...prev, priceRange: opt.value }))}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Q6: Important features */}
                  <div className="invite-modal-section">
                    <h6 className="invite-modal-section-label">
                      <i className="fas fa-list-check me-1"></i> WHICH FEATURES MATTER MOST TO YOU?
                    </h6>
                    <div className="survey-chip-grid">
                      {IMPORTANT_FEATURES_OPTIONS.map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          className={`survey-chip ${survey.importantFeatures.includes(opt.id) ? 'survey-chip--selected' : ''}`}
                          onClick={() => toggleMulti('importantFeatures', opt.id)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Q7: Anything else */}
                  <div className="invite-modal-section">
                    <h6 className="invite-modal-section-label">
                      <i className="fas fa-comment me-1"></i> ANYTHING ELSE YOU'D LIKE US TO KNOW?
                    </h6>
                    <textarea
                      className="membership-form-textarea"
                      placeholder="Your thoughts on AI for blockchain development, features you wish existed, etc."
                      value={survey.additionalThoughts}
                      onChange={e => setSurvey(prev => ({ ...prev, additionalThoughts: e.target.value }))}
                      maxLength={500}
                    />
                  </div>

                  {/* Email consent */}
                  <div className="survey-consent-box">
                    <label className="survey-consent-label">
                      <input
                        type="checkbox"
                        checked={emailConsent}
                        onChange={e => setEmailConsent(e.target.checked)}
                        className="survey-consent-checkbox"
                      />
                      <span>
                        I agree to receive email updates about the Remix AI beta program, including
                        access invitations and product announcements. You can unsubscribe at any time.
                      </span>
                    </label>
                  </div>

                  {error && (
                    <div className="invite-modal-error mt-2">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      {error}
                    </div>
                  )}
                </form>
              )}
            </div>

            <div className="invite-modal-right-footer">
              {step === 1 ? (
                <button
                  className="btn invite-modal-btn-primary invite-modal-btn--glow w-100"
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                >
                  <i className="fas fa-arrow-right me-2"></i>Continue to Survey
                </button>
              ) : (
                <div className="invite-modal-footer-actions">
                  <button
                    className="btn invite-modal-btn-secondary"
                    onClick={() => setStep(1)}
                    disabled={submitting}
                  >
                    <i className="fas fa-arrow-left me-1"></i>Back
                  </button>
                  <button
                    className="btn invite-modal-btn-primary invite-modal-btn--glow"
                    onClick={handleSubmit}
                    disabled={submitting || !canSubmit}
                    title={!emailConsent ? 'Please accept the email consent to continue' : !canSubmit ? 'Please answer the required questions' : ''}
                  >
                    {submitting ? (
                      <><i className="fas fa-spinner fa-spin me-2"></i>Submitting...</>
                    ) : (
                      <><i className="fas fa-rocket me-2"></i>Request Access</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
