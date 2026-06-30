import axios from 'axios'
import { AI_URL } from './client'

export type AiAction = 'review' | 'explain' | 'fix'

// Streams SSE from the AI service; calls onChunk for each text chunk, returns full text.
export async function callAi(action: AiAction, code: string, language: string, onChunk: (chunk: string) => void): Promise<string> {
  const response = await fetch(`${AI_URL}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language }),
  })

  if (!response.ok) throw new Error(`AI service responded ${response.status}`)
  if (!response.body) throw new Error('No response body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        const text = line.slice(6)  // preserve spaces within tokens
        if (text && text !== '[DONE]') {
          full += text
          onChunk(text)
        }
      }
    }
  }

  return full
}

// Used for autocomplete (non-streaming)
export async function autocomplete(prefix: string, language: string): Promise<string> {
  const { data } = await axios.post<{ completion: string }>(`${AI_URL}/autocomplete`, { prefix, language })
  return data.completion ?? ''
}
