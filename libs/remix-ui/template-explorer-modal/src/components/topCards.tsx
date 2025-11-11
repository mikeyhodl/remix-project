/* eslint-disable @nrwl/nx/enforce-module-boundaries */
import React, { useContext, useEffect } from 'react'
import { TemplateExplorerContext } from '../../context/template-explorer-context'
import { TemplateExplorerWizardAction } from '../../types/template-explorer-types'
import { createWorkspace, createWorkspaceTemplate, switchToWorkspace, uploadFile, uploadFolderInTemplateExplorer } from 'libs/remix-ui/workspace/src/lib/actions/workspace'

export function TopCards() {
  const { dispatch, facade, templateCategoryStrategy, plugin, generateUniqueWorkspaceName } = useContext(TemplateExplorerContext)
  const enableDirUpload = { directory: '', webkitdirectory: '' }
  return (
    <div className="title">
      <div className="d-flex flex-row flex-wrap justify-content-center align-items-center gap-3 mb-3">
        <div
          data-id="create-blank-workspace-topcard"
          className={`explora-topcard d-flex flex-row align-items-center bg-light p-4 shadow-sm border-0`}
          onClick={() => {
            dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_TEMPLATE, payload: { value: 'blank', displayName: 'Blank', tagList: ["Blank", "Solidity"], description: 'A blank project' } })
            dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_TEMPLATE_GROUP, payload: 'Generic' })
            dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_NAME, payload: 'Blank' })
            dispatch({ type: TemplateExplorerWizardAction.SET_WIZARD_STEP, payload: 'generic' })
          }}
          style={{
            borderRadius: '10px',
            height: '76px',
            width: '298px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <span className="d-flex flex-shrink-0">
            <i className={`fa-2x fas fa-plus`}></i>
          </span>
          <span className="d-flex flex-column flex-grow-1 ms-3">
            <p className="mb-0">Create blank</p>
            <p className="mb-0 fw-light text-wrap">Create an empty workspace</p>
          </span>
        </div>
        <div
          data-id="create-with-ai-topcard"
          className={`explora-topcard d-flex flex-row align-items-center bg-light p-4 shadow-sm border-0`}
          onClick={() => {
            dispatch({ type: TemplateExplorerWizardAction.SET_WIZARD_STEP, payload: 'genAI' })
          }}
          style={{
            borderRadius: '10px',
            height: '76px',
            width: '298px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <span className="d-flex flex-shrink-0">
            <img src={'assets/img/remixai-logoDefault.webp'} style={{ width: '20px', height: '20px' }} />
          </span>
          <span className="d-flex flex-column flex-grow-1 ms-3">
            <p className="mb-0">Create with AI</p>
            <p className="mb-0 fw-light text-wrap">Generate a workspace with AI</p>
          </span>
        </div>
        <div
          data-id="contract-wizard-topcard"
          className={`explora-topcard d-flex flex-row align-items-center bg-light p-4 shadow-sm border-0`}
          onClick={() => {
            facade.switchWizardScreen(dispatch, { value: 'ozerc20', displayName: 'ERC20', tagList: ["ERC20", "Solidity"], description: 'A customizable fungible token contract' }, { name: 'OpenZeppelin', items: []}, templateCategoryStrategy)
          }}
          style={{
            borderRadius: '10px',
            height: '76px',
            width: '298px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <span className="d-flex flex-shrink-0">
            <img src={'assets/img/openzeppelin-logo.png'} style={{ width: '20px', height: '20px' }} />
          </span>
          <span className="d-flex flex-column flex-grow-1 ms-3">
            <p className="mb-0">Contract Wizard</p>
            <p className="mb-0 fw-light text-wrap">Create a new contract with the OpenZeppelin Wizard</p>
          </span>
        </div>
        <div
          data-id="import-project-topcard"
          className="explora-topcard d-flex flex-row align-items-center p-4 bg-light shadow-sm border-0"
          style={{
            borderRadius: '10px',
            height: '76px',
            width: '298px',
            cursor: 'pointer',
            transition: 'background 0.3s, transform 0.2s, box-shadow 0.2s'
          }}
          onClick={() => document.getElementById('importProjectInput')?.click()}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <input
            type="file"
            id="importProjectInput"
            multiple
            className="d-none"
            onChange={async (e) => {
              e.stopPropagation()
              if (e.target.files.length === 0 || !e.target.files) return
              let relativePath = e.target.files[0].webkitRelativePath
              let targetFolder = relativePath.split('/')[0]
              const result = await generateUniqueWorkspaceName(targetFolder)
              await createWorkspace(result, 'blank', {}, false, undefined, false, false, undefined, undefined)
              await switchToWorkspace(result)
              await uploadFile(e.target, '/')
              facade.closeWizard()
              relativePath = null
              targetFolder = null
            }}
            {...enableDirUpload}
          />

          <span className="d-flex flex-shrink-0">
            <i className="fa-2x fas fa-upload"></i>
          </span>

          <span className="d-flex flex-column flex-grow-1 ms-3">
            <p className="mb-0">Import Project</p>
            <p className="mb-0 fw-light text-wrap">Import an existing project</p>
          </span>
        </div>
      </div>
    </div>
  )
}
