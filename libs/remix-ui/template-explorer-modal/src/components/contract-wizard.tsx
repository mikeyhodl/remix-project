import React,{ useEffect, useMemo, useReducer, useState } from 'react'
import Editor from '@monaco-editor/react'
import * as erc20 from '../contractCode/erc20'
import * as erc721 from '../contractCode/erc721'
import * as erc1155 from '../contractCode/erc1155'
import { AccessControlType, ContractTypeStrategy, ContractWizardAction } from '../../types/template-explorer-types'
import { contractWizardReducer } from '../../reducers/contract-wizard-reducer'
import { getErc1155ContractCode, getErc20ContractCode, getErc721ContractCode } from '../utils/contractWizardUtils'

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
  const [tokenName, setTokenName] = useState('MyToken')

  const [accessControl, setAccessControl] = useState<'ownable' | 'roles' | 'managed' | ''>('')
  const [upgradability, setUpgradability] = useState({
    uups: false,
    transparent: false
  })
  const [initGit, setInitGit] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [strategy, dispatch] = useReducer(contractWizardReducer, defaultStrategy)

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
    console.log('switchAccessControl', accessControl)
    dispatch({ type: ContractWizardAction.CONTRACT_ACCESS_CONTROL_UPDATE, payload: accessControl })
  }
  function updateTokenName(tokenName: string) {
    dispatch({ type: ContractWizardAction.TOKEN_NAME_UPDATE, payload: tokenName })
  }
  function updateContractName(contractName: string) {
    dispatch({ type: ContractWizardAction.CONTRACT_NAME_UPDATE, payload: contractName })
  }

  useEffect(() => {
    // console.log('strategy', strategy)
    if (strategy.contractType === 'erc20') {
      dispatch({ type: ContractWizardAction.CONTRACT_CODE_UPDATE, payload: getErc20ContractCode(strategy.contractType, strategy) })
    } else if (strategy.contractType === 'erc721') {
      dispatch({ type: ContractWizardAction.CONTRACT_CODE_UPDATE, payload: getErc721ContractCode(strategy.contractType, strategy) })
    } else if (strategy.contractType === 'erc1155') {
      dispatch({ type: ContractWizardAction.CONTRACT_CODE_UPDATE, payload: getErc1155ContractCode(strategy.contractType, strategy) })
    }
  }, [strategy.contractType, strategy.contractOptions, strategy.contractAccessControl, strategy.contractUpgradability, strategy.contractName])

  return (
    <section className="container-fluid">
      <div className="row g-3">
        <div className="col-12 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            {showEditModal ? <input className="form-control form-control-sm" value={tokenName} onChange={(e) => setTokenName(e.target.value)} /> : <span className="fw-semibold">{tokenName}</span>}
            <i className="fas fa-edit" onClick={() => setShowEditModal(true)}></i>
          </div>
          <div className="d-flex align-items-center gap-2">
            <select className="form-select form-select-sm w-auto" defaultValue="Solidity">
              <option>Solidity</option>
            </select>
            <select className="form-select form-select-sm w-auto" defaultValue="ERC20" onChange={(e) => {
              dispatch({ type: ContractWizardAction.CONTRACT_TYPE_UPDATED, payload: e.target.value as 'erc20' | 'erc721' | 'erc1155' | 'custom' })
            }}>
              <option value="erc20">ERC20</option>
              <option value="erc721">ERC721</option>
              <option value="erc1155">ERC1155</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>

        <div className="col-12 col-lg-3">
          <div className="border rounded p-3 h-100">
            <div className="mb-3">
              <div className="fw-semibold mb-2">Contract settings</div>
              <label className="form-label text-uppercase small mb-1">Token name</label>
              <input className="form-control form-control-sm" placeholder="My Token" value={tokenName} onChange={(e) => updateTokenName(e.target.value)} />
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
              options={{ readOnly: true, minimap: { enabled: false } }}
              value={strategy.contractCode as string}
            />
          </div>
          <div className="d-flex justify-content-between align-items-center gap-3 mt-3">
            <div className="form-check m-0">
              <input className="form-check-input" type="checkbox" id="initGit" checked={initGit} onChange={(e) => setInitGit(e.target.checked)} />
              <label className="form-check-label" htmlFor="initGit">Initialize as a Git repository</label>
            </div>
            <button className="btn btn-primary btn-sm">Validate workspace</button>
          </div>
        </div>
      </div>
    </section>
  )
}
