import React, { useReducer } from 'react'
import { TemplateExplorerWizardAction } from '../../types/template-explorer-types'
import { initialState, templateExplorerReducer } from '../../reducers/template-explorer-reducer'

export function GenerateWorkspaceWithAi() {
  const [state, dispatch] = useReducer(templateExplorerReducer, initialState)
  return (
    <section>
      <div className="d-flex flex-column bg-light" style={{ height: '80%' }}>
        <div>
          <label className="form-label text-uppercase small mb-1">Workspace description</label>
        </div>
        <div>
          <textarea className="form-control text-dark" onChange={(e) => dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_NAME, payload: e.target.value })}
            placeholder="I want to create a decentralized voting platform with Solidity"
            rows={10}
          />
        </div>
      </div>
    </section>
  )
}
