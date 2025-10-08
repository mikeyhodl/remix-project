/* eslint-disable @nrwl/nx/enforce-module-boundaries */
import { CreateWorkspaceDeps } from '../../types/template-explorer-types'
import { createWorkspace } from 'libs/remix-ui/workspace/src/lib/actions/workspace'

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
}
