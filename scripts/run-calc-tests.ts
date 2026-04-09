/**
 * scripts/run-calc-tests.ts
 * calc-engine 단위 테스트 러너
 *
 * 실행: npx tsx scripts/run-calc-tests.ts
 * 또는: npm run test:calc
 *
 * src/lib/calc-engine/__tests__/ 폴더의 *.test.ts 파일을 순서대로 실행한다.
 * 하나라도 실패하면 non-zero 코드로 종료.
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// ─── 테스트 파일 목록 (실행 순서 고정) ────────────────────────────────────────

const TEST_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '../src/lib/calc-engine/__tests__'
);

const TEST_FILES = [
  'rounding.test.ts',
  'modules-veteran.test.ts',
  'modules-medical-aid.test.ts',
  'modules-auto.test.ts',
  'modules-workers-comp.test.ts',
  'modules-powder.test.ts',
  'modules-seasonal.test.ts',
  'modules-saturday.test.ts',
  'modules-drug648.test.ts',
  'modules-safety-net.test.ts',
  'modules-exemption.test.ts',
  'modules-copayment-b2b5.test.ts',
];

// ─── 실행 ─────────────────────────────────────────────────────────────────────

console.log('='.repeat(60));
console.log('  PharmaEdu Calc-Engine Unit Tests');
console.log('='.repeat(60));
console.log('');

let passed = 0;
let failed = 0;
const failedFiles: string[] = [];

for (const file of TEST_FILES) {
  const filePath = path.join(TEST_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`[SKIP] ${file} — 파일 없음`);
    continue;
  }

  console.log(`▶ ${file}`);
  try {
    execSync(`npx tsx "${filePath}"`, {
      stdio: 'inherit',
      cwd: path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..'),
    });
    passed++;
  } catch {
    failed++;
    failedFiles.push(file);
  }
}

// ─── 최종 결과 ───────────────────────────────────────────────────────────────

console.log('='.repeat(60));
console.log(`  결과: ${passed}개 PASS / ${failed}개 FAIL`);
if (failedFiles.length > 0) {
  console.error('  실패한 파일:');
  for (const f of failedFiles) {
    console.error(`    ✗ ${f}`);
  }
}
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n[전체 PASS] 모든 calc-engine 단위 테스트 통과!\n');
}
