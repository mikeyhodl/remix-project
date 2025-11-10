import { ChatEntry } from "../types/types"

export abstract class ChatHistory{

  private static chatEntries:ChatEntry[] = []
  static queueSize:number = 7 // change the queue size wrt the GPU size

  public static pushHistory(prompt, result){
    if (result === "") return // do not allow empty assistant message due to nested stream handles on toolcalls
    const chat:ChatEntry = [prompt, result]
    this.chatEntries.push(chat)
    if (this.chatEntries.length > this.queueSize){this.chatEntries.shift()}
  }

  public static getHistory(){
    return this.chatEntries
  }

  public static clearHistory(){
    this.chatEntries = []
  }
}
