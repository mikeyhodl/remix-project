import React, { useState } from 'react'
import { FuncABI } from '@remix-project/core-plugin'
import { TreeView, TreeViewItem } from '@remix-ui/tree-view'
import { extractDataDefault } from '@remix-ui/helper'

interface ContractFunctionItemProps {
  funcABI: FuncABI
  funcIndex: number
  contractIndex: number
  themeQuality: string
  funcInputs: Record<number, string>
  decodedResponse?: any
  expandPath: string[]
  onInputChange: (funcIndex: number, value: string) => void
  onExecute: (funcABI: FuncABI, funcIndex: number, lookupOnly: boolean) => void
  onExpand: (path: string) => void
}

export const ContractFunctionItem: React.FC<ContractFunctionItemProps> = ({
  funcABI,
  funcIndex,
  contractIndex,
  themeQuality,
  funcInputs,
  decodedResponse,
  expandPath,
  onInputChange,
  onExecute,
  onExpand
}) => {
  const [multiInputMode, setMultiInputMode] = useState<boolean>(false)

  const isConstant = funcABI.constant !== undefined ? funcABI.constant : false
  const lookupOnly = funcABI.stateMutability === 'view' || funcABI.stateMutability === 'pure' || isConstant
  const inputNames = funcABI.inputs.map(input => input.name).join(', ')
  const inputTypes = funcABI.inputs.map(input => input.type).join(', ')

  const toggleMultiInputMode = () => {
    setMultiInputMode(prev => !prev)
  }

  const label = (key: string | number, value: string) => {
    return (
      <div className="d-flex mt-2 flex-row label_item align-items-baseline">
        <label className="small fw-bold mb-0 pe-1 label_key">{key}:</label>
        <label className="m-0 label_value">{value}</label>
      </div>
    )
  }

  const renderData = (item: any, parent: any, key: string | number, keyPath: string): any => {
    const data = extractDataDefault(item, parent)
    const children = (data.children || []).map((child: any) => {
      return renderData(child.value, data, child.key, keyPath + '/' + child.key)
    })

    if (children && children.length > 0) {
      return (
        <TreeViewItem id={`treeViewItem${key}`} key={keyPath} label={label(key, data.self)} onClick={() => onExpand(keyPath)} expand={expandPath.includes(keyPath)}>
          <TreeView id={`treeView${key}`} key={keyPath}>
            {children}
          </TreeView>
        </TreeViewItem>
      )
    } else {
      return <TreeViewItem id={key.toString()} key={keyPath} label={label(key, data.self)} onClick={() => onExpand(keyPath)} expand={expandPath.includes(keyPath)} />
    }
  }

  const getStateMutabilityBadge = () => {
    if (funcABI.stateMutability === 'view' || funcABI.stateMutability === 'pure') {
      return <span className='badge text-info me-1' style={{ backgroundColor: '#64C4FF14' }}>call</span>
    } else if (funcABI.stateMutability === 'payable') {
      return <span className='badge text-danger me-1' style={{ backgroundColor: '#FF777714' }}>payable</span>
    } else {
      return <span className='badge text-warning me-1' style={{ backgroundColor: '#FFB96414' }}>transact</span>
    }
  }

  return (
    <div className="mb-1 px-0 py-2 rounded" data-id={`contractItem-${funcIndex}`}>
      <div className="d-flex align-items-center mb-2">
        {getStateMutabilityBadge()}
        <div className="d-flex align-items-center" style={{ minWidth: 0, flex: 1 }}>
          <label
            className="mb-0 me-1 text-secondary"
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              maxWidth: '100%'
            }}
            title={funcABI.name}
          >
            {funcABI.name}
          </label>
          {inputNames && (
            <span
              style={{
                fontWeight: 'lighter',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
                flexShrink: 1
              }}
              title={inputNames}
            >
              {inputNames}
            </span>
          )}
        </div>
      </div>

      {multiInputMode && funcABI.inputs.length > 1 ? (
        <div className="d-flex flex-column gap-2">
          {funcABI.inputs.map((input, inputIdx) => (
            <div key={inputIdx} className="position-relative">
              <input
                type="text"
                placeholder={`${input.name || `param${inputIdx}`} (${input.type})`}
                className="form-control"
                value={(() => {
                  const values = (funcInputs[funcIndex] || '').split(',').map(v => v.trim())
                  return values[inputIdx] || ''
                })()}
                onChange={(e) => {
                  const values = (funcInputs[funcIndex] || '').split(',').map(v => v.trim())
                  values[inputIdx] = e.target.value
                  onInputChange(funcIndex, values.join(', '))
                }}
                style={{
                  backgroundColor: 'var(--bs-body-bg)',
                  color: themeQuality === 'dark' ? 'white' : 'black',
                  padding: '0.75rem',
                  fontSize: '0.75rem'
                }}
                data-id={`deployedContractItem-${contractIndex}-input-${funcIndex}-${inputIdx}`}
              />
            </div>
          ))}
          <div className="d-flex gap-2">
            <button
              className="btn btn-sm btn-secondary flex-grow-1"
              onClick={() => onExecute(funcABI, funcIndex, lookupOnly)}
              style={{ fontSize: '0.65rem', fontWeight: 'bold' }}
              data-id={`deployedContractItem-${contractIndex}-button-${funcIndex}`}
            >
              Execute
            </button>
            {funcABI.inputs.length > 1 && (
              <button
                className="btn btn-sm btn-secondary px-1"
                onClick={toggleMultiInputMode}
                style={{ fontSize: '0.65rem' }}
                title="Switch to single input"
              >
                <i className="fas fa-angle-up"></i>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="position-relative flex-fill">
          <input
            type="text"
            placeholder={inputTypes}
            className="form-control"
            value={funcInputs[funcIndex] || ''}
            onChange={(e) => onInputChange(funcIndex, e.target.value)}
            style={{
              backgroundColor: 'var(--bs-body-bg)',
              color: themeQuality === 'dark' ? 'white' : 'black',
              flex: 1,
              padding: '0.75rem',
              paddingRight: funcABI.inputs.length > 1 ? '6rem' : '4.5rem',
              fontSize: '0.75rem',
              cursor: !inputNames ? 'not-allowed' : 'text'
            }}
            disabled={!inputNames && !inputTypes}
            data-id={`deployedContractItem-${contractIndex}-input-${funcIndex}`}
          />
          <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', zIndex: 2, display: 'flex', gap: '0.25rem' }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => onExecute(funcABI, funcIndex, lookupOnly)}
              style={{ fontSize: '0.65rem', fontWeight: 'bold' }}
              data-id={`deployedContractItem-${contractIndex}-button-${funcIndex}`}
            >
              Execute
            </button>
            {funcABI.inputs.length > 1 && (
              <button
                className="btn btn-sm btn-secondary px-1"
                onClick={toggleMultiInputMode}
                style={{ fontSize: '0.65rem' }}
                title="Switch to multi input"
              >
                <i className="fas fa-angle-down"></i>
              </button>
            )}
          </div>
        </div>
      )}

      {lookupOnly && decodedResponse && (
        <div className="udapp_value" data-id="udapp_tree_value">
          <TreeView id="treeView">
            {Object.keys(decodedResponse || {}).map((key) => {
              const response = decodedResponse[key]

              return parseInt(key) === funcIndex
                ? Object.keys(response || {}).map((innerkey) => {
                  return renderData(decodedResponse[key][innerkey], response, innerkey, innerkey)
                })
                : null
            })}
          </TreeView>
        </div>
      )}
    </div>
  )
}
