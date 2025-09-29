import React, { useContext, useReducer } from 'react'
import './remix-ui-template-explorer-modal.css'
import { appActionTypes, AppState } from '@remix-ui/app'
import { TemplateExplorerContext } from '../../context/template-explorer-context'
import { ContractWizard } from '../components/contract-wizard'
import { WorkspaceDetails } from '../components/workspaceDetails'
import { initialState, templateExplorerReducer } from '../../reducers/template-explorer-reducer'

export interface RemixUiTemplateExplorerModalProps {
  dispatch: any
  appState: AppState
  plugin: any
}

export function RemixUiTemplateExplorerModal (props: RemixUiTemplateExplorerModalProps) {

  const { plugin, setSearchTerm } = useContext(TemplateExplorerContext)
  const [state, dispatch] = useReducer(templateExplorerReducer, initialState)

  return (
    <section>
      <section className="template-explorer-modal-background" style={{ zIndex: 8888 }}>
        <div className="template-explorer-modal-container border bg-dark p-2" style={{ width: props.appState.genericModalState.width, height: props.appState.genericModalState.height }}>
          <div className="template-explorer-modal-close-container bg-dark mb-3 w-100">
            <div className="d-flex flex-row gap-2 w-100 mx-3 my-2">
              <input
                type="text"
                placeholder="Search"
                className="form-control template-explorer-modal-search-input ps-5 fw-light"
                style={{ color: plugin?.theme?.currentTheme().name === 'Light' ? '#1B1D24' : '#FFF' }}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="template-explorer-modal-close-button" onClick={() => props.dispatch({ type: appActionTypes.showGenericModal, payload: false })}>
              <i className="fa-solid fa-xmark text-dark"></i>
            </button>
          </div>
          {/* <TemplateExplorerBody plugin={props.plugin} /> */}
          {/* <WizardComponent /> */}
          {/* <ContractWizard /> */}
          <WorkspaceDetails strategy={state.strategy} />
          {/* <div className="footer">
            {props.appState.genericModalState.footer && props.appState.genericModalState.footer}
          </div> */}
        </div>
      </section>
    </section>
  )
}
