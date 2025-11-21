import React, { useContext, useState } from 'react'
import { TemplateExplorerWizardAction } from '../../types/template-explorer-types'
import { TemplateExplorerContext } from '../../context/template-explorer-context'

export function ImportFromIpfs(props: any) {
  const { facade } = useContext(TemplateExplorerContext)
  const [externalResourceName, setExternalResourceName] = useState('')
  const [externalResourceNameError, setExternalResourceNameError] = useState('')

  return (
    <section className="d-flex flex-column gap-3 bg-light" style={{ height: '80%' }}>
      <div className="pt-3 d-flex flex-column text-dark mx-3 my-3">
        <input data-id="finalize-contract-wizard-workspaceName-input" type="text" className="form-control form-control-lg" value={externalResourceName} onChange={async (e) => {
          setExternalResourceName(e.target.value)
        }} />
        {externalResourceNameError.length > 0 && externalResourceName.length > 0 ? <span className="text-danger fw-light mt-1 justify-content-start fs-6">{externalResourceNameError}</span> : null }
      </div>

      <button className="btn btn-primary btn-sm mx-3" data-id="validateWorkspaceButton" onClick={async () => {
        if (!externalResourceName.startsWith('ipfs://') && !externalResourceName.startsWith('https://')) {
            setExternalResourceNameError('Your url must start with the proper protocol prefix of either ipfs:// or https://')
            return
          }
          const type = externalResourceName.startsWith('ipfs://') ? 'ipfs' : 'https'
          await facade.processLoadingExternalUrls(externalResourceName, type)
        facade.closeWizard()
      }}
      disabled={externalResourceName.length < 7}
    >
        Import
    </button>
    </section>
  )
}
