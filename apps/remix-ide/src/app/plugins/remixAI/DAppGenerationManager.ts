/**
 * DAppGenerationManager — DEPRECATED
 *
 * This class was part of the legacy DApp generation pipeline that directly called
 * the LLM (answerWithCustomSystemPrompt) and parsed the response (parsePages).
 *
 * As of 2026-05-11, DApp generation/update is handled by the QuickDapp Specialist
 * subagent via generate_dapp/update_dapp MCP tools in DAppGeneratorHandler.ts.
 *
 * This file is kept as a stub to avoid breaking imports.
 * TODO: Remove this file and all references once confirmed safe.
 */

export interface DAppGenerationManagerDeps {
  plugin: any
}

export class DAppGenerationManager {
  constructor(_deps: DAppGenerationManagerDeps) {
    // No-op: legacy class replaced by QuickDapp Specialist subagent
  }
}
