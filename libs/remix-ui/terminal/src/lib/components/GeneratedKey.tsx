import React from 'react'
import { CopyToClipboard } from '@remix-ui/clipboard'

export const showGeneratedKey = (data: { address: string; privateKey: string }) => {
  return (
    <div className="mt-2 mb-3" style={{ fontFamily: 'monospace' }}>
      <table className="table table-sm" style={{ marginBottom: 0 }}>
        <tbody>
          <tr className="remix_ui_terminal_tr">
            <td className="remix_ui_terminal_td" style={{ fontWeight: 'bold', color: 'var(--success)', width: '180px' }}>
              Generated Address
            </td>
            <td className="remix_ui_terminal_td" style={{ wordBreak: 'break-all' }}>
              {data.address}
              <CopyToClipboard content={data.address} />
            </td>
          </tr>
          <tr className="remix_ui_terminal_tr">
            <td className="remix_ui_terminal_td" style={{ fontWeight: 'bold', color: 'var(--warning)' }}>
              Private Key
            </td>
            <td className="remix_ui_terminal_td" style={{ wordBreak: 'break-all' }}>
              {data.privateKey}
              <CopyToClipboard content={data.privateKey} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
