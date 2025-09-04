import React, { useState, useEffect } from 'react'
import { FormattedMessage } from 'react-intl'
import { ViewPlugin } from '@remixproject/engine-web'

interface MCPServer {
  name: string
  description?: string
  transport: 'stdio' | 'sse' | 'websocket'
  command?: string[]
  args?: string[]
  url?: string
  env?: Record<string, string>
  autoStart?: boolean
  timeout?: number
  enabled?: boolean
}

interface MCPConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  serverName: string
  error?: string
  lastAttempt?: number
}

interface MCPServerManagerProps {
  plugin: ViewPlugin
}

export const MCPServerManager: React.FC<MCPServerManagerProps> = ({ plugin }) => {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, MCPConnectionStatus>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null)
  const [formData, setFormData] = useState<Partial<MCPServer>>({
    name: '',
    description: '',
    transport: 'stdio',
    command: [],
    args: [],
    url: '',
    autoStart: true,
    enabled: true,
    timeout: 30000
  })

  useEffect(() => {
    loadServers()
    loadConnectionStatuses()
  }, [])

  const loadServers = async () => {
    try {
      const savedServers = await plugin.call('settings', 'get', 'settings/mcp/servers')
      if (savedServers) {
        setServers(JSON.parse(savedServers))
      }
    } catch (error) {
      console.warn('Failed to load MCP servers:', error)
    }
  }

  const loadConnectionStatuses = async () => {
    try {
      const statuses = await plugin.call('remixAI', 'getMCPConnectionStatus')
      const statusMap: Record<string, MCPConnectionStatus> = {}
      statuses.forEach((status: MCPConnectionStatus) => {
        statusMap[status.serverName] = status
      })
      setConnectionStatuses(statusMap)
    } catch (error) {
      console.warn('Failed to load MCP connection statuses:', error)
    }
  }

  const saveServer = async () => {
    try {
      const server: MCPServer = {
        name: formData.name!,
        description: formData.description,
        transport: formData.transport!,
        command: formData.transport === 'stdio' ? formData.command : undefined,
        args: formData.transport === 'stdio' ? formData.args : undefined,
        url: formData.transport !== 'stdio' ? formData.url : undefined,
        env: formData.env,
        autoStart: formData.autoStart,
        enabled: formData.enabled,
        timeout: formData.timeout
      }

      let newServers: MCPServer[]
      if (editingServer) {
        // Update existing server
        newServers = servers.map(s => s.name === editingServer.name ? server : s)
      } else {
        // Add new server
        newServers = [...servers, server]
      }

      setServers(newServers)
      await plugin.call('settings', 'set', 'settings/mcp/servers', JSON.stringify(newServers))

      // Add server to AI plugin
      if (!editingServer) {
        await plugin.call('remixAI', 'addMCPServer', server)
      }

      resetForm()
    } catch (error) {
      console.error('Failed to save MCP server:', error)
    }
  }

  const deleteServer = async (serverName: string) => {
    try {
      const newServers = servers.filter(s => s.name !== serverName)
      setServers(newServers)
      await plugin.call('settings', 'set', 'settings/mcp/servers', JSON.stringify(newServers))
      await plugin.call('remixAI', 'removeMCPServer', serverName)
      loadConnectionStatuses()
    } catch (error) {
      console.error('Failed to delete MCP server:', error)
    }
  }

  const toggleServer = async (server: MCPServer) => {
    try {
      const updatedServer = { ...server, enabled: !server.enabled }
      const newServers = servers.map(s => s.name === server.name ? updatedServer : s)
      setServers(newServers)
      await plugin.call('settings', 'set', 'settings/mcp/servers', JSON.stringify(newServers))

      if (updatedServer.enabled) {
        await plugin.call('remixAI', 'addMCPServer', updatedServer)
      } else {
        await plugin.call('remixAI', 'removeMCPServer', server.name)
      }
      loadConnectionStatuses()
    } catch (error) {
      console.error('Failed to toggle MCP server:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      transport: 'stdio',
      command: [],
      args: [],
      url: '',
      autoStart: true,
      enabled: true,
      timeout: 30000
    })
    setShowAddForm(false)
    setEditingServer(null)
  }

  const editServer = (server: MCPServer) => {
    setFormData(server)
    setEditingServer(server)
    setShowAddForm(true)
  }

  const getStatusIcon = (status?: MCPConnectionStatus) => {
    if (!status) return <span className="text-muted">○</span>

    switch (status.status) {
    case 'connected': return <span className="text-success">●</span>
    case 'connecting': return <span className="text-warning">●</span>
    case 'error': return <span className="text-danger">●</span>
    default: return <span className="text-muted">○</span>
    }
  }

  const getStatusText = (status?: MCPConnectionStatus) => {
    if (!status) return 'Not initialized'
    return status.status.charAt(0).toUpperCase() + status.status.slice(1)
  }

  return (
    <div className="mcp-server-manager">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">MCP Servers</h6>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : 'Add Server'}
        </button>
      </div>

      {showAddForm && (
        <div className="card mb-3">
          <div className="card-body">
            <h6>{editingServer ? 'Edit Server' : 'Add New MCP Server'}</h6>

            <div className="form-group mb-2">
              <label className="form-label">Name *</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Server name"
              />
            </div>

            <div className="form-group mb-2">
              <label className="form-label">Description</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div className="form-group mb-2">
              <label className="form-label">Transport *</label>
              <select
                className="form-control form-control-sm"
                value={formData.transport}
                onChange={(e) => setFormData({ ...formData, transport: e.target.value as 'stdio' | 'sse' | 'websocket' })}
              >
                <option value="stdio">Standard I/O</option>
                <option value="sse">Server-Sent Events</option>
                <option value="websocket">WebSocket</option>
              </select>
            </div>

            {formData.transport === 'stdio' ? (
              <>
                <div className="form-group mb-2">
                  <label className="form-label">Command *</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={formData.command?.join(' ') || ''}
                    onChange={(e) => setFormData({ ...formData, command: e.target.value.split(' ').filter(Boolean) })}
                    placeholder="python -m mcp_server"
                  />
                </div>
                <div className="form-group mb-2">
                  <label className="form-label">Arguments</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={formData.args?.join(' ') || ''}
                    onChange={(e) => setFormData({ ...formData, args: e.target.value.split(' ').filter(Boolean) })}
                    placeholder="--port 8080"
                  />
                </div>
              </>
            ) : (
              <div className="form-group mb-2">
                <label className="form-label">URL *</label>
                <input
                  type="url"
                  className="form-control form-control-sm"
                  value={formData.url || ''}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder={formData.transport === 'sse' ? 'http://localhost:8080/sse' : 'ws://localhost:8080/ws'}
                />
              </div>
            )}

            <div className="form-group mb-2">
              <label className="form-label">Timeout (ms)</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={formData.timeout || 30000}
                onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) || 30000 })}
                min="1000"
                max="300000"
              />
            </div>

            <div className="form-check mb-2">
              <input
                type="checkbox"
                className="form-check-input"
                checked={formData.autoStart || false}
                onChange={(e) => setFormData({ ...formData, autoStart: e.target.checked })}
              />
              <label className="form-check-label">Auto-start server</label>
            </div>

            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-primary" onClick={saveServer}>
                {editingServer ? 'Update' : 'Add'} Server
              </button>
              <button className="btn btn-sm btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mcp-servers-list">
        {servers.length === 0 ? (
          <div className="text-center text-muted p-3">
            <p>No MCP servers configured</p>
            <small>Add a server to start using MCP integration</small>
          </div>
        ) : (
          <div className="list-group">
            {servers.map((server) => (
              <div key={server.name} className="list-group-item">
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center mb-1">
                      {getStatusIcon(connectionStatuses[server.name])}
                      <strong className="ms-2">{server.name}</strong>
                      {!server.enabled && <span className="badge bg-secondary ms-2">Disabled</span>}
                    </div>
                    {server.description && (
                      <p className="text-muted small mb-1">{server.description}</p>
                    )}
                    <div className="small text-muted">
                      <div>Transport: {server.transport}</div>
                      {server.transport === 'stdio' ? (
                        <div>Command: {server.command?.join(' ')}</div>
                      ) : (
                        <div>URL: {server.url}</div>
                      )}
                      <div>Status: {getStatusText(connectionStatuses[server.name])}</div>
                      {connectionStatuses[server.name]?.error && (
                        <div className="text-danger">Error: {connectionStatuses[server.name]?.error}</div>
                      )}
                    </div>
                  </div>
                  <div className="d-flex flex-column gap-1">
                    <button
                      className={`btn btn-sm ${server.enabled ? 'btn-warning' : 'btn-success'}`}
                      onClick={() => toggleServer(server)}
                    >
                      {server.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => editServer(server)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => {
                        if (confirm(`Delete server "${server.name}"?`)) {
                          deleteServer(server.name)
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3">
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={loadConnectionStatuses}
        >
          Refresh Status
        </button>
      </div>

      <div className="mt-3 small text-muted">
        <p><strong>Transport Types:</strong></p>
        <ul>
          <li><strong>Standard I/O:</strong> Run MCP server as subprocess</li>
          <li><strong>Server-Sent Events:</strong> Connect via HTTP SSE</li>
          <li><strong>WebSocket:</strong> Connect via WebSocket protocol</li>
        </ul>
        <p><strong>Status Indicators:</strong>
          <span className="text-success ms-1">●</span> Connected
          <span className="text-warning ms-1">●</span> Connecting
          <span className="text-danger ms-1">●</span> Error
          <span className="text-muted ms-1">○</span> Disconnected
        </p>
      </div>
    </div>
  )
}