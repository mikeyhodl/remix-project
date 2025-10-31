import React, { useContext, useEffect, useReducer } from 'react'
import './remix-ui-template-explorer-modal.css'
import { appActionTypes, AppState } from '@remix-ui/app'
import { TemplateExplorerContext } from '../../context/template-explorer-context'
import { ContractWizard } from '../components/contract-wizard'
import { WorkspaceDetails } from '../components/workspaceDetails'
import { initialState, templateExplorerReducer } from '../../reducers/template-explorer-reducer'
import { TemplateExplorerBody } from '../components/template-explorer-body'
import { TemplateExplorerWizardAction, TemplateExplorerWizardState } from '../../types/template-explorer-types'
import { GenericWorkspaceTemplate } from '../components/genericWorkspaceTemplate'
import { GenerateWorkspaceWithAi } from '../components/generateWorkspaceWithAi'
import { FinalScreen } from '../components/finalScreen'
import { ScriptsFinalScreen } from '../components/scriptsFinalScreen'

export interface RemixUiTemplateExplorerModalProps {
  dispatch: any
  appState: AppState
}

export function RemixUiTemplateExplorerModal (props: RemixUiTemplateExplorerModalProps) {

  const { setSearchTerm, state, dispatch, facade, theme } = useContext(TemplateExplorerContext)

  return (
    <section data-id="template-explorer-modal-react">
      <section className="template-explorer-modal-background" style={{ zIndex: 8888 }}>
        <div className="template-explorer-modal-container border bg-dark p-2" style={{ width: props.appState.genericModalState.width, height: props.appState.genericModalState.height }}>
          <div className="template-explorer-modal-close-container bg-dark mb-3 w-100 d-flex flex-row justify-content-between align-items-center">
            {state.wizardStep === 'template' || state.wizardStep === 'reset' ? <div className="d-flex flex-row gap-2 w-100 mx-3 my-2">
              <input
                type="text"
                name="template-explorer-search"
                data-id="template-explorer-search-input"
                placeholder="Search"
                className="form-control template-explorer-modal-search-input ps-5 fw-light"
                style={{ color: theme?.name === 'Light' ? '#1B1D24' : '#FFF' }}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div> : <div>
              <div className="d-flex flex-row gap-2 w-100 mx-1 my-2">
                <button className="btn" onClick={() => {
                  facade.resetExplorerWizard(dispatch as any)
                }}>
                  <i className="fa-solid fa-chevron-left me-2"></i>
                  Template List
                </button>
              </div>
            </div>}
            <button className="template-explorer-modal-close-button" onClick={() => {
              facade.closeWizard()
            }}>
              <i className="fa-solid fa-xmark text-dark"></i>
            </button>
          </div>
          {state.wizardStep === 'template' || state.wizardStep === 'reset' ? <TemplateExplorerBody /> : null}
          {state.wizardStep === 'generic' ? <GenericWorkspaceTemplate /> : null}
          {state.wizardStep === 'genAI' ? <GenerateWorkspaceWithAi /> : null}
          {state.wizardStep === 'wizard' ? <ContractWizard /> : null}
          {state.wizardStep === 'remixdefault' ? <WorkspaceDetails strategy={state} /> : null}
          {state.wizardStep === 'confirm' ? <FinalScreen /> : null}
          {/* {state.wizardStep === 'ModifyWorkspace' ? <ScriptsFinalScreen /> : null} */}
        </div>
      </section>
    </section>
  )
}

