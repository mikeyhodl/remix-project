/* eslint-disable @nrwl/nx/enforce-module-boundaries */
import { GenAiStrategy, WizardStrategy, GenericStrategy, RemixDefaultStrategy, TemplateCategoryStrategy, CookbookStrategy } from '../../stategies/templateCategoryStrategy'
import { TemplateExplorerWizardAction, TemplateItem, TemplateCategory, TemplateExplorerWizardState } from '../../types/template-explorer-types'
import { createWorkspace } from 'libs/remix-ui/workspace/src/lib/actions/workspace'
import { CreateWorkspaceDeps } from '../../types/template-explorer-types'

export class TemplateExplorerModalFacade {
  plugin: any

  constructor(plugin: any) {
    this.plugin = plugin
  }
  async createWorkspace(deps: CreateWorkspaceDeps) {
    const { workspaceName, workspaceTemplateName, opts, isEmpty, cb, isGitRepo, createCommit } = deps
    await createWorkspace(workspaceName, workspaceTemplateName, opts, isEmpty, cb, isGitRepo, createCommit)
    this.plugin.emit('createWorkspaceReducerEvent', workspaceName, workspaceTemplateName, opts, false, cb, isGitRepo)
  }

  switchWizardScreen(dispatch: (action: any) => void, item: TemplateItem, template: TemplateCategory, templateCategoryStrategy: TemplateCategoryStrategy) {
    dispatch({ type: TemplateExplorerWizardAction.SELECT_TEMPLATE, payload: item })
    dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_TEMPLATE_GROUP, payload: template.name })
    dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_NAME, payload: item.value })
    if (template.name.toLowerCase() === 'generic' && !item.value.toLowerCase().includes('remixaitemplate') && item.value !== 'remixDefault') {
      templateCategoryStrategy.setStrategy(new GenericStrategy())
      templateCategoryStrategy.switchScreen(dispatch)
    } else if (template.name.toLowerCase() === 'generic' && item.value.toLowerCase().includes('remixaitemplate')) {
      templateCategoryStrategy.setStrategy(new GenAiStrategy())
      templateCategoryStrategy.switchScreen(dispatch)
    } else if (template.name.toLowerCase() === 'generic' && item.value === 'remixDefault') {
      console.log('remixdefault')
      templateCategoryStrategy.setStrategy(new RemixDefaultStrategy())
      templateCategoryStrategy.switchScreen(dispatch)
    } else if (template.name.toLowerCase().includes('zeppelin')) {
      templateCategoryStrategy.setStrategy(new WizardStrategy())
      templateCategoryStrategy.switchScreen(dispatch)
    } else if (template.name.toLowerCase().includes('cookbook')) {
      templateCategoryStrategy.setStrategy(new CookbookStrategy())
      templateCategoryStrategy.switchScreen(dispatch)
    } else if (template.name.toLowerCase() !== 'generic' && template.name.toLowerCase() !== 'zeppelin' && template.name.toLowerCase() !== 'cookbook') {
      templateCategoryStrategy.setStrategy(new GenericStrategy())
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
