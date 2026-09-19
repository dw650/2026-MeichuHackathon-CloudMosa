/**
 * Prints one compact JSON summary instead of Playwright's usual output (docs/07 §4):
 * every failed screen × size with its problems, plus the screenshot path.
 */
import { stripVTControlCharacters } from 'node:util'

import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'

interface Row {
  test: string
  size: string
  ok: boolean
  problems: string[]
  screenshot?: string
}

function lines(message: string): string[] {
  return stripVTControlCharacters(message)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^(Expected|Received|expect\(|[-+] |[-+]$)/.test(line))
    .map((line) => line.replace(/^Error: /, ''))
    .slice(0, 12)
}

export default class SummaryReporter implements Reporter {
  private rows: Row[] = []

  onTestEnd(test: TestCase, result: TestResult): void {
    const shot = result.attachments.find((a) => a.name === 'screenshot' && a.path)
    this.rows.push({
      test: test.titlePath().slice(3).join(' › '),
      size: test.parent.project()?.name ?? '',
      ok: result.status === 'passed' || result.status === 'skipped',
      problems: result.errors.flatMap((e) => lines(e.message ?? String(e.value ?? 'error'))),
      ...(shot?.path ? { screenshot: shot.path } : {}),
    })
  }

  onEnd(result: FullResult): void {
    const failures = this.rows.filter((r) => !r.ok)
    const summary = {
      status: result.status,
      passed: this.rows.length - failures.length,
      failed: failures.length,
      failures,
    }
    process.stdout.write(`${JSON.stringify(summary, null, 1)}\n`)
  }

  printsToStdio(): boolean {
    return true
  }
}
