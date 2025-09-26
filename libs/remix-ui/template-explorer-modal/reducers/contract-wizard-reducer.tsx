import { ContractTypeStrategy } from '../types/template-explorer-types'
import * as erc20 from '../src/contractCode/erc20'
import { ContractWizardAction } from '../types/template-explorer-types'
import { getErc20ContractCode, getErc721ContractCode, getErc1155ContractCode } from '../src/utils/contractWizardUtils'

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
  initializeAsGitRepo: false,
  tokenName: 'MyToken'
}

export function contractWizardReducer(state: ContractTypeStrategy, action: {type: ContractWizardAction, payload: any}) {
  switch (action.type) {
  case ContractWizardAction.CONTRACT_TYPE_UPDATED: {
    return { ...state, contractType: action.payload }
  }
  case ContractWizardAction.CONTRACT_UPGRADABILITY_UPDATE: {
    return { ...state, contractUpgradability: action.payload }
  }
  case ContractWizardAction.CONTRACT_ACCESS_CONTROL_UPDATE: {
    return { ...state, contractAccessControl: action.payload }
  }
  case ContractWizardAction.CONTRACT_OPTIONS_UPDATE: {
    return { ...state, contractOptions: action.payload }
  }
  case ContractWizardAction.CONTRACT_CODE_UPDATE: {
    return { ...state, contractCode: action.payload }
  }
  case ContractWizardAction.CONTRACT_IMPORT_UPDATE: {
    return { ...state, contractImport: action.payload }
  }
  case ContractWizardAction.INITIALIZE_AS_GIT_REPO_UPDATE: {
    return { ...state, initializeAsGitRepo: action.payload }
  }
  case ContractWizardAction.TOKEN_NAME_UPDATE: {
    return { ...state, tokenName: action.payload }
  }
  case ContractWizardAction.CONTRACT_NAME_UPDATE: {
    return { ...state, contractName: action.payload }
  }
  default: {
    return { ...state, contractCode: getErc20ContractCode('erc20', state) }
  }
  }
}
