import React, { useState } from 'react'
import { CustomTooltip } from '@remix-ui/helper'

interface FloatingActionButtonProps {
  onEditWithAI: () => void
  onExplainContract: () => void
  onCreateDapp: () => void
  onSecurityAudit: () => void
  onGasAudit: () => void
  currentFileExt?: string
  trackEvent?: (event: { category: string; action: string; name: string; isClick: boolean }) => void
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onEditWithAI,
  onExplainContract,
  onCreateDapp,
  onSecurityAudit,
  onGasAudit,
  currentFileExt,
  trackEvent
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleExpand = () => {
    const newState = !isExpanded
    setIsExpanded(newState)

    // Track FAB button toggle
    if (trackEvent) {
      trackEvent({
        category: 'editor',
        action: 'fab_button_toggle',
        name: newState ? 'expanded' : 'collapsed',
        isClick: true
      })
    }
  }

  const getExplainLabel = () => {
    if (['sol', 'vy', 'circom'].includes(currentFileExt || '')) return 'Explain contract'
    if (['js', 'ts'].includes(currentFileExt || '')) return 'Explain script'
    return 'Explain file'
  }

  const getExplainTooltip = () => {
    if (['sol', 'vy', 'circom'].includes(currentFileExt || '')) return 'Get AI explanation of your contract'
    if (['js', 'ts'].includes(currentFileExt || '')) return 'Get AI explanation of your script'
    return 'Get AI explanation of your file'
  }

  return (
    <div className="fab-container">
      {isExpanded && (
        <div className="fab-menu">
          <CustomTooltip placement="left" tooltipText="Edit your code with AI assistance">
            <button
              className="fab-menu-item"
              onClick={() => {
                if (trackEvent) {
                  trackEvent({
                    category: 'ai',
                    action: 'fab_edit_with_ai',
                    name: 'remixAI',
                    isClick: true
                  })
                }
                onEditWithAI()
                setIsExpanded(false)
              }}
            >
              <i className="fas fa-edit"></i>
              <span className="fab-menu-text">Edit with AI</span>
            </button>
          </CustomTooltip>
          <CustomTooltip placement="left" tooltipText={getExplainTooltip()}>
            <button
              className="fab-menu-item"
              onClick={() => {
                if (trackEvent) {
                  trackEvent({
                    category: 'ai',
                    action: 'fab_explain_contract',
                    name: 'remixAI',
                    isClick: true
                  })
                }
                onExplainContract()
                setIsExpanded(false)
              }}
            >
              <i className="fas fa-file-contract"></i>
              <span className="fab-menu-text">{getExplainLabel()}</span>
            </button>
          </CustomTooltip>
          <CustomTooltip placement="left" tooltipText="Generate a frontend from your contract">
            <button
              className="fab-menu-item"
              onClick={() => {
                if (trackEvent) {
                  trackEvent({
                    category: 'ai',
                    action: 'fab_create_dapp',
                    name: 'quickDapp',
                    isClick: true
                  })
                }
                onCreateDapp()
                setIsExpanded(false)
              }}
            >
              <i className="fas fa-rocket"></i>
              <span className="fab-menu-text">Generate Frontend</span>
            </button>
          </CustomTooltip>
          <CustomTooltip placement="left" tooltipText="AI-powered security audit: scans your contract for vulnerabilities and security risks">
            <button
              className="fab-menu-item"
              onClick={() => {
                if (trackEvent) {
                  trackEvent({
                    category: 'ai',
                    action: 'fab_security_audit',
                    name: 'remixAI',
                    isClick: true
                  })
                }
                onSecurityAudit()
                setIsExpanded(false)
              }}
            >
              <i className="fas fa-shield-alt"></i>
              <span className="fab-menu-text">Security Audit</span>
            </button>
          </CustomTooltip>
          <CustomTooltip placement="left" tooltipText="AI-powered gas audit: analyzes your contract for gas inefficiencies and optimization opportunities">
            <button
              className="fab-menu-item"
              onClick={() => {
                if (trackEvent) {
                  trackEvent({
                    category: 'ai',
                    action: 'fab_gas_audit',
                    name: 'remixAI',
                    isClick: true
                  })
                }
                onGasAudit()
                setIsExpanded(false)
              }}
            >
              <i className="fas fa-gas-pump"></i>
              <span className="fab-menu-text">Gas Audit</span>
            </button>
          </CustomTooltip>
        </div>
      )}
      <CustomTooltip placement="left" tooltipText="Show AI tools" hide={isExpanded}>
        <button
          className={`fab-main-button ${isExpanded ? 'fab-expanded' : ''}`}
          onClick={toggleExpand}
        >
          {isExpanded ? (
            <i className="fas fa-times"></i>
          ) : (
            <img src="assets/img/remixai-logoAI.svg" alt="AI tools" className="fab-ai-logo" />
          )}
        </button>
      </CustomTooltip>
    </div>
  )
}
