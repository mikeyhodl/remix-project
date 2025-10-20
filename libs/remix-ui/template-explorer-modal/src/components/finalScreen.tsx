import React, { useContext, useState } from 'react'
import { MiniFileExplorer } from './miniFileExplorer'
import { Editor } from '@monaco-editor/react'
import { ContractWizardAction, TemplateExplorerWizardAction } from '../../types/template-explorer-types'
import { storageContractCode, ownerContractCode, ballotContractCode } from '../contractCode/remixDefault'
import { TemplateExplorerContext } from '../../context/template-explorer-context'

interface FinalScreenProps {
  strategy?: any
}

export function FinalScreen(props: FinalScreenProps) {
  const { state, dispatch, facade } = useContext(TemplateExplorerContext)
  const [showEditWorkspaceName, setShowEditWorkspaceName] = useState(false)

  return (
    <section className="d-flex flex-column gap-3 bg-light" style={{ height: '80%' }}>
      <div className="pt-3 ps-3 d-flex flex-row align-items-center text-dark">
        { showEditWorkspaceName ? <input type="text" className="form-control form-control-sm" value={state.workspaceName} onChange={(e) => dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_NAME, payload: e.target.value })} /> : <span className="fw-semibold fs-6">{state.workspaceName}</span> }
        <i className="fa-solid fa-edit ms-2" onClick={() => setShowEditWorkspaceName(!showEditWorkspaceName)}></i>
      </div>

      <button className="btn btn-primary btn-sm" data-id="validateWorkspaceButton" onClick={async () => {
        console.log('about to create workspace')
        await facade.createWorkspace({
          workspaceName: state.workspaceName,
          workspaceTemplateName: state.workspaceTemplateChosen.value,
          opts: state.contractOptions,
          isEmpty: false,
          isGitRepo: false,
          createCommit: true,
          contractContent: state.contractCode,
          contractName: state.tokenName
        })

      }}>Finish</button>
    </section>
  )
}
