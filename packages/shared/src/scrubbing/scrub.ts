const PATTERNS: [RegExp, string][] = [
  [/sk-ant-[A-Za-z0-9\-]{20,}/g, '[REDACTED_ANT_KEY]'],
  [/sk-[A-Za-z0-9]{32,}/g, '[REDACTED_OPENAI_KEY]'],
  [/ghp_[A-Za-z0-9]{36}/g, '[REDACTED_GH_PAT]'],
  [/github_pat_[A-Za-z0-9_]{80,}/g, '[REDACTED_GH_PAT]'],
  [/AKIA[0-9A-Z]{16}/g, '[REDACTED_AWS_KEY]'],
  [/xox[baprs]-[0-9A-Za-z\-]+/g, '[REDACTED_SLACK_TOKEN]'],
  [/Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g, '[REDACTED_TOKEN]'],
  [/(?:api[_-]?key|apikey)\s*[:=]\s*[\w\-]{16,}/gi, '[REDACTED_API_KEY]'],
  [/(?:secret|password|passwd|pwd)\s*[:=]\s*[\w\-@.]{8,}/gi, '[REDACTED_SECRET]'],
  [/((?:secret|password|passwd|pwd)[^"]*["]\s*:\s*["])[\w\-@.]{8,}/gi, '$1[REDACTED_SECRET]'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----(\\\\n|\\\\r|\\n|\\r|[\s\S])*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]'],
  [/eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, '[REDACTED_JWT]'],
]

export function scrubData<T extends object>(data: T): T {
  const json = JSON.stringify(data)
  const scrubbed = PATTERNS.reduce((str, [pattern, replacement]) => {
    pattern.lastIndex = 0
    return str.replace(pattern, replacement as string)
  }, json)
  return JSON.parse(scrubbed) as T
}

export function hasSensitiveContent(str: string): boolean {
  return PATTERNS.some(([pattern]) => {
    pattern.lastIndex = 0
    return pattern.test(str)
  })
}
