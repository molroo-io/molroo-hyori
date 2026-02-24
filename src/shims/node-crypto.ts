// Stub for node:crypto — ai-prompt-cache imports createHash/createHmac, never called in browser
export function createHmac() {
  throw new Error('node:crypto is not available in the browser')
}
export function createHash() {
  throw new Error('node:crypto is not available in the browser')
}
