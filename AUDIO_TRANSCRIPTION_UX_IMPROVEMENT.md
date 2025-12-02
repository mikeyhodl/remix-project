# Audio Transcription UX Improvement

## Summary

Modified the audio transcription behavior in the Remix AI Assistant to append transcribed text to the input box instead of immediately executing it as a prompt. This allows users to review and edit the transcription before sending.

## Changes Made

### File Modified
- `libs/remix-ui/remix-ai-assistant/src/components/remix-ui-remix-ai-assistant.tsx`

### Previous Behavior
When audio transcription completed, the transcribed text was immediately sent as a prompt to the AI assistant:

```typescript
onTranscriptionComplete: async (text) => {
  if (sendPromptRef.current) {
    await sendPromptRef.current(text)
    trackMatomoEvent({ category: 'ai', action: 'SpeechToTextPrompt', name: 'SpeechToTextPrompt', isClick: true })
  }
}
```

### New Behavior
When audio transcription completes, the behavior depends on whether the transcription ends with "run":

**If transcription ends with "run":** The prompt is automatically executed (with "run" removed)
**If transcription does NOT end with "run":** The text is appended to the input box for review

```typescript
onTranscriptionComplete: async (text) => {
  // Check if transcription ends with "run" (case-insensitive)
  const trimmedText = text.trim()
  const endsWithRun = /\brun\b\s*$/i.test(trimmedText)

  if (endsWithRun) {
    // Remove "run" from the end and execute the prompt
    const promptText = trimmedText.replace(/\brun\b\s*$/i, '').trim()
    if (promptText) {
      await sendPrompt(promptText)
      trackMatomoEvent({ category: 'ai', action: 'SpeechToTextPromptAutoRun', name: 'SpeechToTextPromptAutoRun', isClick: true })
    }
  } else {
    // Append transcription to the input box for user review
    setInput(prev => prev ? `${prev} ${text}`.trim() : text)
    // Focus the textarea so user can review/edit
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
    trackMatomoEvent({ category: 'ai', action: 'SpeechToTextPrompt', name: 'SpeechToTextPrompt', isClick: true })
  }
}
```

### Code Cleanup
Removed unused code that was only needed for the previous immediate execution behavior:

1. **Removed ref declaration:**
   ```typescript
   // Ref to hold the sendPrompt function for audio transcription callback
   const sendPromptRef = useRef<((prompt: string) => Promise<void>) | null>(null)
   ```

2. **Removed useEffect that updated the ref:**
   ```typescript
   // Update ref for audio transcription callback
   useEffect(() => {
     sendPromptRef.current = sendPrompt
   }, [sendPrompt])
   ```

## Benefits

1. **User Control:** Users can now review and edit the transcription before sending
2. **Error Correction:** If the speech-to-text makes mistakes, users can fix them
3. **Better UX:** Users can append multiple transcriptions or combine voice with typing
4. **Flexibility:** Transcriptions can be modified to add context or clarification
5. **Voice Command Execution:** Users can say "run" at the end to immediately execute the prompt
6. **Hands-free Operation:** The "run" command enables completely hands-free prompt execution

## User Flow

### Standard Flow (Without "run")
1. User clicks the microphone button to start recording
2. User speaks their prompt (e.g., "Explain how to create an ERC-20 token")
3. User clicks the microphone button again to stop recording
4. **Transcribing status** is shown while processing
5. **Transcribed text appears in the input box** (NEW)
6. Input textarea is automatically focused (NEW)
7. User can review, edit, or append to the transcription (NEW)
8. User clicks send button or presses Enter to submit the prompt

### Auto-Execute Flow (With "run")
1. User clicks the microphone button to start recording
2. User speaks their prompt ending with "run" (e.g., "Explain how to create an ERC-20 token run")
3. User clicks the microphone button again to stop recording
4. **Transcribing status** is shown while processing
5. **Prompt is automatically executed** with "run" removed (NEW)
6. AI response begins streaming immediately (hands-free execution)

## Implementation Details

### "Run" Detection Logic
The implementation uses a word-boundary regex to detect if the transcription ends with "run":

```typescript
const endsWithRun = /\brun\b\s*$/i.test(trimmedText)
```

Key features:
- **Case-insensitive:** Matches "run", "Run", "RUN", etc.
- **Word boundary:** Only matches "run" as a complete word, not as part of another word
- **Trailing whitespace:** Ignores any spaces after "run"

Examples:
- ✅ "Explain ERC-20 tokens run" → Auto-executes
- ✅ "Help me debug this run" → Auto-executes
- ✅ "Create a contract RUN" → Auto-executes (case-insensitive)
- ❌ "Explain running contracts" → Does NOT auto-execute (word boundary)
- ❌ "Tell me about runtime" → Does NOT auto-execute (word boundary)

### Smart Text Appending
The implementation intelligently handles existing input (when NOT auto-executing):
- If input is empty: Sets the transcription as the input
- If input exists: Appends the transcription with a space separator
- Always trims whitespace for clean formatting

```typescript
setInput(prev => prev ? `${prev} ${text}`.trim() : text)
```

### Auto-focus
After transcription (when NOT auto-executing), the textarea is automatically focused so the user can immediately start editing:

```typescript
if (textareaRef.current) {
  textareaRef.current.focus()
}
```

## Testing Recommendations

### Standard Transcription (Without "run")
1. Test basic transcription flow - text appears in input box
2. Test appending multiple transcriptions
3. Test transcription with existing text in input
4. Test keyboard navigation after transcription
5. Test error handling (transcription failures)
6. Verify textarea focus behavior

### Auto-Execute with "run"
1. Test transcription ending with "run" - should auto-execute
2. Test case-insensitivity - "run", "Run", "RUN" should all work
3. Test word boundary - "running" or "runtime" should NOT trigger auto-execute
4. Test "run" removal - verify the word "run" is removed from the prompt
5. Test empty prompt after "run" removal - should not execute
6. Verify prompt execution starts immediately after transcription

### Edge Cases
1. Test "run" with trailing spaces - "prompt run  " should work
2. Test "run" as the only word - should not execute (empty prompt)
3. Test transcription with "run" in the middle - "run a test" should NOT auto-execute
4. Test multiple spaces before "run" - "prompt  run" should work

## Related Files

- Main component: `libs/remix-ui/remix-ai-assistant/src/components/remix-ui-remix-ai-assistant.tsx`
- Transcription hook: `libs/remix-ui/remix-ai-assistant/src/hooks/useAudioTranscription.tsx`
- Prompt input area: `libs/remix-ui/remix-ai-assistant/src/components/prompt.tsx`
