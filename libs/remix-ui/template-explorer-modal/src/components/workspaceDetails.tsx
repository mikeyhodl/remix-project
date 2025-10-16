import React, { useContext } from 'react'
import { MiniFileExplorer } from './miniFileExplorer'
import { Editor } from '@monaco-editor/react'
import { ContractWizardAction } from '../../types/template-explorer-types'
import { storageContractCode, ownerContractCode, ballotContractCode } from '../contractCode/remixDefault'
import { TemplateExplorerContext } from '../../context/template-explorer-context'

interface WorkspaceDetailsProps {
  strategy?: any
}

export function WorkspaceDetails(props: WorkspaceDetailsProps) {
  const { state, dispatch, facade } = useContext(TemplateExplorerContext)

  return (
    <section className="d-flex flex-column gap-3 bg-light" style={{ height: '80%' }}>
      <div className="pt-3 ps-3 d-flex flex-row align-items-center text-dark">
        <span className="text-uppercase small ">Workspace Name</span>
        <i className="fa-solid fa-edit ms-2"></i>
      </div>
      <div className="d-flex flex-row h-100 p-3" style={{ height: '100%' }}>
        <div className="" style={{ minHeight: '80%', minWidth: '30%', borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px' }}>
          <MiniFileExplorer />
        </div>
        <div className="border" style={{ minHeight: '75%', minWidth: '70%', borderTopRightRadius: '10px', borderBottomRightRadius: '10px' }}>
          <Editor
            height="100%"
            width="100%"
            defaultLanguage="typescript"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              lineNumbers: 'off',
              theme: 'vs-dark',
              scrollbar: {
                vertical: 'hidden',
                horizontal: 'hidden'
              }
            }}
            value={storageContractCode('Storage')}
          />
        </div>
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
          console.log('about to create workspace')
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
    </section>
  )
}
