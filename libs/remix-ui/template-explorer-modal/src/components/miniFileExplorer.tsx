import React, { useState } from 'react'

const structure = {
  '.deps': {
    type: 'folder',
    name: '.deps',
    isDirectory: true,
    isOpen: true,
    child: [],
    selected: false
  },
  'contracts': {
    type: 'folder',
    name: 'contracts',
    isDirectory: true,
    isOpen: true,
    child: [
      {
        type: 'file',
        name: '1_Storage.sol',
        isDirectory: false,
        isOpen: true,
        child: [],
        selected: false
      },
      {
        type: 'file',
        name: '2_Owner.sol',
        isDirectory: false,
        isOpen: true,
        child: [],
        selected: false
      },
      {
        type: 'file',
        name: '3_Ballot.sol',
        isDirectory: false,
        isOpen: true,
        child: [],
        selected: false
      }
    ]
  },
  'scripts': {
    type: 'folder',
    name: 'scripts',
    isDirectory: true,
    isOpen: true,
    child: [],
    selected: false
  },
  'tests': {
    type: 'folder',
    name: 'tests',
    isDirectory: true,
    isOpen: true,
    child: [],
    selected: false
  },
  'remix.config.json': {
    type: 'file',
    name: 'remix.config.json',
    isDirectory: false,
    isOpen: true,
    child: [],
    selected: false
  }
}

const getFileExtension = (fileName: string) => {
  const nw = fileName.split('.')
  return nw[nw.length - 1]
}

const styleJson = (child: any) => getFileExtension(child.name) === 'json' ? '#fb923c' : ''

const styleSelected = (child: any) => child.selected ? 'bg-secondary' : ''
export function MiniFileExplorer() {
  const [selectedStyle, setSelectedStyle] = useState('')

  return (
    <ul className="border mx-auto p-3 w-100" style={{ borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px', minHeight: '100%' }}>
      {Object.entries(structure).map(([key, value]) => (
        <li key={key} className="list-unstyled d-flex flex-column">
          <div className="p-1">
            <i className={`fas fa-${value.type === 'folder' ? 'folder' : getFileExtension(value.name) === 'sol' ? 'fa-kit fa-solidity-mono' : getFileExtension(value.name) === 'json' ? 'small fas fa-brackets-curly' : 'file'}`}
              style={{ color: styleJson(value) }}></i>
            <span className="ms-1">{value.name}</span>
          </div>
          {value.child.map((child: any, index: number) => (
            <span key={child.name} className="list-unstyled d-flex flex-column ps-3">
              <div className={`${selectedStyle}`} onClick={() => {
                setSelectedStyle(child.selected ? '' : 'bg-secondary')
              }}>
                <i className={`${child.type === 'folder' ? child.isOpen ? 'fas fa-folder-open' : 'fas fa-folder' : getFileExtension(child.name) === 'sol' ? 'fa-kit fa-solidity-mono' : getFileExtension(child.name) === 'json' ? 'small fas fa-brackets-curly' : 'fas fa-file'}`}></i>
                <span className="ms-1">{child.name}</span>
              </div>
            </span>
          ))}
        </li>
      ))}
    </ul>
  )
}
