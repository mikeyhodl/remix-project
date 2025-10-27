import React,{ useContext, useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import * as erc20 from '../contractCode/erc20'
import { AccessControlType, ContractTypeStrategy, ContractWizardAction, TemplateExplorerWizardAction } from '../../types/template-explorer-types'
import { getErc1155ContractCode, getErc20ContractCode, getErc721ContractCode } from '../utils/contractWizardUtils'
import { TemplateExplorerContext } from '../../context/template-explorer-context'

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
  const { state, dispatch, theme, facade } = useContext(TemplateExplorerContext)
  const strategy = state

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
            {showEditModal ? <input className="form-control form-control-sm" value={state.tokenName} onChange={(e) => updateContractName(e.target.value)} /> : <span className={`fw-semibold fs-6 ${theme.currentTheme().name === 'Light' ? 'text-dark' : 'text-white'}`}>
              {state.tokenName}
            </span>}
            <i className={`${showEditModal ? 'fas fa-lock' : "fas fa-edit"}`} onClick={() => setShowEditModal(!showEditModal)}></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <select className="form-select form-select-sm w-auto" defaultValue="Solidity">
              <option>Solidity</option>
            </select>
            <select className="form-select form-select-sm w-auto" value={strategy.contractTag} onChange={(e) => {
              switching(e.target.value as 'erc20' | 'erc721' | 'erc1155')
            }}>
              <option value="erc20">ERC20</option>
              <option value="erc721">ERC721</option>
              <option value="erc1155">ERC1155</option>
            </select>
          </div>
        </div>

        <div className="col-12 col-lg-3">
          <div className="border rounded p-3 h-100">
            <div className="mb-3">
              <div className="fw-semibold mb-2">Contract settings</div>
              <label className="form-label text-uppercase small mb-1">Token name</label>
              <input className="form-control form-control-sm" placeholder="My Token" value={state.tokenName} readOnly />
            </div>

            <div className="mb-3">
              <div className="text-uppercase small fw-semibold mb-2">Features</div>
              <div className="form-check mb-1">
                <input className="form-check-input" type="checkbox" id="featMintable" checked={strategy.contractOptions.mintable} onChange={() => {
                  toggleContractOption('mintable')}
                } />
                <label className="form-check-label" htmlFor="featMintable">Mintable</label>
              </div>
              <div className="form-check mb-1">
                <input className="form-check-input" type="checkbox" id="featBurnable" checked={strategy.contractOptions.burnable} onChange={() => toggleContractOption('burnable')} />
                <label className="form-check-label" htmlFor="featBurnable">Burnable</label>
              </div>
              <div className="form-check mb-1">
                <input className="form-check-input" type="checkbox" id="featPausable" checked={strategy.contractOptions.pausable} onChange={() => toggleContractOption('pausable')} />
                <label className="form-check-label" htmlFor="featPausable">Pausable</label>
              </div>
            </div>

            <div className="mb-3">
              <div className="text-uppercase small fw-semibold mb-2">Access control</div>
              <div className="form-check mb-1">
                <input className="form-check-input" type="radio" name="accessControl" id="accessOwnable" checked={strategy.contractAccessControl==='ownable'} onChange={() => switchAccessControl('ownable')} />
                <label className="form-check-label" htmlFor="accessOwnable">Ownable</label>
              </div>
              <div className="form-check mb-1">
                <input className="form-check-input" type="radio" name="accessControl" id="accessRoles" checked={strategy.contractAccessControl==='roles'} onChange={() => switchAccessControl('roles')} />
                <label className="form-check-label" htmlFor="accessRoles">Roles</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="radio" name="accessControl" id="accessManaged" checked={strategy.contractAccessControl==='managed'} onChange={() => switchAccessControl('managed')} />
                <label className="form-check-label" htmlFor="accessManaged">Managed</label>
              </div>
            </div>

            <div className="mb-3">
              <div className="text-uppercase small fw-semibold mb-2">Upgradability</div>
              <div className="form-check mb-1">
                <input className="form-check-input" type="checkbox" id="featUups" checked={strategy.contractUpgradability.uups} onChange={() => dispatch({ type: ContractWizardAction.CONTRACT_UPGRADABILITY_UPDATE, payload: { ...strategy.contractUpgradability, uups: !strategy.contractUpgradability.uups } })} />
                <label className="form-check-label" htmlFor="featUups">UUPS</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="featTransparent" checked={strategy.contractUpgradability.transparent} onChange={() => dispatch({ type: ContractWizardAction.CONTRACT_UPGRADABILITY_UPDATE, payload: { ...strategy.contractUpgradability, transparent: !strategy.contractUpgradability.transparent } })} />
                <label className="form-check-label" htmlFor="featTransparent">Transparent</label>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-9">
          <div className="border rounded p-0 h-100">
            <Editor
              height="460px"
              defaultLanguage="typescript"
              options={{ readOnly: true, minimap: { enabled: false }, theme: theme.currentTheme().name === 'Light' ? 'vs' : 'vs-dark' }}
              value={strategy.contractCode as string}
            />
          </div>
          <div className="d-flex justify-content-between align-items-center gap-3 mt-3">
            <div className="form-check m-0">
              <>
                <input className="form-check-input" type="checkbox" id="initGit" checked={state.initializeAsGitRepo}
                  onChange={(e) => dispatch({ type: ContractWizardAction.INITIALIZE_AS_GIT_REPO_UPDATE, payload: e.target.checked })} />
                <label className="form-check-label" htmlFor="initGit">Initialize as a Git repository</label>
              </>
            </div>

            <button className="btn btn-primary btn-sm" data-id="validateWorkspaceButton" onClick={async () => {
              dispatch({ type: TemplateExplorerWizardAction.END_WORKSPACE_WIZARD })
            }}>Validate workspace</button>
          </div>
        </div>
      </div>
    </section>
  )
}
