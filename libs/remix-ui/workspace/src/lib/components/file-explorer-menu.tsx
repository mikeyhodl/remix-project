import { CustomTooltip } from '@remix-ui/helper'
import React, {useState, useEffect, useContext, useRef, useReducer} from 'react' //eslint-disable-line
import { FormattedMessage } from 'react-intl'
import { Placement } from 'react-bootstrap/esm/types'
import { FileExplorerMenuProps } from '../types'
import { FileSystemContext } from '../contexts'
import { appActionTypes, AppContext, appPlatformTypes, platformContext } from '@remix-ui/app'
import { TrackingContext } from '@remix-ide/tracking'
import { MatomoEvent, FileExplorerEvent } from '@remix-api'
import { Button, Dropdown } from 'react-bootstrap'

export const FileExplorerMenu = (props: FileExplorerMenuProps) => {
  const global = useContext(FileSystemContext)
  const platform = useContext(platformContext)
  const appContext = useContext(AppContext)
  const { trackMatomoEvent: baseTrackEvent } = useContext(TrackingContext)
  const trackMatomoEvent = <T extends MatomoEvent = FileExplorerEvent>(event: T) => {
    baseTrackEvent?.<T>(event)
  }
  const [showDropdown, setShowDropdown] = useState(false)
  // const [state, setState] = useState({
  //   menuItems: [
  //     {
  //       action: 'newBlankFile',
  //       title: 'New blank file',
  //       icon: 'far fa-plus',
  //       placement: 'top',
  //       platforms:[appPlatformTypes.web, appPlatformTypes.desktop]
  //     },
  //     {
  //       action: 'createNewFile',
  //       title: 'Create new file',
  //       icon: 'far fa-file',
  //       placement: 'top',
  //       platforms:[appPlatformTypes.web, appPlatformTypes.desktop]
  //     },
  //     {
  //       action: 'createNewFolder',
  //       title: 'Create new folder',
  //       icon: 'far fa-folder',
  //       placement: 'top',
  //       platforms:[appPlatformTypes.web, appPlatformTypes.desktop]
  //     },
  //     {
  //       action: 'uploadFile',
  //       title: 'Upload files into current Workspace',
  //       icon: 'far fa-upload',
  //       placement: 'top',
  //       platforms:[appPlatformTypes.web]
  //     },
  //     {
  //       action: 'uploadFolder',
  //       title: 'Upload folder into current Workspace',
  //       icon: 'far fa-folder-upload',
  //       placement: 'top',
  //       platforms:[appPlatformTypes.web]
  //     },
  //     {
  //       action: 'importFromIpfs',
  //       title: 'Import files from ipfs',
  //       icon: 'fa-regular fa-cube',
  //       placement: 'top',
  //       platforms: [appPlatformTypes.web, appPlatformTypes.desktop]
  //     },
  //     {
  //       action: 'importFromHttps',
  //       title: 'Import files with https',
  //       icon: 'fa-solid fa-link',
  //       placement: 'top',
  //       platforms: [appPlatformTypes.web, appPlatformTypes.desktop]
  //     },
  //     {
  //       action: 'initializeWorkspaceAsGitRepo',
  //       title: 'Initialize Workspace as a git repository',
  //       icon: 'fa-brands fa-git-alt',
  //       placement: 'top',
  //       platforms: [appPlatformTypes.web, appPlatformTypes.desktop]
  //     },
  //     {
  //       action: 'revealInExplorer',
  //       title: 'Reveal Workspace in explorer',
  //       icon: 'fas fa-eye',
  //       placement: 'top',
  //       platforms: [appPlatformTypes.desktop]
  //     }
  //   ].filter(
  //     (item) =>
  //       props.menuItems &&
  //       props.menuItems.find((name) => {
  //         return name === item.action
  //       })
  //   ),
  //   actions: {}
  // })
  const menuItems = [
    {
      action: 'newBlankFile',
      title: 'New blank file',
      icon: 'far fa-plus',
      placement: 'top',
      platforms:[appPlatformTypes.web, appPlatformTypes.desktop]
    },
    {
      action: 'createNewFile',
      title: 'Create new file',
      icon: 'far fa-file',
      placement: 'top',
      platforms:[appPlatformTypes.web, appPlatformTypes.desktop]
    },
    {
      action: 'createNewFolder',
      title: 'Create new folder',
      icon: 'far fa-folder',
      placement: 'top',
      platforms:[appPlatformTypes.web, appPlatformTypes.desktop]
    },
    {
      action: 'uploadFile',
      title: 'Upload files into current Workspace',
      icon: 'far fa-upload',
      placement: 'top',
      platforms:[appPlatformTypes.web]
    },
    {
      action: 'uploadFolder',
      title: 'Upload folder into current Workspace',
      icon: 'far fa-folder-upload',
      placement: 'top',
      platforms:[appPlatformTypes.web]
    },
    {
      action: 'importFromIpfs',
      title: 'Import files from ipfs',
      icon: 'fa-regular fa-cube',
      placement: 'top',
      platforms: [appPlatformTypes.web, appPlatformTypes.desktop]
    },
    {
      action: 'localFileSystem',
      title: 'Import files from local file system',
      icon: 'fa-solid fa-upload',
      placement: 'top',
      platforms: [appPlatformTypes.web, appPlatformTypes.desktop]
    },
    {
      action: 'importFromHttps',
      title: 'Import files with https',
      icon: 'fa-solid fa-link',
      placement: 'top',
      platforms: [appPlatformTypes.web, appPlatformTypes.desktop]
    },
    {
      action: 'initializeWorkspaceAsGitRepo',
      title: 'Initialize Workspace as a git repository',
      icon: 'fa-brands fa-git-alt',
      placement: 'top',
      platforms: [appPlatformTypes.web, appPlatformTypes.desktop]
    },
    {
      action: 'revealInExplorer',
      title: 'Reveal Workspace in explorer',
      icon: 'fas fa-eye',
      placement: 'top',
      platforms: [appPlatformTypes.desktop]
    }
  ]

  const itemAction = async (action: string, e?: React.ChangeEvent<HTMLInputElement>) => {

    if (action === 'importFromIpfs' || action === 'importFromHttps') {
    } else if (action === 'createNewFile') {
      await global.plugin.call('templateexplorermodal', 'updateTemplateExplorerInFileMode', true)
      appContext.appStateDispatch({
        type: appActionTypes.showGenericModal,
        payload: true
      })
    } else if (action === 'createNewFolder') {
      props.createNewFolder()
    } else if (action === 'localFileSystem') {
      e.target.click()
    }
  }

  const enableDirUpload = { directory: '', webkitdirectory: '' }

  return (
    (!global.fs.browser.isSuccessfulWorkspace ? null :
      <>

        <span data-id="spanContaining" className="ps-0 pb-1 w-50">
          <Dropdown>
            <Dropdown.Toggle
              as={Button}
              className="w-100 mb-1 d-flex flex-row align-items-center justify-content-center border"
              data-id="fileExplorerCreateButton"
              style={{
                backgroundColor: '#333446',
                color: '#fff'
              }}
            >
              <div className="w-50"></div>
              <div
                className="d-flex flex-row align-items-center justify-items-start me-5 w-50"
              >
                <i className="far fa-plus text-white me-2"></i>
                <span className="text-white fw-semibold">Create</span>
              </div>
            </Dropdown.Toggle>
            <Dropdown.Menu className="w-100 custom-dropdown-items bg-light">
              {menuItems.filter((item) => item.action !== 'uploadFile' && item.action !== 'uploadFolder' && item.action !== 'initializeWorkspaceAsGitRepo' && item.action !== 'revealInExplorer').map(({ action, title, icon, placement, platforms }, index) => {
                return (
                  <Dropdown.Item
                    key={index}
                    onClick={() => {
                      itemAction(action)
                    }}
                  >
                    <a href={`#${action}`} className="text-decoration-none">
                      <i className={icon}></i>
                      <span className="ps-2">{title}</span>
                    </a>
                  </Dropdown.Item>
                )
              })}
            </Dropdown.Menu>
          </Dropdown>
          {/* {1 - 1 === 2 ?state.menuItems.map(({ action, title, icon, placement, platforms }, index) => {
            if (platforms && !platforms.includes(platform)) return null
            if (action === 'uploadFile') {
              return (
                <CustomTooltip
                  placement={placement as Placement}
                  tooltipId="uploadFileTooltip"
                  tooltipClasses="text-nowrap"
                  tooltipText={<FormattedMessage id={`filePanel.${action}`} defaultMessage={title} />}
                  key={`index-${action}-${placement}-${icon}`}
                >
                  <label
                    id={action}
                    style={{ fontSize: '1.1rem', cursor: 'pointer' }}
                    data-id={'fileExplorerUploadFile' + action}
                    className={icon + ' mx-1 remixui_menuItem'}
                    key={`index-${action}-${placement}-${icon}`}
                  >
                    <input
                      id="fileUpload"
                      data-id="fileExplorerFileUpload"
                      type="file"
                      onChange={(e) => {
                        e.stopPropagation()
                        trackMatomoEvent({ category: 'fileExplorer', action: 'fileAction', name: action, isClick: true })
                        props.uploadFile(e.target)
                        e.target.value = null
                      }}
                      multiple
                    />
                  </label>
                </CustomTooltip>
              )
            } else if (action === 'uploadFolder') {
              return (
                <CustomTooltip
                  placement={placement as Placement}
                  tooltipId="uploadFolderTooltip"
                  tooltipClasses="text-nowrap"
                  tooltipText={<FormattedMessage id={`filePanel.${action}`} defaultMessage={title} />}
                  key={`index-${action}-${placement}-${icon}`}
                >
                  <label
                    id={action}
                    style={{ fontSize: '1.1rem', cursor: 'pointer' }}
                    data-id={'fileExplorerUploadFolder' + action}
                    className={icon + ' mx-1 remixui_menuItem'}
                    key={`index-${action}-${placement}-${icon}`}
                  >
                    <input
                      id="folderUpload"
                      data-id="fileExplorerFolderUpload"
                      type="file"
                      onChange={(e) => {
                        e.stopPropagation()
                        trackMatomoEvent({ category: 'fileExplorer', action: 'fileAction', name: action, isClick: true })
                        props.uploadFolder(e.target)
                        e.target.value = null
                      }}
                      {...enableDirUpload}
                      multiple
                    />
                  </label>
                </CustomTooltip>
              )
            } else if (action === 'initializeWorkspaceAsGitRepo') {
              return (
                <CustomTooltip
                  placement={placement as Placement}
                  tooltipId="initializeWorkspaceAsGitRepoTooltip"
                  tooltipClasses="text-nowrap"
                  tooltipText={<FormattedMessage id={`filePanel.${action}`} defaultMessage={title} />}
                  key={`index-${action}-${placement}-${icon}`}
                >
                  <label
                    id={action}
                    style={{ fontSize: '1.1rem', cursor: 'pointer' }}
                    data-id={'fileExplorerInitializeWorkspaceAsGitRepo' + action}
                    className={icon + ' mx-1 remixui_menuItem'}
                    key={`index-${action}-${placement}-${icon}`}
                    onClick={() => {
                      trackMatomoEvent({ category: 'fileExplorer', action: 'fileAction', name: action, isClick: true })
                      props.handleGitInit()
                    }}
                  >
                  </label>
                </CustomTooltip>
              )
            } else {
              return (
                <CustomTooltip
                  placement={placement as Placement}
                  tooltipId={`${action}-${title}-${icon}-${index}`}
                  tooltipClasses="text-nowrap"
                  tooltipText={<FormattedMessage id={`filePanel.${action}`} defaultMessage={title} />}
                  key={`${action}-${title}-${index}`}
                >
                  <label
                    id={action}
                    style={{ fontSize: '1.1rem', cursor: 'pointer' }}
                    data-id={'fileExplorerNewFile' + action}
                    onClick={(e) => {
                      e.stopPropagation()
                      trackMatomoEvent({ category: 'fileExplorer', action: 'fileAction', name: action, isClick: true })
                      if (action === 'createNewFile') {
                        props.createNewFile()
                      } else if (action === 'createNewFolder') {
                        props.createNewFolder()
                      } else if (action === 'publishToGist' || action == 'updateGist') {
                        props.publishToGist()
                      } else if (action === 'importFromIpfs') {
                        trackMatomoEvent({ category: 'fileExplorer', action: 'fileAction', name: action, isClick: true })
                        props.importFromIpfs('Ipfs', 'ipfs hash', ['ipfs://QmQQfBMkpDgmxKzYaoAtqfaybzfgGm9b2LWYyT56Chv6xH'], 'ipfs://')
                      } else if (action === 'importFromHttps') {
                        trackMatomoEvent({ category: 'fileExplorer', action: 'fileAction', name: action, isClick: true })
                        props.importFromHttps('Https', 'http/https raw content', ['https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/master/contracts/token/ERC20/ERC20.sol'])
                      } else if (action === 'revealInExplorer') {
                        trackMatomoEvent({ category: 'fileExplorer', action: 'fileAction', name: action, isClick: true })
                        props.revealInExplorer()
                      } else {
                        state.actions[action]()
                      }
                    }}
                    className={icon + ' mx-1 remixui_menuItem'}
                    key={`${action}-${title}-${index}`}
                  ></label>
                </CustomTooltip>
              )
            }
          }) : null} */}
        </span>
      </>)
  )
}

export default FileExplorerMenu
