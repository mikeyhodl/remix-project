import React, { useContext, useEffect, useReducer } from 'react'
import './remix-ui-template-explorer-modal.css'
import { appActionTypes, AppState } from '@remix-ui/app'
import { TemplateExplorerContext } from '../../context/template-explorer-context'
import { ContractWizard } from '../components/contract-wizard'
import { WorkspaceDetails } from '../components/workspaceDetails'
import { initialState, templateExplorerReducer } from '../../reducers/template-explorer-reducer'
import { TemplateExplorerBody } from '../components/template-explorer-body'
import { TemplateExplorerWizardAction } from '../../types/template-explorer-types'
import { GenericWorkspaceTemplate } from '../components/genericWorkspaceTemplate'
import { GenerateWorkspaceWithAi } from '../components/generateWorkspaceWithAi'

export interface RemixUiTemplateExplorerModalProps {
  dispatch: any
  appState: AppState
  plugin: any
}

export function RemixUiTemplateExplorerModal (props: RemixUiTemplateExplorerModalProps) {

  const { plugin, setSearchTerm, state, dispatch } = useContext(TemplateExplorerContext)

  return (
    <section>
      <section className="template-explorer-modal-background" style={{ zIndex: 8888 }}>
        <div className="template-explorer-modal-container border bg-dark p-2" style={{ width: props.appState.genericModalState.width, height: props.appState.genericModalState.height }}>
          <div className="template-explorer-modal-close-container bg-dark mb-3 w-100 d-flex flex-row justify-content-between align-items-center">
            {state.wizardStep === 'template' ? <div className="d-flex flex-row gap-2 w-100 mx-3 my-2">
              <input
                type="text"
                placeholder="Search"
                className="form-control template-explorer-modal-search-input ps-5 fw-light"
                style={{ color: plugin?.theme?.currentTheme().name === 'Light' ? '#1B1D24' : '#FFF' }}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div> : <div>
              <div className="d-flex flex-row gap-2 w-100 mx-1 my-2">
                <button className="btn" onClick={() => {
                  dispatch({ type: TemplateExplorerWizardAction.SET_WIZARD_STEP, payload: 'reset' })
                  dispatch({ type: TemplateExplorerWizardAction.SELECT_TEMPLATE, payload: '' })
                  dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_TEMPLATE_GROUP, payload: '' })
                  dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_NAME, payload: '' })
                }}>
                  <i className="fa-solid fa-chevron-left me-2"></i>
                  Template List
                </button>
              </div>
            </div>}
            <button className="template-explorer-modal-close-button" onClick={() => props.dispatch({ type: appActionTypes.showGenericModal, payload: false })}>
              <i className="fa-solid fa-xmark text-dark"></i>
            </button>
          </div>
          {state.wizardStep === 'template' || state.wizardStep === 'reset' ? <TemplateExplorerBody plugin={props.plugin} /> : null}
          {state.wizardStep === 'generic' ? <GenericWorkspaceTemplate /> : null}
          {state.wizardStep === 'genAI' ? <GenerateWorkspaceWithAi /> : null}
          {state.wizardStep === 'wizard' ? <ContractWizard /> : null}
          {state.wizardStep === 'remixdefault' ? <WorkspaceDetails strategy={state} /> : null}
        </div>
      </section>
    </section>
  )
}
