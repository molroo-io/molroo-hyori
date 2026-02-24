// Stub for node:fs — ai-prompt-cache imports these but is never used in browser
export function existsSync() { return false }
export function readFileSync() { throw new Error('node:fs is not available in the browser') }
export function writeFileSync() { throw new Error('node:fs is not available in the browser') }
export function mkdirSync() { throw new Error('node:fs is not available in the browser') }
export function unlinkSync() { throw new Error('node:fs is not available in the browser') }
export default {}
