import React, { useState, useEffect, useCallback } from 'react'
import { WalkthroughDefinition } from '@remix-api'
import '../css/walkthrough.css'

interface RemixUIWalkthroughProps {
  plugin: any
  walkthroughs: WalkthroughDefinition[]
}

/**
 * RemixUIWalkthrough — a small UI panel that lists available walkthroughs
 * and lets the user start them. This gets rendered via the PluginViewWrapper
 * pattern inside the walkthrough plugin.
 */
export const RemixUIWalkthrough: React.FC<RemixUIWalkthroughProps> = ({ plugin, walkthroughs }) => {
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = walkthroughs.filter((w) =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleStart = useCallback(async (id: string) => {
    try {
      await plugin.start(id)
    } catch (e) {
      console.error('Failed to start walkthrough:', e)
    }
  }, [plugin])

  if (!walkthroughs || walkthroughs.length === 0) {
    return (
      <div className="p-3 text-muted small">
        <i className="fas fa-info-circle me-1"></i>
        No walkthroughs available. Plugins can register walkthroughs via the API.
      </div>
    )
  }

  return (
    <div className="remix-walkthrough-panel d-flex flex-column h-100">
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="Search walkthroughs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          data-id="walkthrough-search"
        />
      </div>

      {/* Walkthrough List */}
      <div className="flex-grow-1 overflow-auto px-3">
        {filtered.map((wt) => (
          <div
            key={wt.id}
            className="walkthrough-card border rounded p-3 mb-2 bg-secondary"
            data-id={`walkthrough-card-${wt.id}`}
          >
            <div className="d-flex justify-content-between align-items-start mb-1">
              <h6 className="mb-0 fw-bold">{wt.name}</h6>
              <span className="badge bg-info ms-2">{wt.steps.length} steps</span>
            </div>
            <p className="small text-muted mb-2">{wt.description}</p>
            {wt.sourcePlugin && wt.sourcePlugin !== 'unknown' && (
              <div className="small text-muted mb-2">
                <i className="fas fa-plug me-1"></i>{wt.sourcePlugin}
              </div>
            )}
            <button
              className="btn btn-sm btn-primary"
              onClick={() => handleStart(wt.id)}
              data-id={`walkthrough-start-${wt.id}`}
            >
              <i className="fas fa-play me-1"></i>
              Start Tour
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
