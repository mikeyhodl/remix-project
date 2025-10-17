import React, { useContext } from 'react'
import { MiniFileExplorer } from './miniFileExplorer'
import { Editor } from '@monaco-editor/react'
import { ContractWizardAction } from '../../types/template-explorer-types'
import { storageContractCode, ownerContractCode, ballotContractCode } from '../contractCode/remixDefault'
import { TemplateExplorerContext } from '../../context/template-explorer-context'

interface FinalScreenProps {
  strategy?: any
}

export function FinalScreen(props: FinalScreenProps) {
  const { state, dispatch, facade } = useContext(TemplateExplorerContext)

  return (
    <section className="d-flex flex-column gap-3 bg-light" style={{ height: '80%' }}>
      <div className="pt-3 ps-3 d-flex flex-row align-items-center text-dark">
        <span className="text-uppercase small ">Workspace Name</span>
        <i className="fa-solid fa-edit ms-2"></i>
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
