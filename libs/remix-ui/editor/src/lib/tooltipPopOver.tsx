import React, { useState, useRef, useEffect, useContext } from 'react'
import { RISK_CONFIG } from './web3Keywords'
import { AIEvent } from '@remix-api'
import type { IPosition } from 'monaco-editor'
//@ts-ignore
import { TrackingContext } from '@remix-ide/tracking'

export interface TooltipPopOverProps {
  keyword: string
  position: { x: number; y: number }
  onClose: () => void
  visible: boolean
  plugin?: any
  line?: string
  context?: { above: string; below: string }
  isSelectedText?: boolean
}

interface KeywordData {
  title: string
  body: string
  risk: 'high' | 'medium' | 'low'
  riskLabel: string
}

// Utility function to open contextual tooltip
export const openContextualTooltip = (
  position: IPosition,
  editorRef: any,
  monacoRef: any,
  setTooltipData: (data: any) => void,
  trackMatomoEvent: (event: any) => void
) => {
  if (!editorRef.current) return
  const model = editorRef.current.getModel()
  if (!model) return

  // Check if there's selected text first
  const selection = editorRef.current.getSelection()
  const selectedText = selection && !selection.isEmpty() 
    ? model.getValueInRange(selection)
    : null

  let hoveredExpression = ''
  let isSelectedText = false
  let lineContent = ''
  let lineAbove = ''
  let lineBelow = ''
  
  if (selectedText && selectedText.trim().length > 0) {
    // Use selected text if available
    hoveredExpression = selectedText.trim()
    isSelectedText = true
    
    // For selected text, use the line where selection starts (no context needed)
    const selectionStartLine = selection.getStartPosition().lineNumber
    lineContent = model.getLineContent(selectionStartLine)
  } else {
    // Fall back to word at position
    const wordAtPosition = model.getWordAtPosition(position)
    
    if (wordAtPosition) {
      // Get the line content to check for multi-character expressions like "msg.sender"
      lineContent = model.getLineContent(position.lineNumber)
      const startColumn = wordAtPosition.startColumn
      const endColumn = wordAtPosition.endColumn
      
      // Check for dot notation expressions (like msg.sender, tx.origin, block.timestamp)
      let expandedStart = startColumn - 1
      let expandedEnd = endColumn - 1
      
      // Expand backwards to include preceding word and dot
      while (expandedStart > 0 && /[a-zA-Z0-9_.]/.test(lineContent[expandedStart - 1])) {
        expandedStart--
      }
      
      // Expand forwards to include following dot and word  
      while (expandedEnd < lineContent.length && /[a-zA-Z0-9_.]/.test(lineContent[expandedEnd])) {
        expandedEnd++
      }
      
      hoveredExpression = lineContent.substring(expandedStart, expandedEnd)
      
      // Get context lines (line above and below)
      lineAbove = position.lineNumber > 1 
        ? model.getLineContent(position.lineNumber - 1)
        : ''
      lineBelow = position.lineNumber < model.getLineCount()
        ? model.getLineContent(position.lineNumber + 1)
        : ''
    }
  }
  
  // Only proceed if we have something to show
  if (hoveredExpression) {
    // Get screen position for tooltip
    const editorElement = editorRef.current.getDomNode()
    const editorRect = editorElement?.getBoundingClientRect()
    
    if (editorRect && monacoRef.current) {
      const lineHeight = editorRef.current.getOption(monacoRef.current.editor.EditorOption.lineHeight)
      let x, y
      
      if (isSelectedText) {
        // For selected text, position tooltip at the center of the selection
        const selectionStartPos = selection.getStartPosition()
        const selectionEndPos = selection.getEndPosition()
        const startColumn = (selectionStartPos.column + selectionEndPos.column) / 2
        const startLine = selectionStartPos.lineNumber
        
        x = editorRect.left + (startColumn - 1) * 8
        y = editorRect.top + (startLine - 1) * lineHeight + lineHeight
      } else {
        // For keyword hover, use the original positioning
        x = editorRect.left + (position.column - 1) * 8 // Approximate character width
        y = editorRect.top + (position.lineNumber - 1) * lineHeight + lineHeight
      }
      
      setTooltipData({
        keyword: hoveredExpression,
        position: { x, y },
        line: lineContent,
        context: isSelectedText ? undefined : {
          above: lineAbove,
          below: lineBelow
        },
        isSelectedText
      })
      
      // Track popup appearance with different names for selected text vs keyword
      trackMatomoEvent({ 
        category: 'ai', 
        action: 'remixAI', 
        name: isSelectedText ? 'contextual_popup_selected_text_shown' : 'contextual_popup_keyword_shown', 
        isClick: false,
        value: hoveredExpression 
      })
    }
  }
}

export const TooltipPopOver: React.FC<TooltipPopOverProps> = ({
  keyword,
  position,
  onClose,
  visible,
  plugin,
  line,
  context,
  isSelectedText = false
}) => {
  //@ts-ignore
  const { trackMatomoEvent: baseTrackEvent } = useContext(TrackingContext)
  const trackMatomoEvent = <T extends AIEvent = AIEvent>(event: T) => {
    baseTrackEvent?.<T>(event)
  }
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
        
        const prompt = isSelectedText 
          ? `Analyze this Web3/Solidity code snippet:

${keyword}

Return a JSON response with the following structure:
{
  "title": "Code Analysis",
  "body": "Brief explanation of what this code does and any security implications",
  "risk": "high|medium|low",
  "riskLabel": "Short risk description"
}

Focus on security implications and provide practical guidance for smart contract developers. The body should contain max 50 words.`
          : `Analyze the Web3/Solidity keyword "${keyword}" in the context of this code:

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

  // Add click outside listener for selected text tooltips
  useEffect(() => {
    if (!visible || !isSelectedText) return

    const handleClickOutside = (event: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    // Add delay to avoid immediate closing when tooltip appears
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 200)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [visible, isSelectedText, onClose])

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
        // For selected text, don't close automatically on mouse leave
        // User needs to click elsewhere or press Escape to close
        if (!isSelectedText) {
          setTimeout(() => {
            onClose()
          }, 100)
        }
      }}
    >
        <div className="web3-tooltip-inner">
          {loading ? (
            <div className="d-flex align-items-center gap-2">
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <span style={{ fontSize: "0.8rem" }}>
                Analyzing <b>"{isSelectedText && keyword.length > 20 
                  ? `${keyword.substring(0, 20)}...` 
                  : keyword
                }..."</b>
              </span>
            </div>
          ) : data ? (
            <>
              <div className="mb-2">
                <div className="d-flex align-items-center justify-content-between">
                  <code className="web3-tooltip-title" style={{
                    maxWidth: isSelectedText ? '200px' : 'auto',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {isSelectedText && data.title.length > 30
                      ? `${data.title.substring(0, 30)}...`
                      : data.title
                    }
                  </code>
                </div>
                {risk && data.riskLabel && (
                  <div className="mt-1">
                    <span className={`badge bg-${risk.badge} d-flex align-items-center gap-1`}
                      style={{ fontSize: "0.65rem", fontWeight: 600, width: 'fit-content' }}>
                      <i className={`${risk.icon}`} style={{ fontSize: "0.6rem" }}></i>
                      {data.riskLabel}
                    </span>
                  </div>
                )}
              </div>
              <p className="web3-tooltip-body mb-2">{data.body}</p>
              <div className="d-flex align-items-center justify-content-between">
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
                        // Track button click
                        trackMatomoEvent({ 
                          category: 'ai', 
                          action: 'remixAI', 
                          name: 'contextual_popup_open_remixai_clicked', 
                          isClick: true,
                          value: keyword 
                        })
                        const deeperPrompt = `Analyse this code snippet for security implications, and its safer use in smart contract development. If applicable, provide best practices and common pitfalls to avoid.

\`\`\`solidity
${keyword}
\`\`\``

                        await plugin.call('manager', 'activatePlugin', 'remixaiassistant')
                        await plugin.call('menuicons', 'select', 'remixaiassistant')
                        await plugin.call('remixaiassistant', 'newConversation')

                        // Small delay to ensure panel is open
                        setTimeout(async () => {
                          // Call RemixAI with editor code analysis flag
                          await plugin.call('remixaiassistant', 'chatPipe', deeperPrompt, true)
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