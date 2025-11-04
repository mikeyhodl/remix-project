/* eslint-disable @nrwl/nx/enforce-module-boundaries */
import React,{ useContext, useEffect, useRef, useState } from 'react'
import Editor, { Monaco } from '@monaco-editor/react'
import * as erc20 from '../contractCode/erc20'
import { AccessControlType, ContractTypeStrategy, ContractWizardAction, TemplateExplorerWizardAction } from '../../types/template-explorer-types'
import { getErc1155ContractCode, getErc20ContractCode, getErc721ContractCode } from '../utils/contractWizardUtils'
import { TemplateExplorerContext } from '../../context/template-explorer-context'
import CodeMirror from '@uiw/react-codemirror'
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode'
import { javascript } from '@codemirror/lang-javascript'
import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Highlighter, tags as t } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'
import { createNonClashingNameAsync, createNonClashingTitle } from 'libs/remix-ui/helper/src/lib/remix-ui-helper'

const defaultStrategy: ContractTypeStrategy = {
  contractType: 'erc20',
  contractOptions: {
    mintable: false,
    burnable: false,
    pausable: false
  },
  contractAccessControl: '',
  contractUpgradability: {
    uups: false,
    transparent: false
  },
  contractCode: erc20.erc20DefaultNoOptions('MyToken'),
  contractImport: '',
  initializeAsGitRepo: false
}

export function ContractWizard () {
  const [showEditModal, setShowEditModal] = useState(false)
  const { state, dispatch, theme, facade, plugin } = useContext(TemplateExplorerContext)
  const strategy = state
  const monacoRef = useRef<Monaco>(null)

  function toggleContractOption(key: keyof typeof strategy.contractOptions) {
    if (key === 'mintable') {
      dispatch({ type: ContractWizardAction.CONTRACT_OPTIONS_UPDATE, payload: { ...strategy.contractOptions, [key]: !strategy.contractOptions[key] } })
      switchAccessControl('ownable')
    } else if (key === 'pausable') {
      dispatch({ type: ContractWizardAction.CONTRACT_OPTIONS_UPDATE, payload: { ...strategy.contractOptions, [key]: !strategy.contractOptions[key] } })
      switchAccessControl('ownable')
    }
    dispatch({ type: ContractWizardAction.CONTRACT_OPTIONS_UPDATE, payload: { ...strategy.contractOptions, [key]: !strategy.contractOptions[key] } })
  }

  function switchAccessControl(accessControl: AccessControlType) {
    dispatch({ type: ContractWizardAction.CONTRACT_ACCESS_CONTROL_UPDATE, payload: accessControl })
  }
  function updateTokenName(tokenName: string) {
    dispatch({ type: ContractWizardAction.TOKEN_NAME_UPDATE, payload: tokenName })
  }
  function updateContractName(contractName: string) {
    dispatch({ type: ContractWizardAction.CONTRACT_NAME_UPDATE, payload: contractName })
    dispatch({ type: ContractWizardAction.TOKEN_NAME_UPDATE, payload: contractName })
  }

  useEffect(() => {
    if (strategy.contractType === 'erc20') {
      dispatch({ type: ContractWizardAction.CONTRACT_CODE_UPDATE, payload: getErc20ContractCode(strategy.contractType, strategy) })
    } else if (strategy.contractType === 'erc721') {
      dispatch({ type: ContractWizardAction.CONTRACT_CODE_UPDATE, payload: getErc721ContractCode(strategy.contractType, strategy) })
    } else if (strategy.contractType === 'erc1155') {
      dispatch({ type: ContractWizardAction.CONTRACT_CODE_UPDATE, payload: getErc1155ContractCode(strategy.contractType, strategy) })
    }
  }, [strategy.contractType, strategy.contractOptions, strategy.contractAccessControl, strategy.contractUpgradability, strategy.contractName])

  const formatColor = (name) => {
    let color = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    if (color.length === 4 && color.startsWith('#')) {
      color = color.concat(color.substr(1))
    }
    return color
  }

  const defineAndSetTheme = (monaco) => {
    const themeType = theme?.name.toLowerCase() === 'dark' ? 'vs-dark' : 'vs'
    const themeName = theme?.name.toLowerCase() === 'dark' ? 'remix-dark' : 'remix-light'

    // see https://microsoft.github.io/monaco-editor/playground.html#customizing-the-appearence-exposed-colors
    const lightColor = formatColor('--bs-light')
    const infoColor = formatColor('--bs-info')
    const darkColor = formatColor('--bs-dark')
    const secondaryColor = formatColor('--bs-body-bg')
    const primaryColor = formatColor('--bs-primary')
    const textColor = formatColor('--bs-body-color') || darkColor
    const textbackground = formatColor('--bs-body-bg') || lightColor
    const blueColor = formatColor('--bs-blue')
    const successColor = formatColor('--bs-success')
    const warningColor = formatColor('--bs-warning')
    const yellowColor = formatColor('--bs-yellow')
    const pinkColor = formatColor('--bs-pink')
    const locationColor = '#9e7e08'
    // const purpleColor = formatColor('--purple')
    const dangerColor = formatColor('--bs-danger')
    const greenColor = formatColor('--bs-green')
    const orangeColor = formatColor('--bs-orange')
    const grayColor = formatColor('--bs-gray')

    monaco.editor.defineTheme(themeName, {
      base: themeType,
      inherit: true, // can also be false to completely replace the builtin rules
      rules: [
        { background: darkColor.replace('#', '') },
        { foreground: textColor.replace('#', '') },

        // global variables
        { token: 'keyword.abi', foreground: blueColor },
        { token: 'keyword.block', foreground: blueColor },
        { token: 'keyword.bytes', foreground: blueColor },
        { token: 'keyword.msg', foreground: blueColor },
        { token: 'keyword.tx', foreground: blueColor },

        // global functions
        { token: 'keyword.assert', foreground: blueColor },
        { token: 'keyword.require', foreground: blueColor },
        { token: 'keyword.revert', foreground: blueColor },
        { token: 'keyword.blockhash', foreground: blueColor },
        { token: 'keyword.keccak256', foreground: blueColor },
        { token: 'keyword.sha256', foreground: blueColor },
        { token: 'keyword.ripemd160', foreground: blueColor },
        { token: 'keyword.ecrecover', foreground: blueColor },
        { token: 'keyword.addmod', foreground: blueColor },
        { token: 'keyword.mulmod', foreground: blueColor },
        { token: 'keyword.selfdestruct', foreground: blueColor },
        { token: 'keyword.type ', foreground: blueColor },
        { token: 'keyword.gasleft', foreground: blueColor },
        { token: 'function', foreground: blueColor, fontStyle: 'bold' },

        // specials
        { token: 'keyword.super', foreground: infoColor },
        { token: 'keyword.this', foreground: infoColor },
        { token: 'keyword.virtual', foreground: infoColor },

        // for state variables
        { token: 'keyword.constants', foreground: grayColor },
        { token: 'keyword.override', foreground: grayColor },
        { token: 'keyword.immutable', foreground: grayColor },

        // data location
        { token: 'keyword.memory', foreground: locationColor },
        { token: 'keyword.storage', foreground: locationColor },
        { token: 'keyword.calldata', foreground: locationColor },

        // for Events
        { token: 'keyword.indexed', foreground: yellowColor },
        { token: 'keyword.anonymous', foreground: yellowColor },

        // for functions
        { token: 'keyword.external', foreground: successColor },
        { token: 'keyword.internal', foreground: successColor },
        { token: 'keyword.private', foreground: successColor },
        { token: 'keyword.public', foreground: successColor },
        { token: 'keyword.view', foreground: successColor },
        { token: 'keyword.pure', foreground: successColor },
        { token: 'keyword.payable', foreground: successColor },
        { token: 'keyword.nonpayable', foreground: successColor },

        // Errors
        { token: 'keyword.Error', foreground: dangerColor },
        { token: 'keyword.Panic', foreground: dangerColor },

        // special functions
        { token: 'keyword.fallback', foreground: pinkColor },
        { token: 'keyword.receive', foreground: pinkColor },
        { token: 'keyword.constructor', foreground: pinkColor },

        // identifiers
        { token: 'keyword.identifier', foreground: warningColor },
        { token: 'keyword.for', foreground: warningColor },
        { token: 'keyword.break', foreground: warningColor },
        { token: 'keyword.continue', foreground: warningColor },
        { token: 'keyword.while', foreground: warningColor },
        { token: 'keyword.do', foreground: warningColor },
        { token: 'keyword.delete', foreground: warningColor },

        { token: 'keyword.if', foreground: yellowColor },
        { token: 'keyword.else', foreground: yellowColor },

        { token: 'keyword.throw', foreground: orangeColor },
        { token: 'keyword.catch', foreground: orangeColor },
        { token: 'keyword.try', foreground: orangeColor },

        // returns
        { token: 'keyword.returns', foreground: greenColor },
        { token: 'keyword.return', foreground: greenColor },
      ],
      colors: {
        // see https://code.visualstudio.com/api/references/theme-color for more settings
        'editor.background': lightColor,
        'editorSuggestWidget.background': lightColor,
        'editorSuggestWidget.selectedBackground': secondaryColor,
        'editorSuggestWidget.selectedForeground': textColor,
        'editorSuggestWidget.highlightForeground': primaryColor,
        'editorSuggestWidget.focusHighlightForeground': infoColor,
        'editor.lineHighlightBorder': textbackground,
        'editor.lineHighlightBackground': textbackground === darkColor ? lightColor : secondaryColor,
        'editorGutter.background': lightColor,
        //'editor.selectionHighlightBackground': secondaryColor,
        'minimap.background': lightColor,
        'menu.foreground': textColor,
        'menu.background': textbackground,
        'menu.selectionBackground': secondaryColor,
        'menu.selectionForeground': textColor,
        'menu.selectionBorder': secondaryColor,
      },
    })
    monacoRef.current.editor.setTheme(themeName)
  }

  function remixDarkCodeMirrorTheme(): Extension {
    // Pull the same palette as in defineAndSetTheme
    const lightColor = formatColor('--bs-light')
    const infoColor = formatColor('--bs-info')
    const darkColor = formatColor('--bs-dark')
    const secondaryColor = formatColor('--bs-body-bg')
    const primaryColor = formatColor('--bs-primary')
    const textColor = formatColor('--bs-body-color') || darkColor
    const textbackground = formatColor('--bs-body-bg') || lightColor
    const blueColor = formatColor('--bs-blue')
    const successColor = formatColor('--bs-success')
    const warningColor = formatColor('--bs-warning')
    const yellowColor = formatColor('--bs-yellow')
    const pinkColor = formatColor('--bs-pink')
    const dangerColor = formatColor('--bs-danger')
    const greenColor = formatColor('--bs-green')
    const orangeColor = formatColor('--bs-orange')
    const grayColor = formatColor('--bs-gray')

    // Base editor UI theme (containers, cursors, selections, gutters, tooltips)
    const remixTheme = EditorView.theme(
      {
        '&': {
          color: textColor,
          backgroundColor: lightColor
        },
        '.cm-content': {
          caretColor: primaryColor
        },
        '&.cm-focused .cm-cursor': { borderLeftColor: primaryColor },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
          backgroundColor: secondaryColor
        },
        '.cm-activeLine': {
          backgroundColor: textbackground === darkColor ? lightColor : secondaryColor
        },
        '.cm-gutters': {
          backgroundColor: lightColor,
          color: grayColor,
          borderRight: `1px solid ${secondaryColor}`
        },
        '.cm-tooltip': {
          border: `1px solid ${secondaryColor}`,
          backgroundColor: textbackground,
          color: textColor
        },
        '.cm-tooltip-autocomplete': {
          backgroundColor: lightColor
        },
        '.cm-selectionMatch': {
          backgroundColor: secondaryColor
        },
        '.cm-panels': {
          backgroundColor: lightColor,
          color: textColor
        },
        '.cm-panels-top, .cm-panels-bottom': {
          borderBottom: `1px solid ${secondaryColor}`
        }
      },
      { dark: true }
    )

    // Syntax highlight style mapped to Monaco token intentions
    const remixHighlight = HighlightStyle.define([
      { tag: [t.variableName, t.propertyName, t.attributeName], color: textColor },

      { tag: [t.keyword], color: warningColor },
      { tag: [t.controlKeyword], color: yellowColor },
      { tag: [t.modifier], color: successColor },
      { tag: [t.operatorKeyword], color: orangeColor },

      { tag: [t.typeName, t.typeOperator], color: blueColor },
      { tag: [t.keyword], color: '#9e7e08' },

      { tag: [t.function(t.variableName), t.function(t.propertyName), t.function(t.definition(t.variableName))],
        color: blueColor, fontWeight: 'bold' },
      //@ts-ignore
      { tag: [t.constant, t.keyword], color: grayColor },

      { tag: [t.bool], color: successColor, fontWeight: 'bold' },
      { tag: [t.number], color: primaryColor },
      { tag: [t.string], color: infoColor },
      { tag: [t.regexp], color: pinkColor },

      { tag: [t.invalid, t.annotation], color: dangerColor, fontWeight: 'bold' },

      { tag: [t.comment], color: grayColor, fontStyle: 'italic' },
      { tag: [t.className], color: blueColor },
      { tag: [t.meta], color: yellowColor }
    ])

    return [remixTheme, syntaxHighlighting(remixHighlight)]
  }

  const switching = (value: 'erc20' | 'erc721' | 'erc1155') => {
    dispatch({ type: ContractWizardAction.CONTRACT_TYPE_UPDATED, payload: value })
    dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_NAME, payload: value === 'erc20' ? 'ERC20' : value === 'erc721' ? 'ERC721' : 'ERC1155' })
    dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_TEMPLATE, payload: value === 'erc20' ? { value: 'ozerc20', displayName: 'ERC20', tagList: ["ERC20", "Solidity"], description: 'A customizable fungible token contract' } : value === 'erc721' ? { value: 'ozerc721', displayName: 'ERC721', tagList: ["ERC721", "Solidity"], description: 'A customizable non-fungible token (NFT) contract' } : { value: 'ozerc1155', displayName: 'ERC1155', tagList: ["ERC1155", "Solidity"], description: 'A customizable multi token contract' } })
  }

  return (
    <section className="container-fluid">
      <div className="row g-3">
        <div className="col-12 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            {showEditModal ? <input data-id="contract-wizard-token-name-input" className="form-control form-control-sm" value={state.tokenName} onChange={(e) => updateContractName(e.target.value)} /> : <span data-id="contract-wizard-token-name-span" className={`fw-semibold fs-6 ${theme?.name === 'Light' ? 'text-dark' : 'text-white'}`}>
              {state.tokenName}
            </span>}
            <i data-id="contract-wizard-edit-icon" className={`${showEditModal ? 'fas fa-lock' : "fas fa-edit"}`} onClick={() => setShowEditModal(!showEditModal)}></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <select className="form-select form-select-sm w-auto" defaultValue="Solidity">
              <option>Solidity</option>
            </select>
            <select id="contractWizardContractTagSelect" data-id="contract-wizard-contract-tag-select" className="form-select form-select-sm w-auto" defaultValue="ERC20" onChange={(e) => {
              switching(e.target.value as 'erc20' | 'erc721' | 'erc1155')
            }}>
              <option data-id="contract-wizard-contract-tag-option-erc20" value="erc20">ERC20</option>
              <option data-id="contract-wizard-contract-tag-option-erc721" value="erc721">ERC721</option>
              <option data-id="contract-wizard-contract-tag-option-erc1155" value="erc1155">ERC1155</option>
            </select>
          </div>
        </div>

        <div data-id="contract-wizard-container" className="col-12 col-lg-3">
          <div data-id="contract-wizard-settings-container" className="border rounded p-3 h-100">
            <div className="mb-3">
              <div className="fw-semibold mb-2">Contract settings</div>
              <label data-id="contract-wizard-token-name-label" className="form-label text-uppercase small mb-1">Token name</label>
              <input id="contractWizardTokenNameReadOnlyInput" data-id={`contract-wizard-token-${strategy.tokenName}-input`} className="form-control form-control-sm" placeholder="My Token" value={state.tokenName} readOnly />
            </div>

            <div className="mb-3">
              <div data-id="contract-wizard-features-title" className="text-uppercase small fw-semibold mb-2">Features</div>
              <div className="form-check mb-1">
                <input data-id="contract-wizard-mintable-checkbox" className="form-check-input" type="checkbox" id="featMintable" checked={strategy.contractOptions.mintable} onChange={() => {
                  toggleContractOption('mintable')}
                } />
                <label className="form-check-label" htmlFor="featMintable">Mintable</label>
              </div>
              <div className="form-check mb-1">
                <input data-id="contract-wizard-burnable-checkbox" className="form-check-input" type="checkbox" id="featBurnable" checked={strategy.contractOptions.burnable} onChange={() => toggleContractOption('burnable')} />
                <label className="form-check-label" htmlFor="featBurnable">Burnable</label>
              </div>
              <div className="form-check mb-1">
                <input data-id="contract-wizard-pausable-checkbox" className="form-check-input" type="checkbox" id="featPausable" checked={strategy.contractOptions.pausable} onChange={() => toggleContractOption('pausable')} />
                <label className="form-check-label" htmlFor="featPausable">Pausable</label>
              </div>
            </div>

            <div className="mb-3">
              <div className="text-uppercase small fw-semibold mb-2">Access control</div>
              <div className="form-check mb-1">
                <input data-id="contract-wizard-access-ownable-radio" className="form-check-input" type="radio" name="accessControl" id="accessOwnable" checked={strategy.contractAccessControl==='ownable'} onChange={() => switchAccessControl('ownable')} />
                <label className="form-check-label" htmlFor="accessOwnable">Ownable</label>
              </div>
              <div className="form-check mb-1">
                <input data-id="contract-wizard-access-roles-radio" className="form-check-input" type="radio" name="accessControl" id="accessRoles" checked={strategy.contractAccessControl==='roles'} onChange={() => switchAccessControl('roles')} />
                <label className="form-check-label" htmlFor="accessRoles">Roles</label>
              </div>
              <div className="form-check">
                <input data-id="contract-wizard-access-managed-radio" className="form-check-input" type="radio" name="accessControl" id="accessManaged" checked={strategy.contractAccessControl==='managed'} onChange={() => switchAccessControl('managed')} />
                <label className="form-check-label" htmlFor="accessManaged">Managed</label>
              </div>
            </div>

            <div className="mb-3">
              <div className="text-uppercase small fw-semibold mb-2">Upgradability</div>
              <div className="form-check mb-1">
                <input data-id="contract-wizard-upgradability-uups-checkbox" className="form-check-input" type="checkbox" id="featUups" checked={strategy.contractUpgradability.uups} onChange={() => dispatch({ type: ContractWizardAction.CONTRACT_UPGRADABILITY_UPDATE, payload: { ...strategy.contractUpgradability, uups: !strategy.contractUpgradability.uups } })} />
                <label className="form-check-label" htmlFor="featUups">UUPS</label>
              </div>
              <div className="form-check">
                <input data-id="contract-wizard-upgradability-transparent-checkbox" className="form-check-input" type="checkbox" id="featTransparent" checked={strategy.contractUpgradability.transparent} onChange={() => dispatch({ type: ContractWizardAction.CONTRACT_UPGRADABILITY_UPDATE, payload: { ...strategy.contractUpgradability, transparent: !strategy.contractUpgradability.transparent } })} />
                <label className="form-check-label" htmlFor="featTransparent">Transparent</label>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-9">
          <div className="border rounded p-0 h-100">
            {/* <Editor
              data-id="contract-wizard-editor"
              height="460px"
              defaultLanguage="typescript"
              options={{ readOnly: true, minimap: { enabled: false }, theme: theme.currentTheme().name === 'Light' ? 'vs' : 'vs-dark' }}
              value={strategy.contractCode as string}
            /> */}
            <CodeMirror
              data-id="contract-wizard-editor"
              value={strategy.contractCode as string}
              lang="typescript"
              height="460px"
              theme={theme?.name === 'Light' ? vscodeLight : vscodeDark}
              readOnly={true}
              basicSetup={{
                lineNumbers: false,
                syntaxHighlighting: true,
                foldGutter: false,
                highlightActiveLine: true,
                highlightActiveLineGutter: false,
                indentOnInput: false,
                tabSize: 2
              }}
              extensions={[javascript({ typescript: true })]}
            />
          </div>
          <div className="d-flex justify-content-between align-items-center gap-3 mt-3">
            <div className="form-check m-0">
              <>
                <input data-id="contract-wizard-initialize-as-git-repo-checkbox" className="form-check-input" type="checkbox" id="initGit" checked={state.initializeAsGitRepo}
                  onChange={(e) => dispatch({ type: ContractWizardAction.INITIALIZE_AS_GIT_REPO_UPDATE, payload: e.target.checked })} />
                <label className="form-check-label" htmlFor="initGit">Initialize as a Git repository</label>
              </>
            </div>

            <button data-id="contract-wizard-validate-workspace-button" className="btn btn-primary btn-sm" onClick={async () => {
              const result = await createNonClashingTitle(state.workspaceName, plugin.fileManager)
              dispatch({ type: TemplateExplorerWizardAction.SET_WORKSPACE_NAME, payload: result })
              console.log('state is now ?', state)
              // return
              await facade.createWorkspace({
                workspaceName: state.workspaceName,
                workspaceTemplateName: state.workspaceTemplateChosen.value,
                opts: state.contractOptions,
                isEmpty: false,
                isGitRepo: state.initializeAsGitRepo,
                createCommit: true,
                contractContent: state.contractCode,
                contractName: state.tokenName
              })
              facade.closeWizard()
            }}>Validate workspace</button>
          </div>
        </div>
      </div>
    </section>
  )
}
