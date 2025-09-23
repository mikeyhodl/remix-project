import React from 'react'
import { MetadataType, TemplateExplorerWizardAction, TemplateExplorerWizardState, TemplateRepository } from '../types/template-explorer-types'
import { metadata, templatesRepository } from '../src/utils/helpers'

export const initialState: TemplateExplorerWizardState = {
  workspaceTemplateChosen: '',
  workspaceTemplateGroupChosen: '',
  workspaceName: '',
  defaultWorkspaceName: '',
  topLeftNagivationName: '',
  initializeAsGitRepo: false,
  workspaceGeneratedWithAi: false,
  searchTerm: '',
  metadata: metadata as MetadataType,
  templateRepository: templatesRepository as TemplateRepository || [],
  selectedTag: null,
  setSearchTerm: (term: string) => {}
}

export const templateExplorerReducer = (state: TemplateExplorerWizardState, action: any) => {
  switch (action.type) {
  case TemplateExplorerWizardAction.SET_TEMPLATE_REPOSITORY:
    return { ...state, templateRepository: action.payload }
  case TemplateExplorerWizardAction.SET_METADATA:
    return { ...state, metadata: action.payload }
  case TemplateExplorerWizardAction.SELECT_TEMPLATE:
    return action.payload
  case TemplateExplorerWizardAction.SET_WORKSPACE_TEMPLATE_GROUP:
    return action.payload
  case TemplateExplorerWizardAction.SET_WORKSPACE_NAME:
    return action.payload
  case TemplateExplorerWizardAction.SET_DEFAULT_WORKSPACE_NAME:
    return action.payload
  case TemplateExplorerWizardAction.SET_TOP_LEFT_NAVIGATION_NAME:
    return action.payload
  case TemplateExplorerWizardAction.SET_INITIALIZE_AS_GIT_REPO:
    return action.payload
  case TemplateExplorerWizardAction.SET_WORKSPACE_GENERATED_WITH_AI:
    return action.payload
  case TemplateExplorerWizardAction.END_WORKSPACE_WIZARD:
    return action.payload
  case TemplateExplorerWizardAction.SET_SELECTED_TAG: {
    return { ...state, selectedTag: action.payload }
  }
  case TemplateExplorerWizardAction.CLEAR_SELECTED_TAG: {
    return { ...state, selectedTag: null }
  }
  case TemplateExplorerWizardAction.SET_SEARCH_TERM: {
    return { ...state, searchTerm: action.payload }
  }
  default:
    return state
  }
}

function doTemplateSearch (searchTerm: string, repo: TemplateRepository) {
  if (!searchTerm) return repo
  return repo.filter(template => template.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .map(template => ({
      ...template,
      items: template.items.filter(item => item.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
    }))
}
