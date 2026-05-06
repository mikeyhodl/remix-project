/**
 * CRE Desktop Bridge — WebSocket server
 *
 * Bundled inside the RemixDesktop Electron main process. Scaffold CRE
 * connects to this server as a WebSocket client to send project files
 * directly into the active Remix workspace.
 *
 * Protocol:
 *
 *   CRE → Desktop (import request):
 *   {
 *     type: "cre:import",
 *     version: 1,
 *     projectName: string,
 *     files: Record<string, string>   // path → content
 *   }
 *
 *   Desktop → CRE (acknowledgement):
 *   { type: "cre:import:ack", success: true,  workspace: string }
 *   { type: "cre:import:ack", success: false, error: string }
 */

import { WebSocketServer, WebSocket } from 'ws'
import * as fs from 'fs'
import * as path from 'path'
import { BrowserWindow } from 'electron'

export const CRE_BRIDGE_PORT = 27182

export interface CREImportPayload {
  type: 'cre:import'
  version: number
  projectName: string
  files: Record<string, string>
}

interface CREImportAck {
  type: 'cre:import:ack'
  success: boolean
  workspace?: string
  error?: string
}

/** Origins allowed to connect to the CRE bridge */
const ALLOWED_ORIGINS = [
  'https://cre.solange.dev',
  // Allow any localhost port for local CRE dev
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
]

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false
  return ALLOWED_ORIGINS.some((allowed) =>
    typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
  )
}

let server: WebSocketServer | null = null

function ack(ws: WebSocket, result: CREImportAck) {
  try {
    ws.send(JSON.stringify(result))
  } catch (_) { /* ignore send errors on closing sockets */ }
}

/**
 * Write all files from the CRE payload into the given workspace root.
 * Intermediate directories are created automatically.
 */
function writeProjectFiles(
  workspaceRoot: string,
  projectName: string,
  files: Record<string, string>
): string {
  const projectDir = path.resolve(workspaceRoot, projectName)
  fs.mkdirSync(projectDir, { recursive: true })

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.resolve(projectDir, filePath)

    // Path traversal check: ensure the resolved path stays within projectDir
    if (!fullPath.startsWith(projectDir + path.sep) && fullPath !== projectDir) {
      throw new Error(`Path traversal attempt detected: "${filePath}" resolves outside the project directory.`)
    }

    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf-8')
  }

  return projectDir
}

/**
 * Notify the Remix renderer that a new CRE project has been imported
 * so it can refresh the file explorer and open the workspace.
 */
function notifyRenderer(projectName: string, projectDir: string) {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('cre:project-imported', { projectName, projectDir })
  }
}

/**
 * Resolve the active Remix workspace root directory.
 * Falls back to ~/remix-workspaces if no window-specific path is available.
 */
function resolveWorkspaceRoot(): string {
  // RemixDesktop stores workspaces under the user's home dir by default
  const home = process.env.HOME || process.env.USERPROFILE || '.'
  const workspaceRoot = path.join(home, 'remix-workspaces')
  fs.mkdirSync(workspaceRoot, { recursive: true })
  return workspaceRoot
}

function handleMessage(ws: WebSocket, raw: string) {
  let payload: CREImportPayload

  try {
    payload = JSON.parse(raw)
  } catch {
    return ack(ws, { type: 'cre:import:ack', success: false, error: 'Invalid JSON payload.' })
  }

  if (payload.type !== 'cre:import') {
    return ack(ws, { type: 'cre:import:ack', success: false, error: `Unknown message type: ${payload.type}` })
  }

  if (!payload.projectName || typeof payload.files !== 'object') {
    return ack(ws, { type: 'cre:import:ack', success: false, error: 'Missing projectName or files in payload.' })
  }

  try {
    const workspaceRoot = resolveWorkspaceRoot()
    writeProjectFiles(workspaceRoot, payload.projectName, payload.files)
    notifyRenderer(payload.projectName, path.join(workspaceRoot, payload.projectName))
    ack(ws, { type: 'cre:import:ack', success: true, workspace: payload.projectName })
    console.log(`[CRE Bridge] Imported project "${payload.projectName}" (${Object.keys(payload.files).length} files)`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[CRE Bridge] Failed to write project files:', msg)
    ack(ws, { type: 'cre:import:ack', success: false, error: `Failed to write files: ${msg}` })
  }
}

/**
 * Start the CRE WebSocket bridge server.
 * Only binds to localhost — not exposed to the network.
 * Safe to call multiple times; subsequent calls are no-ops.
 */
export function startCREBridge(): void {
  if (server) return

  server = new WebSocketServer({ host: '127.0.0.1', port: CRE_BRIDGE_PORT })

  server.on('listening', () => {
    console.log(`[CRE Bridge] Listening on ws://127.0.0.1:${CRE_BRIDGE_PORT}`)
  })

  server.on('connection', (ws, req) => {
    const origin = req.headers.origin

    // Origin validation — reject connections from disallowed origins
    if (!isOriginAllowed(origin)) {
      console.warn(`[CRE Bridge] Rejected connection from disallowed origin: ${origin ?? '(none)'}`)
      ws.close(4003, 'Origin not allowed')
      return
    }

    console.log(`[CRE Bridge] Client connected from ${origin}`)

    ws.on('message', (data) => handleMessage(ws, data.toString()))

    ws.on('error', (err) => {
      console.error('[CRE Bridge] Socket error:', err.message)
    })

    ws.on('close', () => {
      console.log('[CRE Bridge] Client disconnected')
    })
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[CRE Bridge] Port ${CRE_BRIDGE_PORT} already in use — bridge not started.`)
    } else {
      console.error('[CRE Bridge] Server error:', err.message)
    }
    server = null
  })
}

/**
 * Stop the CRE WebSocket bridge server gracefully.
 */
export function stopCREBridge(): void {
  if (!server) return
  server.close(() => {
    console.log('[CRE Bridge] Stopped.')
  })
  server = null
}
