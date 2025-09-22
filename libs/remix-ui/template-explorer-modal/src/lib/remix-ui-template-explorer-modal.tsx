import React, { useContext, useMemo, useReducer, useState } from 'react'
import './remix-ui-template-explorer-modal.css'
import { appActionTypes, AppState } from '@remix-ui/app'
import { TopCardProps } from '../../types/template-explorer-types'
import { TemplateExplorerBody } from '../components/template-explorer-body'
import { TemplateCategory, TemplateItem } from '../../types/template-explorer-types'
import { metadata, templatesRepository } from '../utils/helpers'
import { TemplateExplorerContext, TemplateExplorerProvider } from '../../context/template-explorer-context'
import { initialState, templateExplorerReducer } from '../../reducers/template-explorer-reducer'

export interface RemixUiTemplateExplorerModalProps {
  dispatch: any
  appState: AppState
  plugin: any
}

const topCards: TopCardProps[] = [
  {
    title: 'Create with AI',
    description: 'Generate a workspace with AI',
    icon: 'assets/img/remixai-logoDefault.webp',
    onClick: () => alert('Create with AI'),
    importWorkspace: false
  },
  {
    title: 'Create blank',
    description: 'Create an empty workspace',
    icon: 'fa-solid fa-plus',
    onClick: () => alert('Create blank'),
    importWorkspace: false
  },
  {
    title: 'Import Project',
    description: 'Import an existing project',
    icon: 'fas fa-upload',
    onClick: () => alert('Import Project'),
    importWorkspace: true
  },
  {
    title: 'Contract Wizard',
    description: 'Create a new contract with the OpenZeppelin Wizard',
    icon: 'assets/img/openzeppelin-logo.webp',
    onClick: () => alert('Contract Wizard'),
    importWorkspace: false
  }

]

export function RemixUiTemplateExplorerModal (props: RemixUiTemplateExplorerModalProps) {

  const { selectedTag, recentTemplates, filteredTemplates, dedupedTemplates, handleTagClick, clearFilter, addRecentTemplate, allTags } = useContext(TemplateExplorerContext)
  const [state, dispatch] = useReducer(templateExplorerReducer, initialState)

  console.log('metadata', state.metadata)
  console.log('templatesRepository', state.templatesRepository)

  return (
    <TemplateExplorerProvider>
      <section className="template-explorer-modal-background" style={{ zIndex: 8888 }}>
        <div className="template-explorer-modal-container border bg-dark p-2" style={{ width: props.appState.genericModalState.width, height: props.appState.genericModalState.height }}>
          <div className="template-explorer-modal-close-container bg-dark mb-3 w-100">
            <div className="d-flex flex-row gap-2 w-100 mx-3 my-2">
              <input type="text" placeholder="Search" className="form-control template-explorer-modal-search-input ps-5" />
            </div>
            <button className="template-explorer-modal-close-button" onClick={() => props.dispatch({ type: appActionTypes.showGenericModal, payload: false })}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <TemplateExplorerBody topCards={topCards} plugin={props.plugin} />
          <div className="footer">
            {props.appState.genericModalState.footer && props.appState.genericModalState.footer}
          </div>
        </div>
      </section>
    </TemplateExplorerProvider>
  )
}
