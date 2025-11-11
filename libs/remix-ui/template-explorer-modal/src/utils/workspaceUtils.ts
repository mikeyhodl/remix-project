/* eslint-disable @nrwl/nx/enforce-module-boundaries */
import { GenAiStrategy, WizardStrategy, GenericStrategy, RemixDefaultStrategy, TemplateCategoryStrategy, CookbookStrategy, ScriptsStrategy } from '../../stategies/templateCategoryStrategy'
import { TemplateExplorerWizardAction, TemplateItem, TemplateCategory, TemplateExplorerWizardState, ContractTypeStrategy, ContractWizardAction, TemplateExplorerContextType } from '../../types/template-explorer-types'
import { createWorkspace, getWorkspaces } from 'libs/remix-ui/workspace/src/lib/actions/workspace'
import { CreateWorkspaceDeps } from '../../types/template-explorer-types'
import { appActionTypes } from 'libs/remix-ui/app/src/lib/remix-app/actions/app'
import { appProviderContextType } from 'libs/remix-ui/app/src/lib/remix-app/context/context'
import { WorkspaceTemplate } from 'libs/remix-ui/workspace/src/lib/types'
import { TemplateExplorerModalPlugin } from 'apps/remix-ide/src/app/plugins/remix-template-explorer-modal'
import { getErc1155ContractCode, getErc20ContractCode, getErc721ContractCode } from './contractWizardUtils'

export class TemplateExplorerModalFacade {
  plugin: TemplateExplorerModalPlugin
  state: TemplateExplorerWizardState
  appContext: appProviderContextType
  dispatch: (action: any) => void

  constructor(plugin: any, appContext: appProviderContextType,
    dispatch: (action: any) => void, state: TemplateExplorerWizardState) {
    this.plugin = plugin
    this.appContext = appContext
    this.dispatch = dispatch
    this.state = state
  }
  async createWorkspace(deps: CreateWorkspaceDeps) {
    const { workspaceName, workspaceTemplateName, opts, isEmpty, cb, isGitRepo, createCommit, contractContent, contractName } = deps
    await createWorkspace(workspaceName, workspaceTemplateName, opts, isEmpty, cb, isGitRepo, createCommit, contractContent, contractName)
    this.plugin.emit('createWorkspaceReducerEvent', workspaceName, workspaceTemplateName, opts, false, cb, isGitRepo)
  }

  closeWizard() {
    this.appContext.appStateDispatch({
      type: appActionTypes.showGenericModal,
      payload: false
    })
    this.dispatch({ type: TemplateExplorerWizardAction.RESET_STATE })
  }
  stripDisplayName(item: TemplateItem) {
    let cleanedTagName = ''
    if (item.value === 'ozerc721') {
      cleanedTagName = item.displayName.split(' ')[0]
    }
    return cleanedTagName
  }
  async switchWizardScreen(dispatch: (action: any) => void, item: TemplateItem, template: TemplateCategory, templateCategoryStrategy: TemplateCategoryStrategy) {

    dispatch({ type: ContractWizardAction.CONTRACT_TYPE_UPDATED, payload: item.tagList?.[0] })
    dispatch({ type: ContractWizardAction.CONTRACT_TAG_UPDATE, payload: item.tagList?.[0] })
    dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_TEMPLATE, payload: item })
    dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_TEMPLATE_GROUP, payload: template.name })
    dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_NAME, payload: item.displayName })

    if (template.name.toLowerCase().includes('github actions') || template.name.toLowerCase().includes('contract verification') || template.name.toLowerCase().includes('solidity create2') || template.name.toLowerCase().includes( 'generic zkp')) {
      templateCategoryStrategy.setStrategy(new ScriptsStrategy())
      templateCategoryStrategy.switchScreen(dispatch)
      await this.plugin.call('templateexplorermodal', 'addArtefactsToWorkspace', item.value, {}, false, (err: Error) => {
        if (err) {
          console.error(err)
        }
      })
      this.closeWizard()
      return
    }

    if (template.name.toLowerCase().includes('cookbook')) {
      templateCategoryStrategy.setStrategy(new CookbookStrategy())
      templateCategoryStrategy.switchScreen(dispatch)
      this.closeWizard()
      return
    }
    if (template.name.toLowerCase() !== 'generic' && template.name.toLowerCase() !== 'openzeppelin' && template.name.toLowerCase() !== 'cookbook' && template.name.toLowerCase() !== 'github actions' && template.name.toLowerCase() !== 'contract verification') {
      templateCategoryStrategy.setStrategy(new GenericStrategy())
      templateCategoryStrategy.switchScreen(dispatch)
      return
    }
    if (template.name.toLowerCase() === 'generic' && !item.value.toLowerCase().includes('remixaitemplate') && item.value !== 'remixDefault') {
      templateCategoryStrategy.setStrategy(new GenericStrategy())
      templateCategoryStrategy.switchScreen(dispatch)
      return
    }
    if (template.name.toLowerCase() === 'generic' && item.value.toLowerCase().includes('remixaitemplate')) {
      templateCategoryStrategy.setStrategy(new GenAiStrategy())
      templateCategoryStrategy.switchScreen(dispatch)
      return
    }
    if (template.name.toLowerCase() === 'generic' && item.value === 'remixDefault') {
      templateCategoryStrategy.setStrategy(new RemixDefaultStrategy())
      templateCategoryStrategy.switchScreen(dispatch)
      return
    }
    if (template.name.toLowerCase().includes('zeppelin')) {
      templateCategoryStrategy.setStrategy(new WizardStrategy())
      templateCategoryStrategy.switchScreen(dispatch)
    }
  }

  resetExplorerWizard(dispatch: (action: any) => TemplateExplorerWizardState) {
    dispatch({ type: TemplateExplorerWizardAction.SET_WIZARD_STEP, payload: 'reset' })
    dispatch({ type: TemplateExplorerWizardAction.SELECT_TEMPLATE, payload: '' })
    dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_TEMPLATE_GROUP, payload: '' })
    dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_NAME, payload: '' })
  }

  async getTemplateReadMeFile(templateName: string) {
    const readMe = await this.plugin.call('remix-templates', 'getTemplateReadMeFile', templateName)
    return { readMe: readMe.readMe, type: readMe.type }
  }
}
