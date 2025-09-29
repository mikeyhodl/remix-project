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
    <section className="d-flex flex-column gap-3 bg-light">
      <div>
        <h6 className="text-uppercase small fw-semibold mb-2">Workspace Name</h6>
      </div>
      <div className="d-flex flex-row gap-3">
        <div className="w-25 mx-3" style={{ height: '550px' }}>
          <MiniFileExplorer />
        </div>
        <div className="w-75">
          <Editor
            height="100%"
            defaultLanguage="typescript"
            options={{ readOnly: true, minimap: { enabled: false }, lineNumbers: 'off' }}
            value={storageContractCode('Storage')}
          />
        </div>
      </div>
    </section>
  )
}
