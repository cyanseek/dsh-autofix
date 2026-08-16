import { failureText } from '../engine/text.js'
import type { AutoFixRecipe, RecoveryInput, RecoveryMatch } from '../engine/types.js'

const ALTERNATIVES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  python: ['python3', 'py'],
  python3: ['python', 'py'],
  pwsh: ['powershell'],
  powershell: ['pwsh'],
  rg: ['grep', 'findstr', 'Select-String'],
  grep: ['rg', 'findstr', 'Select-String'],
  open: ['start', 'xdg-open', 'open'],
  pbcopy: ['clip', 'xclip', 'wl-copy'],
})

const SHELL_TOOLS = new Set(['bash', 'shell', 'terminal', 'pwsh', 'powershell', 'command'])

interface CommandMatch extends RecoveryMatch {
  readonly command: string
}

function shellTool(name: string): boolean {
  const leaf = name.toLowerCase().split(/[/.]/).at(-1) ?? ''
  return SHELL_TOOLS.has(leaf)
}

function missingCommand(text: string): string | undefined {
  const patterns = [
    /(?:^|\n)[^\n]*?\b([A-Za-z0-9._-]+): command not found\b/i,
    /\bcommand not found:\s*([A-Za-z0-9._-]+)\b/i,
    /(?:^|\n)[^\n]*?\b([A-Za-z0-9._-]+): not found\b/i,
    /['"]?([A-Za-z0-9._-]+)['"]? is not recognized as (?:the name of |an )?(?:a cmdlet, function, script file, or operable program|internal or external command)/i,
    /The term ['"]([A-Za-z0-9._-]+)['"] is not recognized/i,
  ]
  for (const pattern of patterns) {
    const command = pattern.exec(text)?.[1]?.toLowerCase()
    if (command !== undefined && ALTERNATIVES[command] !== undefined) return command
  }
  return undefined
}

export const commandAlternativeRecipe: AutoFixRecipe<CommandMatch> = {
  id: 'command-alternative',
  priority: 200,
  match(input) {
    if (!shellTool(input.exec.name)) return undefined
    const command = missingCommand(failureText(input.result))
    return command === undefined ? undefined : { fingerprint: `COMMAND_NOT_FOUND:${command}`, command }
  },
  async recover(input, match) {
    if (input.signal.aborted) return undefined
    for (const candidate of ALTERNATIVES[match.command] ?? []) {
      if (candidate.toLowerCase() === match.command) continue
      if (await input.services.commandExists(candidate, input.signal)) {
        if (input.signal.aborted) return undefined
        return {
          summary: `${match.command} unavailable; use ${candidate}`,
          text: [
            `AutoFix found that \`${match.command}\` is unavailable.`,
            `Available equivalent on this machine: \`${candidate}\`.`,
            'Continue now using the available command; do not ask the user.',
            'Do not install software or rewrite unrelated shell operations.',
          ].join('\n'),
        }
      }
    }
    return undefined
  },
}
