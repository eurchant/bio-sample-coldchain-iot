import { execFileSync } from 'node:child_process'

function git(args, options = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })
}

const stagedFiles = git(['diff', '--cached', '--name-only', '--diff-filter=d'])
  .split(/\r?\n/)
  .filter(Boolean)

if (stagedFiles.length === 0) {
  console.log('没有暂存文件，跳过提交前检查。')
  process.exit(0)
}

const pathRules = [
  { pattern: /(^|\/)(node_modules|dist|coverage|\.cache|__pycache__|\.venv|venv|env)(\/|$)/i, reason: '依赖、构建产物、缓存或虚拟环境' },
  { pattern: /(^|\/)\.env(?:\.|$)/i, reason: '环境变量文件' },
  { pattern: /\.(db|sqlite|sqlite3)$/i, reason: '数据库文件' },
  { pattern: /\.(pem|key|p12|crt)$/i, reason: '证书或私钥文件' },
  { pattern: /\.(log|tmp|swp)$/i, reason: '日志或临时文件' },
]

const leakedSecretPattern =
  /(?:api[_-]?key|secret|access[_-]?token|password)\s*[:=]\s*['"][^'"\s]{8,}['"]/i

const violations = []

for (const file of stagedFiles) {
  const normalized = file.replace(/\\/g, '/')
  const isExampleEnv = /(^|\/)\.env\.example$/i.test(normalized)
  const matchedRule = pathRules.find((rule) => rule.pattern.test(normalized))

  if (matchedRule && !(isExampleEnv && matchedRule.reason === '环境变量文件')) {
    violations.push(normalized + '：' + matchedRule.reason)
    continue
  }

  const content = execFileSync('git', ['show', ':' + file])
  if (!content.includes(0) && leakedSecretPattern.test(content.toString('utf8'))) {
    violations.push(normalized + '：疑似包含硬编码凭据')
  }
}

try {
  execFileSync('git', ['diff', '--cached', '--check'], { stdio: 'inherit' })
} catch {
  process.exit(1)
}

if (violations.length > 0) {
  console.error('提交已阻止：')
  for (const violation of violations) console.error('  - ' + violation)
  process.exit(1)
}

console.log('提交前检查通过：未发现敏感文件、运行产物或可见的硬编码凭据。')
