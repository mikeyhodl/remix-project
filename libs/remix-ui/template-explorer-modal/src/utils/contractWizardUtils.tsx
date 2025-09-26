import * as erc20 from '../contractCode/erc20'
import * as erc721 from '../contractCode/erc721'
import * as erc1155 from '../contractCode/erc1155'
import { ContractTypeStrategy } from '../../types/template-explorer-types'

export function getErc20ContractCode (contractType: 'erc20', state: ContractTypeStrategy) {

  if (state.contractType === contractType) {
    console.log('state.contractType and contracType are the same')
    if (state.contractOptions.mintable && state.contractOptions.burnable && state.contractOptions.pausable) {
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20UUPSOwnableMintableBurnablePausableOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20TransparentMintableBurnablePausableManagedOptions(state.contractName || 'MyToken')
        }
        return erc20.erc20MintablePausableBurnableOwnableOptions(state.contractName || 'MyToken')
      } else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20UUPSRolesFullOptions(state.contractName || 'MyToken')
        }
        return erc20.erc20MintablePausableBurnableRolesOptions(state.contractName || 'MyToken')
      } else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20TransparentMintableBurnablePausableManagedOptions(state.contractName || 'MyToken')
        }
        return erc20.erc20MintablePausableBurnableManagedOptions(state.contractName || 'MyToken')
      }
    } else if (state.contractOptions.mintable && state.contractOptions.burnable) {
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20UUPSOwnableMintableBurnableOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20TransparentMintableBurnableManagedOptions(state.contractName || 'MyToken')
        }
        return erc20.erc20BurnableMintableOwnableOptions(state.contractName || 'MyToken')
      } else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20UUPSRolesFullOptions(state.contractName || 'MyToken')
        }
      } else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20TransparentMintableBurnableManagedOptions(state.contractName || 'MyToken')
        }
      }
      return erc20.erc20BurnableMintableOwnableOptions(state.contractName || 'MyToken')
    }
    if (state.contractOptions.mintable && state.contractOptions.pausable) {
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20PausableBurnableMintableOwnableOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20TransparentMintableBurnablePausableManagedOptions(state.contractName || 'MyToken')
        }
        return erc20.erc20MintablePausableOwnableOptions(state.contractName || 'MyToken')
      }
    }
    if (state.contractOptions.burnable && state.contractOptions.pausable) {
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20PausableBurnableMintableOwnableOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20TransparentMintableBurnablePausableManagedOptions(state.contractName || 'MyToken')
        }
      } else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20UUPSRolesFullOptions(state.contractName || 'MyToken')
        }
        return erc20.erc20MintableBurnablePausableRolesOptions(state.contractName || 'MyToken')
      }
      else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20TransparentMintableBurnablePausableManagedOptions(state.contractName || 'MyToken')
        }
        return erc20.erc20MintableBurnablePausableManagedOptions(state.contractName || 'MyToken')
      }
      return erc20.erc20MintableBurnablePausableRolesOptions(state.contractName || 'MyToken')
    } else if (state.contractOptions.mintable) {
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20UUPSOwnableMintableOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20TransparentMintableManagedOptions(state.contractName || 'MyToken')
        }
        return erc20.erc20MintableOwnableOptions(state.contractName || 'MyToken')
      } else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20UUPSRolesFullOptions(state.contractName || 'MyToken')
        }
      } else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20TransparentMintableManagedOptions(state.contractName || 'MyToken')
        }
      }
      return erc20.erc20MintableOwnableOptions(state.contractName || 'MyToken')
    }
    else if (state.contractOptions.burnable) {
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20UUPSOwnableBurnableOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20OwnableBurnableOptions(state.contractName || 'MyToken')
        }
      }
      return erc20.erc20BurnableOwnableOptions(state.contractName || 'MyToken')
    }
    else if (state.contractOptions.pausable) {
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20UUPSOwnablePausableOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20TransparentPausableOptions(state.contractName || 'MyToken')
        }
      } else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20UUPSRolesFullOptions(state.contractName || 'MyToken')
        }
        return erc20.erc20UUPSOwnablePausableOptions(state.contractName || 'MyToken')
      } else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc20.erc20UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc20.erc20TransparentPausableOptions(state.contractName || 'MyToken')
        }
      }
      return erc20.erc20UUPSOwnablePausableOptions(state.contractName || 'MyToken')
    }
    return erc20.erc20DefaultNoOptions(state.contractName || 'MyToken')
  }
}

export function getErc721ContractCode (contractType: 'erc721', state: ContractTypeStrategy) {

  if (state.contractType === contractType) {
    console.log('state.contractType and contracType are the same')
    if (state.contractOptions.mintable && state.contractOptions.burnable && state.contractOptions.pausable) {
      console.log('state.contractOptions.mintable and state.contractOptions.burnable and state.contractOptions.pausable are true')
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          if (state.contractOptions.mintable && state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc721.erc721PausableBurnableMintableOwnableOptions(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.burnable) {
            return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.pausable) {
            return erc721.erc721PausableMintableRoleOptions(state.contractName || 'MyToken')
          } else if (state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc721.erc721PausableBurnableRoleOptions(state.contractName || 'MyToken')
          }
        } else if (state.contractUpgradability.transparent) {
          if (state.contractOptions.mintable && state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.burnable) {
            return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.pausable) {
            return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
          } else if (state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
          }
          return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
        }
      }
      else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          if (state.contractOptions.mintable && state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc721.erc721UUPSRolesFullOptions(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.burnable) {
            return erc721.erc721FullOptionsRoles(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.pausable) {
            return erc721.erc721PausableMintableRoleOptions(state.contractName || 'MyToken')
          } else if (state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc721.erc721PausableBurnableRoleOptions(state.contractName || 'MyToken')
          }
          return erc721.erc721FullOptionsRolesTransparent(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          if (state.contractOptions.mintable && state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc721.erc721FullOptionsRolesTransparent(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.burnable) {
            return erc721.erc721FullOptionsRoles(state.contractName || 'MyToken')
          }
          return erc721.erc721FullOptionsRolesTransparent(state.contractName || 'MyToken')
        }
      } else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          if (state.contractOptions.mintable && state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc721.erc721UUPSManagedFullOptions(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.burnable) {
            return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.pausable) {
            return erc721.erc721PausableMintableRoleOptions(state.contractName || 'MyToken')
          } else if (state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc721.erc721PausableBurnableRoleOptions(state.contractName || 'MyToken')
          }
          return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          if (state.contractOptions.mintable && state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.burnable) {
            return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.pausable) {
            return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
          } else if (state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
          }
          return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
        }
        return erc721.erc721ManagedMintableBurnablePausableOptions(state.contractName || 'MyToken')
      }
      return erc721.erc721DefaultNoOptions(state.contractName || 'MyToken')
    } else if (state.contractOptions.mintable && state.contractOptions.burnable) {
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSOwnableFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
        }
      }
      else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsRolesTransparent(state.contractName || 'MyToken')
        }
      }
      else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
        }
      }
    } else if (state.contractOptions.mintable && state.contractOptions.pausable) { //Mintable and Pausable
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSMintablePausableOwnableOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
        }
        return erc721.erc721UUPSMintablePausableOwnableOptions(state.contractName || 'MyToken')
      }
      else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsRolesTransparent(state.contractName || 'MyToken')
        }
        return erc721.erc721UUPSMintablePausableRolesOptions(state.contractName || 'MyToken')
      }
      else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
        }
      }
      return erc721.erc721UUPSMintablePausableManagedOptions(state.contractName || 'MyToken')
    } else if (state.contractOptions.burnable && state.contractOptions.pausable) { // Burnable and Pausable
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSOwnableFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
        }
        return erc721.erc721UUPSBurnablePausableOwnableOptions(state.contractName || 'MyToken')
      }
      else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsRolesTransparent(state.contractName || 'MyToken')
        }
        return erc721.erc721UUPSRolesBurnablePausableOptions(state.contractName || 'MyToken')
      }
      else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
        }
        return erc721.erc721UUPSBurnablePausableManagedOptions(state.contractName || 'MyToken')
      }
    } else if (state.contractOptions.mintable) { // Mintable
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSOwnableFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
        }
        return erc721.erc721MintableOwnableOptions(state.contractName || 'MyToken')
      }

      else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsRolesTransparent(state.contractName || 'MyToken')
        }
        return erc721.erc721MintableRolesOptions(state.contractName || 'MyToken')
      }
      else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
        }
        return erc721.erc721MintableManagedOptions(state.contractName || 'MyToken')
      }
    } else if (state.contractOptions.burnable) { // Burnable
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSOwnableFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
        }
      } else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsRolesTransparent(state.contractName || 'MyToken')
        }
      }
      else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
        }
      }
    } else if (state.contractOptions.pausable) {
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSOwnableFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
        }
      }
      else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsRolesTransparent(state.contractName || 'MyToken')
        }
      }
      else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc721.erc721UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc721.erc721FullOptionsManagedTransparent(state.contractName || 'MyToken')
        }
      }
    } else {
      return erc721.erc721DefaultNoOptions(state.contractName || 'MyToken')
    }

    return erc721.erc721DefaultNoOptions(state.contractName || 'MyToken')
  }
}

export function getErc1155ContractCode (contractType: 'erc1155', state: ContractTypeStrategy) {

  if (state.contractType === contractType) {
    console.log('state.contractType and contracType are the same')
    if (state.contractOptions.mintable && state.contractOptions.burnable && state.contractOptions.pausable) {
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          if (state.contractOptions.mintable && state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc1155.erc1155UUPSOwnableMintableBurnablePausableOptions(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.burnable) {
            return erc1155.erc1155MintableBurnablePausableOptions(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.pausable) {
            return erc1155.erc1155PausableOwnableOptions(state.contractName || 'MyToken')
          } else if (state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc1155.erc1155PausableBurnableOwnableOptions(state.contractName || 'MyToken')
          }
          return erc1155.erc1155UUPSOwnableMintableBurnablePausableOptions(state.contractName || 'MyToken')
        }
        return erc1155.erc1155BurnableOwnableOptions(state.contractName || 'MyToken')
      } else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          if (state.contractOptions.mintable && state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc1155.erc1155UUPSRolesFullOptions(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.burnable) {
            return erc1155.erc1155MintableBurnableRolesOptions(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.pausable) {
            return erc1155.erc1155MintableBurnableRolesOptions(state.contractName || 'MyToken')
          } else if (state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc1155.erc1155MintableBurnableRolesOptions(state.contractName || 'MyToken')
          }
          return erc1155.erc1155MintablePausableBurnableRolesOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          if (state.contractOptions.mintable && state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.burnable) {
            return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
          }
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
      } else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          if (state.contractOptions.mintable && state.contractOptions.burnable && state.contractOptions.pausable) {
            return erc1155.erc1155UUPSManagedFullOptions(state.contractName || 'MyToken')
          } else if (state.contractOptions.mintable && state.contractOptions.burnable) {
            return erc1155.erc1155MintablePausableBurnableManagedOptions(state.contractName || 'MyToken')
          }
        }
      }
    } else if (state.contractOptions.mintable && state.contractOptions.burnable) {
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc1155.erc1155UUPSOwnableFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
      }
      else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc1155.erc1155UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
      }
      else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc1155.erc1155UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
      }
    } else if (state.contractOptions.mintable && state.contractOptions.pausable) { // Mintable and Pausable
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc1155.erc1155UUPSOwnableFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
      }
      else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc1155.erc1155UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
      }
      else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc1155.erc1155UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
      }
    } else if (state.contractOptions.mintable) {
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc1155.erc1155UUPSOwnableFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
      }
      else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc1155.erc1155UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
      }
      else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc1155.erc1155UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
      }
    } else if (state.contractOptions.burnable) {
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc1155.erc1155UUPSOwnableFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
      }
      else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc1155.erc1155UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
      }
      else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc1155.erc1155UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
      }
      return erc1155.erc1155BurnableOptions(state.contractName || 'MyToken')
    } else if (state.contractOptions.pausable) {
      if (state.contractAccessControl === 'ownable') {
        if (state.contractUpgradability.uups) {
          return erc1155.erc1155UUPSOwnableFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
      } else if (state.contractAccessControl === 'roles') {
        if (state.contractUpgradability.uups) {
          return erc1155.erc1155UUPSRolesFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
        return erc1155.erc1155PausableRolesOptions(state.contractName || 'MyToken')
      }
      else if (state.contractAccessControl === 'managed') {
        if (state.contractUpgradability.uups) {
          return erc1155.erc1155UUPSManagedFullOptions(state.contractName || 'MyToken')
        } else if (state.contractUpgradability.transparent) {
          return erc1155.erc1155TransparentOwnableFullOptions(state.contractName || 'MyToken')
        }
        return erc1155.erc1155PausableManagedOptions(state.contractName || 'MyToken')
      }
      return erc1155.erc1155PausableOwnableOptions(state.contractName || 'MyToken')
    }
    return erc1155.erc1155DefaultOptions(state.contractName || 'MyToken')
  }
}
