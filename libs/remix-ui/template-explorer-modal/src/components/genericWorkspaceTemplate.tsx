import React, { useContext, useReducer } from 'react'
import { initialState, templateExplorerReducer } from '../../reducers/template-explorer-reducer'
import { ContractWizardAction, TemplateExplorerWizardAction } from '../../types/template-explorer-types'
import { TemplateExplorerContext } from '../../context/template-explorer-context'

export function GenericWorkspaceTemplate() {

  const { state, dispatch, facade } = useContext(TemplateExplorerContext)

  return (
    <section className="mx-3 p-2">
      <div className="d-flex flex-column p-3 bg-light" style={{ minHeight: '80%' }}>
        <div>
          <label className="form-label text-uppercase small mb-1">Workspace name</label>
        </div>
        <div>
          <input type="text" className="form-control text-dark" value={state.workspaceName} onChange={(e) => dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_NAME, payload: e.target.value })} />
        </div>

        <div className="d-flex justify-content-between align-items-center gap-3 mt-3">
          <div className="form-check m-0">
            <>
              <input className="form-check-input" type="checkbox" id="initGit" checked={state.initializeAsGitRepo}
                onChange={(e) => dispatch({ type: ContractWizardAction.INITIALIZE_AS_GIT_REPO_UPDATE, payload: e.target.checked })} />
              <label className="form-check-label" htmlFor="initGit">Initialize as a Git repository</label>
            </>
          </div>

          <button className="btn btn-primary btn-sm" data-id="validateWorkspaceButton" onClick={async () => {
            console.log('about to create workspace generic')
            await facade.createWorkspace({
              workspaceName: state.workspaceTemplateChosen.displayName,
              workspaceTemplateName: state.workspaceTemplateChosen.value,
              opts: { },
              isEmpty: false,
              isGitRepo: state.initializeAsGitRepo,
              createCommit: true
            })
          }}>Create workspace</button>
        </div>
      </div>
    </section>
  )
}
