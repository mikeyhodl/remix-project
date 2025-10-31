/* eslint-disable @nrwl/nx/enforce-module-boundaries */
import React, { useContext, useEffect, useReducer, useState } from 'react'
import { initialState, templateExplorerReducer } from '../../reducers/template-explorer-reducer'
import { ContractWizardAction, TemplateExplorerWizardAction } from '../../types/template-explorer-types'
import { TemplateExplorerContext } from '../../context/template-explorer-context'
import { RemixMdRenderer } from 'libs/remix-ui/helper/src/lib/components/remix-md-renderer'

export function GenericWorkspaceTemplate() {

  const { state, theme, dispatch, facade } = useContext(TemplateExplorerContext)
  const [readMe, setReadMe] = useState(null)

  useEffect(() => {
    const run = async () => {
      const readMe = await facade.getTemplateReadMeFile(state.workspaceTemplateChosen.value)
      setReadMe(readMe)
    }
    run()
  }, [state.workspaceTemplateChosen.value])

  useEffect(() => {
    console.log('state  changed', state)
  }, [state.workspaceTemplateChosen.value])

  return (
    <section className="mx-3 p-2">
      <div className="d-flex flex-column p-3 bg-light" style={{ height: state.workspaceTemplateChosen.displayName.toLowerCase() === 'stealth drop' ? '95%' : state.workspaceTemplateChosen.templateType && state.workspaceTemplateChosen.templateType.type === 'git' ? '97%' : '50%' }}>
        <div>
          <label className="form-label text-uppercase small mb-1">Workspace name</label>
        </div>
        <div>
          <input name="workspaceName" data-id={`workspace-name-${state.workspaceTemplateChosen.value}-input`} type="text" className="form-control text-dark" value={state.workspaceName} onChange={(e) => dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_NAME, payload: e.target.value })} />
        </div>

        <div className="d-flex justify-content-between align-items-center gap-3 mt-3 mb-5">
          <div className="form-check m-0">
            <>
              <input className="form-check-input" type="checkbox" id="initGit" checked={state.initializeAsGitRepo}
                onChange={(e) => dispatch({ type: ContractWizardAction.INITIALIZE_AS_GIT_REPO_UPDATE, payload: e.target.checked })} />
              <label className="form-check-label" htmlFor="initGit">Initialize as a Git repository</label>
            </>
          </div>

          <button className="btn btn-primary btn-sm mx-3" data-id={`validate-${state.workspaceTemplateChosen.value}workspace-button`} onClick={async () => {
            await facade.createWorkspace({
              workspaceName: state.workspaceName,
              workspaceTemplateName: state.workspaceTemplateChosen.value,
              opts: state.contractOptions,
              isEmpty: false,
              isGitRepo: state.initializeAsGitRepo,
              createCommit: true,
              contractContent: state.contractCode,
              contractName: state.tokenName
            })
            facade.closeWizard()
          }}>Finish</button>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: '70%' }}>
          { readMe && readMe?.type === 'md' ? <RemixMdRenderer markDownContent={readMe?.readMe} theme={theme.name} /> : <p className="text-dark">{readMe?.readMe}</p> }
        </div>
      </div>
    </section>
  )
}
