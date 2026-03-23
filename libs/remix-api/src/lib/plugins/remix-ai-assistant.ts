import { Profile } from '@remixproject/plugin-utils'

export interface IRemixAiAssistantApi {
  chatPipe(message: string): void
  handleExternalMessage(message: string): void
  getProfile(): Profile
  deleteConversation(id: string): Promise<void>
  loadConversations(): Promise<void>
  newConversation(): Promise<void>
  archiveConversation(id: string): Promise<void>
}
