/* eslint-disable @nrwl/nx/enforce-module-boundaries */
import { GenAiStrategy, WizardStrategy, GenericStrategy, RemixDefaultStrategy, TemplateCategoryStrategy, CookbookStrategy, ScriptsStrategy } from '../../stategies/templateCategoryStrategy'
import { TemplateExplorerWizardAction, TemplateItem, TemplateCategory, TemplateExplorerWizardState, ContractWizardAction } from '../../types/template-explorer-types'
import { createWorkspace, getWorkspaces } from 'libs/remix-ui/workspace/src/lib/actions/workspace'
import { CreateWorkspaceDeps } from '../../types/template-explorer-types'
import { appActionTypes } from 'libs/remix-ui/app/src/lib/remix-app/actions/app'
import { appProviderContextType } from 'libs/remix-ui/app/src/lib/remix-app/context/context'
import { TemplateExplorerModalPlugin } from 'apps/remix-ide/src/app/plugins/template-explorer-modal'
import { processLoading } from '@remix-ui/helper'

export class TemplateExplorerModalFacade {
  plugin: TemplateExplorerModalPlugin
  state: TemplateExplorerWizardState
  appContext: appProviderContextType
  dispatch: (action: any) => void
  uniqueWorkspaceName: string

  constructor(plugin: any, appContext: appProviderContextType,
    dispatch: (action: any) => void, state: TemplateExplorerWizardState) {
    this.plugin = plugin
    this.appContext = appContext
    this.dispatch = dispatch
    this.state = state
    this.uniqueWorkspaceName = state.workspaceName
  }
  async createWorkspace(deps: CreateWorkspaceDeps) {
    const workspaceExists = await this.plugin.call('filePanel', 'workspaceExists', deps.workspaceName)
    if (workspaceExists) {
      this.closeWizard()
      await this.plugin.call('notification', 'alert', {
        id: 'workspaceAlreadyExistsError',
        title: 'Workspace already exists',
        message: 'Please choose a different workspace name',
        type: 'error'
      })
      return
    }
    const { workspaceName, workspaceTemplateName, opts, isEmpty, cb, isGitRepo, createCommit, contractContent, contractName } = deps
    await createWorkspace(workspaceName, workspaceTemplateName, opts, isEmpty, cb, isGitRepo, createCommit, contractContent, contractName)
    this.plugin.emit('createWorkspaceReducerEvent', workspaceName, workspaceTemplateName, opts, false, cb, isGitRepo)
  }

  getUniqueWorkspaceName() {
    return this.uniqueWorkspaceName
  }

  async setUniqueWorkspaceName(workspaceName: string) {
    const uniqueName = await this.plugin.call('filePanel', 'getAvailableWorkspaceName', workspaceName) as string
    this.uniqueWorkspaceName = uniqueName
    this.dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_NAME, payload: workspaceName })
  }

  setManageCategory(category: 'Template' | 'Files') {
    this.dispatch({ type: TemplateExplorerWizardAction.SET_MANAGE_CATEGORY, payload: category })
  }

  async processLoadingExternalUrls(url: string, type: string) {
    const contentImport = {
      import: (url, loadingCb, cb) => {
        this.plugin.call('contentImport', 'import', url, loadingCb, cb)
      }
    }
    const workspaceProvider = {
      exists: async (path) => {
        return await this.plugin.call('fileManager', 'exists', path)
      },
      addExternal: async (path, content, url) => {
        const workspaceProvider = await this.plugin.call('fileManager', 'getProviderByName', 'workspace')
        return await workspaceProvider.addExternal(path, content, url)
      }
    }
    await processLoading({
      type,
      importUrl: url,
      contentImport,
      workspaceProvider,
      plugin: this.plugin,
      trackEvent: () => {},
      onSuccess: () => {
        this.closeWizard()
      },
      onError: (err) => {
        this.plugin.call('notification', 'alert', {
          id: 'importError',
          title: 'Import Error',
          message: typeof err === 'string' ? err : err.message,
          type: 'error'
        })
      }
    })
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
    dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_NAME, payload: item.displayName })
    // this.setUniqueWorkspaceName(item.displayName)
    dispatch({ type: ContractWizardAction.CONTRACT_TYPE_UPDATED, payload: item.tagList?.[0] })
    dispatch({ type: ContractWizardAction.CONTRACT_TAG_UPDATE, payload: item.tagList?.[0] })
    dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_TEMPLATE, payload: item })
    dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_TEMPLATE_GROUP, payload: template.name })

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

  async getBlankTemplateConfigFiles() {
    const files = await this.plugin.call('remix-templates', 'getBlankTemplateConfigFiles', 'blank')
    return files
  }
}
