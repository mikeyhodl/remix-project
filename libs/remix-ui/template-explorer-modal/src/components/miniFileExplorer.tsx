import React from 'react'

const structure = {
  '.deps': {
    type: 'folder',
    name: '.deps',
    isDirectory: true,
    isOpen: true,
    child: []
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
        child: []
      },
      {
        type: 'file',
        name: '2_Owner.sol',
        isDirectory: false,
        isOpen: true,
        child: []
      },
      {
        type: 'file',
        name: '3_Ballot.sol',
        isDirectory: false,
        isOpen: true,
        child: []
      }
    ]
  },
  'scripts': {
    type: 'folder',
    name: 'scripts',
    isDirectory: true,
    isOpen: true,
    child: []
  },
  'tests': {
    type: 'folder',
    name: 'tests',
    isDirectory: true,
    isOpen: true,
    child: []
  },
  'remix.config.json': {
    type: 'file',
    name: 'remix.config.json',
    isDirectory: false,
    isOpen: true,
    child: []
  }
}

const g = (n: string) => {
  const nw = n.split('.')
}

export function MiniFileExplorer() {

  return (
    <ul>
      {Object.entries(structure).map(([key, value]) => (
        <li key={key} className="list-unstyled d-flex flex-column">
          <div>
            <i className={`fas fa-${value.type === 'folder' ? 'folder' : 'file'}`}></i>
            <span className="ms-1">{value.name}</span>
          </div>
          {value.child.map((child) => (
            <span key={child.name} className="list-unstyled d-flex flex-column ps-3">
              <div>
                <i className={`fas fa-${child.type === 'folder' ? 'folder' : 'file'}`}></i>
                <span className="ms-1">{child.name}</span>
              </div>
            </span>
          ))}
        </li>
      ))}
    </ul>
  )
}
