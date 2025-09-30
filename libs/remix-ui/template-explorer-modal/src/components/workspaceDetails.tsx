import React from 'react'
import { MiniFileExplorer } from './miniFileExplorer'
import { Editor } from '@monaco-editor/react'
import { ContractTypeStrategy } from '../../types/template-explorer-types'
import { storageContractCode, ownerContractCode, ballotContractCode } from '../contractCode/remixDefault'

interface WorkspaceDetailsProps {
  strategy?: any
}

export function WorkspaceDetails(props: WorkspaceDetailsProps) {
  return (
    <section className="d-flex flex-column gap-3 bg-light" style={{ height: '80%' }}>
      <div className="pt-3 ps-3 d-flex flex-row align-items-center text-dark">
        <span className="text-uppercase small ">Workspace Name</span>
        <i className="fa-solid fa-edit ms-2"></i>
      </div>
      <div className="d-flex flex-row h-100 p-3" style={{ height: '100%' }}>
        <div className="" style={{ minHeight: '80%', minWidth: '30%', borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px' }}>
          <MiniFileExplorer />
        </div>
        <div className="border" style={{ minHeight: '75%', minWidth: '70%', borderTopRightRadius: '10px', borderBottomRightRadius: '10px' }}>
          <Editor
            height="100%"
            width="100%"
            defaultLanguage="typescript"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              lineNumbers: 'off',
              scrollbar: {
                vertical: 'hidden',
                horizontal: 'hidden'
              }
            }}
            value={storageContractCode('Storage')}
          />
        </div>
      </div>
    </section>
  )
}
