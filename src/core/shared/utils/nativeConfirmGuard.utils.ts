import ts from 'typescript'

/**
 * Native confirm guard (design-system.md, Confirmación y salir sin guardar). Confirmations go through
 * `useConfirm`, never the browser's unthemed `window.confirm`. Test-only helper: it parses source with
 * the TypeScript compiler, so comments, methods (`commands.confirm(...)`) and a local `confirm` from
 * `useConfirm()` do not count.
 */

const GLOBAL_OWNERS = new Set(['window', 'globalThis', 'self'])

function scripts(source: string, file: string): string[] {
  if (!file.endsWith('.vue')) return [source]
  return [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1] ?? '')
}

function declaresConfirm(node: ts.Node): boolean {
  const named = ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isParameter(node)
    || ts.isBindingElement(node) || ts.isImportSpecifier(node) || ts.isImportClause(node)
  const name = named ? (node as { name?: ts.Node }).name : undefined
  return Boolean(name && ts.isIdentifier(name) && name.text === 'confirm')
}

/** Names of the native confirm calls in a `.ts` or `.vue` source (`window.confirm`, bare `confirm`). */
export function scanNativeConfirmSource(source: string, file: string): string[] {
  const found: string[] = []
  for (const script of scripts(source, file)) {
    const tree = ts.createSourceFile('guard.ts', script, ts.ScriptTarget.Latest, true)
    let local = false
    const calls: string[] = []
    const visit = (node: ts.Node) => {
      if (declaresConfirm(node)) local = true
      if (ts.isCallExpression(node)) {
        const callee = node.expression
        if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'confirm'
          && ts.isIdentifier(callee.expression) && GLOBAL_OWNERS.has(callee.expression.text)) found.push(`${callee.expression.text}.confirm`)
        else if (ts.isIdentifier(callee) && callee.text === 'confirm') calls.push('confirm')
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
    if (!local) found.push(...calls)
  }
  return found
}
