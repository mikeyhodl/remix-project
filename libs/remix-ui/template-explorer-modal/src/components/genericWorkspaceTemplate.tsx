import React, { useReducer } from 'react'
import { initialState, templateExplorerReducer } from '../../reducers/template-explorer-reducer'
import { TemplateExplorerWizardAction } from '../../types/template-explorer-types'

export function GenericWorkspaceTemplate() {
  const [state, dispatch] = useReducer(templateExplorerReducer, initialState)
  return (
    <section>
      <div className="d-flex flex-column gap-3 bg-light" style={{ height: '80%' }}>
        <div>
          <label className="form-label text-uppercase small mb-1">Workspace name</label>
        </div>
        <div>
          <input type="text" className="form-control text-dark" value={state.workspaceName} onChange={(e) => dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_NAME, payload: e.target.value })} />
        </div>
      </div>
    </section>
  )
}
