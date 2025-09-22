import React from 'react'
import { MetadataType, TemplateExplorerWizardAction, TemplateExplorerWizardState, TemplateExplorerWizardSteps } from '../types/template-explorer-types'
import { metadata, templatesRepository } from '../src/utils/helpers'

export const initialState: TemplateExplorerWizardState = {
  steps: TemplateExplorerWizardSteps.SELECT_TEMPLATE,
  workspaceTemplateChosen: '',
  workspaceTemplateGroupChosen: '',
  workspaceName: '',
  defaultWorkspaceName: '',
  topLeftNagivationName: '',
  initializeAsGitRepo: false,
  workspaceGeneratedWithAi: false,
  searchTerm: '',
  metadata: metadata as MetadataType,
  templateRepository: templatesRepository,
  selectedTag: null
}

export const templateExplorerReducer = (state: TemplateExplorerWizardState, action: any) => {
  switch (action.type) {
  case TemplateExplorerWizardAction.SET_WORKSPACE_TEMPLATE:
    return action.payload
  case TemplateExplorerWizardAction.SET_WORKSPACE_TEMPLATE_WIZARD_STEP:
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
  default:
    return state
  }
}
