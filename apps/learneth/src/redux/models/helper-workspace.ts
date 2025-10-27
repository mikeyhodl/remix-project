const learnethWorkspaceName = 'learneth tutorials'

export const ensureLearnethWorkspace = async (remixClient) => {
  const current = await remixClient.call('filePanel', 'getCurrentWorkspace')
  if (current === learnethWorkspaceName) {
    return
  }
  const workspaces = await remixClient.call('filePanel', 'getWorkspaces')
  const exists = workspaces.includes('learneth')
  if (!exists) {
    await remixClient.call('filePanel', 'createWorkspace', learnethWorkspaceName, 'blank', false)
  }
  return remixClient.call('filePanel', 'switchToWorkspace', learnethWorkspaceName)  
}
