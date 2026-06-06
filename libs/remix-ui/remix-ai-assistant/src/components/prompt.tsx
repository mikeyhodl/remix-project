import { ActivityType } from "../lib/types"
import React, { MutableRefObject, Ref, useContext, useEffect, useRef, useState } from 'react'
import { AiAssistantType, AiContextType, groupListType } from '../types/componentTypes'
import { AIEvent, MatomoEvent, trackMatomoEvent } from '@remix-api';
import { TrackingContext } from '@remix-ide/tracking'
import { CustomTooltip } from '@remix-ui/helper'
import { AIModel } from '@remix/remix-ai-core'
import { PromptDefault } from "./promptDefault";

// PromptArea component
export interface PromptAreaProps {
  input: any
  setInput: React.Dispatch<React.SetStateAction<string>>
  isStreaming: boolean
  handleSend: () => void
  assistantChoice: AiAssistantType
  selectedOllamaModel: any
  handleAddContext?: () => void
  handleSetModel: () => void
  handleModelSelection: (modelId: string) => void
  setShowOllamaModelSelector: React.Dispatch<React.SetStateAction<boolean>>
  showOllamaModelSelector: boolean
  handleGenerateWorkspace: () => void
  selectedModel: AIModel | null
  dispatchActivity: (type: ActivityType, payload?: any) => void
  modelBtnRef: React.RefObject<HTMLButtonElement>
  modelSelectorBtnRef: React.RefObject<HTMLButtonElement>
  textareaRef?: React.RefObject<HTMLTextAreaElement>
  showModelSelector: boolean
  setShowModelSelector: React.Dispatch<React.SetStateAction<boolean>>
  handleOllamaModelSelection: (modelId: string) => void
  ollamaModels: any[]
  themeTracker: any
  stopRequest: () => void
  autoModeEnabled?: boolean
  handleLoadSkills?: () => void
  usingOwnApiKey?: boolean
  aiRoute?: 'initializing' | 'agent' | 'tools' | 'chat'
  aiRouteReady?: boolean
  // When false the composer renders an explicit "Sign in" CTA in place
  // of the disabled send button. Without this hint the user just sees a
  // greyed-out paper plane and an "Initialising agents…" placeholder —
  // both technically accurate but confusing because the route will
  // never become ready until they authenticate.
  isAuthenticated?: boolean
  onSignIn?: () => void
}

export const PromptArea: React.FC<PromptAreaProps> = ({
  input,
  setInput,
  isStreaming,
  handleSend,
  selectedModel,
  handleSetModel,
  modelBtnRef,
  textareaRef,
  themeTracker,
  ollamaModels,
  showModelSelector,
  stopRequest,
  setShowOllamaModelSelector,
  showOllamaModelSelector,
  modelSelectorBtnRef,
  autoModeEnabled,
  usingOwnApiKey,
  aiRoute = 'chat',
  aiRouteReady = true,
  isAuthenticated = true,
  onSignIn
}) => {
  const { trackMatomoEvent: baseTrackEvent } = useContext(TrackingContext)

  useEffect(() => {
    if (textareaRef?.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  // The composer has three resting states:
  //   1. ready              → normal send/stop affordance
  //   2. !ready & authed    → disabled send (agents still booting)
  //   3. !ready & anonymous → sign-in CTA (no amount of waiting fixes it)
  // We split state 3 out so the user doesn't sit there waiting on a
  // route that can never become ready until they authenticate.
  const needsSignIn = !aiRouteReady && !isAuthenticated && !!onSignIn
  const placeholderText = needsSignIn
    ? 'Sign in to chat with RemixAI…'
    : aiRouteReady
      ? 'Ask me anything about your code or generate new contracts...'
      : 'Initialising agents…'

  return (
    <>
      <div
        className="prompt-area d-flex flex-column mx-2 p-1 rounded-3 border border-text"
        style={{ backgroundColor: themeTracker && themeTracker?.name.toLowerCase() === 'light' ? '#d9dee8' : '#222336' }}
        data-id="remix-ai-prompt-area"
      >
        <div className="ai-chat-input d-flex flex-column">
          <div
            className="d-flex flex-column rounded-3"
            style={{
              backgroundColor: themeTracker && themeTracker?.name.toLowerCase() === 'light' ? '#d9dee8' : '#222336',
              outline: 'none',
              boxShadow: 'none',
              border: 'none'
            }}
          >
            <textarea
              ref={textareaRef}
              style={{
                flexGrow: 1,
                outline: 'none',
                resize: 'none',
                font: 'inherit',
                fontSize: '0.9rem',
                color: 'inherit',
                backgroundColor: themeTracker && themeTracker?.name.toLowerCase() === 'light' ? '#d9dee8' : '#222336',
                boxShadow: 'none',
                paddingRight: isStreaming ? '50px' : '10px',
                overflowY: 'auto',
                minHeight: '2rem',
                maxHeight: '12rem'
              }}
              className="form-control border-0"
              id="remix-ai-prompt-input"
              data-id="remix-ai-prompt-input"
              value={input}
              disabled={isStreaming || !aiRouteReady}
              onChange={e => {
                setInput(e.target.value)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.shiftKey) {
                  e.preventDefault()
                  setInput(prev => prev + '\n')
                } else
                if (e.key === 'Enter' && !isStreaming && aiRouteReady) handleSend()
              }}
              placeholder={placeholderText}
            />
            <div className="d-flex flex-row align-items-center">
              {/* <div className="d-flex flex-row align-items-center"> */}
              <button
                onClick={handleSetModel}
                className="btn btn-text btn-sm small font-weight-light text-dark align-self-end border-0 rounded"
                data-assist-btn="assistant-selector-btn"
                data-id="ai-model-selector-btn"
                ref={modelBtnRef}
              >
                <div className="d-flex flex-row flex-nowrap align-items-center justify-content-center">
                  <span className="text-nowrap">
                    {autoModeEnabled ? 'Auto Mode' : (selectedModel?.displayName || 'Select Model')}
                  </span>
                  {usingOwnApiKey && (
                    <CustomTooltip tooltipText="Using your own API key">
                      <span
                        className="badge bg-success ms-2"
                        style={{ fontSize: '0.6rem', padding: '2px 4px', color: themeTracker && themeTracker?.name.toLowerCase() === 'light' ? '' :'#000' }}
                        data-id="own-api-key-badge"
                      >
                        <i className="fas fa-key me-1" style={{ fontSize: '0.5rem' }}></i>
                        Own Key
                      </span>
                    </CustomTooltip>
                  )}
                  <CustomTooltip
                    tooltipText={
                      aiRoute === 'agent'
                        ? 'DeepAgent ready — subagents + tools available'
                        : aiRoute === 'tools'
                          ? 'MCP tools ready (no subagents)'
                          : aiRoute === 'chat'
                            ? 'Plain chat — no tools or subagents'
                            : 'Initialising agents — please wait'
                    }
                  >
                    <span
                      className={`badge ms-2 ${
                        aiRoute === 'agent'
                          ? 'bg-success'
                          : aiRoute === 'tools'
                            ? 'bg-info'
                            : aiRoute === 'chat'
                              ? 'bg-secondary'
                              : 'bg-warning'
                      }`}
                      style={{ fontSize: '0.6rem', padding: '2px 4px', visibility: selectedModel ? 'visible' : 'hidden', color: themeTracker && themeTracker?.name.toLowerCase() === 'light' ? '' :'#000' }}
                      data-id="ai-route-status"
                      data-route={aiRoute}
                    >
                      {aiRoute === 'agent'
                        ? 'Agent'
                        : aiRoute === 'tools'
                          ? 'Tools'
                          : aiRoute === 'chat'
                            ? 'Chat'
                            : 'Initialising…'}
                    </span>
                  </CustomTooltip>
                  <span className={showModelSelector ? "fa fa-caret-up ms-1" : "fa fa-caret-down ms-1"}></span>
                </div>
              </button>
              {selectedModel?.provider === 'ollama' && ollamaModels.length > 0 && (
                <button
                  onClick={() => setShowOllamaModelSelector(prev => !prev)}
                  className="btn btn-text btn-sm small font-weight-light text-secondary align-self-end border border-text rounded ms-2"
                  ref={modelSelectorBtnRef}
                  data-id="ollama-model-selector"
                  data-assist-btn="assistant-selector-btn"
                >
                  <div className="d-flex flex-row flex-nowrap align-items-center justify-content-center">
                    <span>{selectedModel?.displayName || 'Select Model'}</span>
                    <span className={showOllamaModelSelector ? "fa fa-caret-up ms-1" : "fa fa-caret-down ms-1"}></span>
                  </div>
                </button>
              )}
              <PromptDefault
                // Only render the cancel/stop affordance for an actual
                // in-flight inference. When the route is merely "not
                // ready yet" (e.g. anonymous user, agents still booting)
                // we must show the disabled send button instead — a
                // stop button that cancels nothing is broken UX and
                // confused users into thinking the assistant was stuck.
                isStreaming={isStreaming}
                disabled={!aiRouteReady}
                handleSend={handleSend}
                themeTracker={themeTracker}
                handleCancel={stopRequest}
                showSignIn={needsSignIn}
                onSignIn={onSignIn}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

