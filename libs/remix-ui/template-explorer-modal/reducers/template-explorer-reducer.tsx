import React from 'react'
import { MetadataType, TemplateExplorerWizardAction, TemplateExplorerWizardState, TemplateRepository, WizardStep } from '../types/template-explorer-types'
import { metadata, templatesRepository } from '../src/utils/helpers'

export const initialState: TemplateExplorerWizardState = {
  workspaceTemplateChosen: '',
  workspaceTemplateGroupChosen: '',
  workspaceName: 'workspace Name',
  defaultWorkspaceName: '',
  topLeftNagivationName: '',
  initializeAsGitRepo: false,
  workspaceGeneratedWithAi: false,
  searchTerm: '',
  metadata: metadata as MetadataType,
  templateRepository: templatesRepository as TemplateRepository || [],
  selectedTag: null,
  setSearchTerm: (term: string) => {},
  wizardStep: 'template',
  setWizardStep: (step: WizardStep) => {},
  recentBump: 0
}

export const templateExplorerReducer = (state: TemplateExplorerWizardState, action: any) => {
  switch (action.type) {
  case TemplateExplorerWizardAction.SET_TEMPLATE_REPOSITORY:
    return { ...state, templateRepository: action.payload }
  case TemplateExplorerWizardAction.SET_METADATA:
    return { ...state, metadata: action.payload }
  case TemplateExplorerWizardAction.SELECT_TEMPLATE:{
    return { ...state, workspaceTemplateChosen: action.payload }
  }
  case TemplateExplorerWizardAction.SET_WORKSPACE_TEMPLATE_GROUP:{
    return { ...state, workspaceTemplateGroupChosen: action.payload.templateGroupChosen }
  }
  case TemplateExplorerWizardAction.SET_WORKSPACE_NAME:{
    return { ...state, workspaceName: action.payload }
  }
  case TemplateExplorerWizardAction.SET_DEFAULT_WORKSPACE_NAME:
    return { ...state, defaultWorkspaceName: action.payload }
  case TemplateExplorerWizardAction.SET_TOP_LEFT_NAVIGATION_NAME:
    return { ...state, topLeftNagivationName: action.payload }
  case TemplateExplorerWizardAction.SET_INITIALIZE_AS_GIT_REPO:
    return { ...state, initializeAsGitRepo: action.payload }
  case TemplateExplorerWizardAction.SET_WORKSPACE_GENERATED_WITH_AI:
    return { ...state, workspaceGeneratedWithAi: action.payload }
  case TemplateExplorerWizardAction.END_WORKSPACE_WIZARD:
    return { ...state, wizardStep: 'finishSetup' }
  case TemplateExplorerWizardAction.SET_SELECTED_TAG: {
    return { ...state, selectedTag: action.payload }
  }
  case TemplateExplorerWizardAction.SET_RECENT_BUMP: {
    return { ...state, recentBump: action.payload }
  }
  case TemplateExplorerWizardAction.CLEAR_SELECTED_TAG: {
    return { ...state, selectedTag: null }
  }
  case TemplateExplorerWizardAction.SET_SEARCH_TERM: {
    return { ...state, searchTerm: action.payload }
  }
  case TemplateExplorerWizardAction.SET_WIZARD_STEP: {
    console.log('action.payload wizardStep', action.payload)
    return { ...state, wizardStep: action.payload }
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
