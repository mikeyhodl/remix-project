import React, { useContext, useReducer } from 'react'
import { TemplateExplorerWizardAction } from '../../types/template-explorer-types'
import { TemplateExplorerContext } from '../../context/template-explorer-context'
import { AppContext } from '@remix-ui/app'
import { MatomoCategories } from '@remix-api'

export function GenerateWorkspaceWithAi() {
  const { dispatch, plugin, facade, state, trackMatomoEvent } = useContext(TemplateExplorerContext)
  const { setIsAiWorkspaceBeingGenerated } = useContext(AppContext)
  return (
    <section className="tem-form-body">
      <div className="d-flex flex-row justify-content-between align-items-center">
        <label className="tem-form-label">Write a prompt to generate a workspace</label>
        <span className="badge text-primary border border-primary" style={{ fontSize: '10px' }}>Beta</span>
      </div>
      <textarea
        data-id="ai-workspace-prompt-input"
        className="form-control tem-form-input"
        onChange={(e) => dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_NAME, payload: e.target.value })}
        placeholder="I want to create a decentralized voting platform with Solidity"
        rows={10}
      />
      <div className="d-flex justify-content-end">
        <button className="btn btn-primary btn-sm" data-id="validateWorkspaceButton" onClick={async () => {
          facade.closeWizard()
          trackMatomoEvent({ category: MatomoCategories.TEMPLATE_EXPLORER_MODAL, action: 'createWorkspaceWithAiRequestSent', name: state.workspaceName, isClick: true })
          await plugin.call('remixaiassistant', 'chatPipe', '/generate ' + state.workspaceName)
        }}>
          <i className="fa-solid fa-magic me-2"></i>
          Generate my Workspace
        </button>
      </div>
    </section>
  )
}
