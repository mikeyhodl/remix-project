import React, { useState, useRef, useEffect } from 'react'
import { RISK_CONFIG } from './web3Keywords'

export interface TooltipPopOverProps {
  keyword: string
  position: { x: number; y: number }
  onClose: () => void
  visible: boolean
  plugin?: any
  line?: string
  context?: { above: string; below: string }
}

interface KeywordData {
  title: string
  body: string
  risk: 'high' | 'medium' | 'low'
  riskLabel: string
}

export const TooltipPopOver: React.FC<TooltipPopOverProps> = ({
  keyword,
  position,
  onClose,
  visible,
  plugin,
  line,
  context
}) => {
  const popRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState(position)
  const [data, setData] = useState<KeywordData | null>(null)
  const [loading, setLoading] = useState(true)
  const risk = data ? RISK_CONFIG[data.risk] : null

  // Fetch keyword data from remixAI
  useEffect(() => {
    if (!visible || !plugin || !keyword) return

    const fetchKeywordInfo = async () => {
      setLoading(true)
      try {
        const contextLines = context 
          ? `${context.above ? `Line above: ${context.above}` : ''}\nCurrent line: ${line || ''}\n${context.below ? `Line below: ${context.below}` : ''}`
          : line || ''
        
        const prompt = `Analyze the Web3/Solidity keyword "${keyword}" in the context of this code:

${contextLines}

Return a JSON response with the following structure:
{
  "title": "${keyword}",
  "body": "Brief explanation of what this keyword does and any security implications in this specific context",
  "risk": "high|medium|low",
  "riskLabel": "Short risk description"
}

Focus on security implications and provide practical guidance for smart contract developers. The body should contain max 40 words. Consider the specific usage context from the surrounding code lines.`
        const response = await plugin.call('remixAI', 'basic_prompt', prompt)
        
        // Parse the JSON response
        let parsedData: KeywordData
        try {
          // Try to extract JSON from the response
          const jsonMatch = response.result.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            parsedData = JSON.parse(jsonMatch[0])
          } else {
            // Fallback if no JSON found
            parsedData = {
              title: keyword,
              body: response || `Information about ${keyword}`,
              risk: 'medium' as const,
              riskLabel: 'Review needed'
            }
          }
        } catch (parseError) {
          // Fallback for parsing errors
          parsedData = {
            title: keyword,
            body: response || `Information about ${keyword}`,
            risk: 'medium' as const,
            riskLabel: 'Review needed'
          }
        }
        
        setData(parsedData)
      } catch (error) {
        console.error('Failed to fetch keyword info:', error)
        // Fallback data
        setData({
          title: keyword,
          body: `Unable to fetch information about ${keyword}`,
          risk: 'medium' as const,
          riskLabel: 'Unknown'
        })
      } finally {
        setLoading(false)
      }
    }

    fetchKeywordInfo()
  }, [keyword, visible, plugin, line, context])

  // Position adjustment effect
  useEffect(() => {
    if (!popRef.current || !visible) return

    const popup = popRef.current
    const rect = popup.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let { x, y } = position
    const margin = 10

    // Adjust horizontal position if popup would overflow
    if (x + rect.width > viewportWidth - margin) {
      x = viewportWidth - rect.width - margin
    }
    if (x < margin) {
      x = margin
    }

    // Adjust vertical position if popup would overflow
    // Position above the cursor to avoid mouse leave issues
    y = position.y - rect.height - 10 // Position above cursor with small offset
    
    // If positioning above would go off screen, position below but closer to cursor
    if (y < margin) {
      y = position.y + 25 // Position closer below cursor
    }

    setAdjustedPosition({ x, y })
  }, [position, visible, data])

  if (!visible) return null

  return (
    <div
      ref={popRef}
      className="web3-tooltip-popup"
      style={{
        position: 'fixed',
        top: adjustedPosition.y,
        left: adjustedPosition.x,
        zIndex: 10000,
        pointerEvents: 'auto', // Enable pointer events for button interactions
      }}
      onMouseLeave={() => {
        // Close tooltip when mouse leaves the tooltip area
        setTimeout(() => {
          onClose()
        }, 100)
      }}
    >
        <div className="web3-tooltip-inner">
          {loading ? (
            <div className="d-flex align-items-center gap-2">
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <span style={{ fontSize: "0.8rem" }}>Analyzing {keyword}...</span>
            </div>
          ) : data ? (
            <>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <code className="web3-tooltip-title">{data.title}</code>
                {risk && (
                  <span className={`badge bg-${risk.badge} d-flex align-items-center gap-1`}
                    style={{ fontSize: "0.65rem", fontWeight: 600 }}>
                    <i className={`${risk.icon}`} style={{ fontSize: "0.6rem" }}></i>
                    {data.riskLabel}
                  </span>
                )}
              </div>
              <p className="web3-tooltip-body mb-2">{data.body}</p>
              <div className="d-flex align-items-center justify-content-between">
                <span className="web3-tooltip-link" style={{ fontSize: "0.72rem", color: "var(--bs-secondary)" }}>
                  <i className="fas fa-robot me-1" style={{ fontSize: "0.7rem" }}></i>
                  Powered by AI
                </span>
                <button
                  className="btn btn-link p-0"
                  style={{ 
                    fontSize: "0.7rem", 
                    color: "var(--bs-primary)",
                    textDecoration: "none",
                    pointerEvents: "auto" // Enable pointer events for this button
                  }}
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (plugin && data) {
                      try {
                        const deeperPrompt = `Go deeper into this specific concept: ${data.body}. Give me other examples, and if applicable, suggest Learneth tutorials I can do.`
                        
                        // Open RemixAI panel and show it
                        await plugin.call('popupPanel', 'showPopupPanel', true)
                        
                        // Small delay to ensure panel is open
                        setTimeout(async () => {
                          // Show right side panel if it's hidden
                          const isPanelHidden = await plugin.call('rightSidePanel', 'isPanelHidden')
                          if (isPanelHidden) {
                            await plugin.call('rightSidePanel', 'togglePanel')
                          }
                          // Call RemixAI answer function
                          await plugin.call('remixAI', 'chatPipe', deeperPrompt)
                        }, 500)
                        
                        // Close the tooltip
                        onClose()
                      } catch (error) {
                        console.error('Failed to open RemixAI:', error)
                      }
                    }
                  }}
                >
                  <i className="fas fa-external-link-alt me-1" style={{ fontSize: "0.65rem" }}></i>
                  Open in RemixAI
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: "0.8rem", color: "var(--bs-secondary)" }}>
              Failed to load information for {keyword}
            </div>
          )}
        </div>
    </div>
  )
}