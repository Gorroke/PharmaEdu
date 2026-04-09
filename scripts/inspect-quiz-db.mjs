// 퀴즈/약품 시스템 DB 현황 조사 스크립트
// Usage: node scripts/inspect-quiz-db.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

function section(title) {
  console.log('\n' + '═'.repeat(60));
  console.log('  ' + title);
  console.log('═'.repeat(60));
}

// 후보 테이블 목록 (마이그레이션 파일에서 추출)
const CANDIDATE_TABLES = [
  // 001_create_suga_tables
  'suga_basic',
  'suga_main',
  'suga_aging',
  'insurance_rate',
  'copay_rule',
  // 002_create_quiz_tables
  'quiz_question',
  'quiz_category',
  'quiz_attempt',
  // 003/004_quiz_improvements / categories_expansion
  'wrong_notes',
  'quiz_session',
  // 005_drug_master_and_hints
  'drug_master',
  // 007_quiz_templates
  'quiz_templates',
  // 학습 관련 (추정)
  'learning_chapter',
  'learning_section',
  'lessons',
  'lesson',
  // 일일/계산기 관련 (추정)
  'daily_challenge',
  'calc_history',
];

async function probeTable(name) {
  // limit 1 + count exact — 정확한 카운트 + 존재 확인
  const r = await supabase.from(name).select('*', { count: 'exact' }).limit(1);
  if (r.error) {
    if (r.error.code === '42P01' || r.error.message.includes('Could not find') || r.error.message.includes('does not exist')) {
      return { name, exists: false };
    }
    return { name, exists: '?', error: `[${r.error.code}] ${r.error.message}` };
  }
  return { name, exists: true, count: r.count, sample: r.data[0] };
}

async function main() {
  section('테이블 존재 여부 (후보 ' + CANDIDATE_TABLES.length + '개)');
  const results = await Promise.all(CANDIDATE_TABLES.map(probeTable));
  for (const r of results) {
    const mark = r.exists === true ? '✅' : r.exists === false ? '❌' : '⚠️';
    const tail = r.exists === true ? `(${r.count} rows)` : r.error ?? '';
    console.log(`  ${mark}  ${r.name.padEnd(22)} ${tail}`);
  }

  section('quiz_question 분포');
  const qq = await supabase.from('quiz_question').select('chapter, difficulty, question_type');
  if (!qq.error) {
    const byType = {}, byChapter = {}, byDiff = {};
    qq.data.forEach((r) => {
      byType[r.question_type] = (byType[r.question_type] ?? 0) + 1;
      byChapter[r.chapter] = (byChapter[r.chapter] ?? 0) + 1;
      byDiff[r.difficulty] = (byDiff[r.difficulty] ?? 0) + 1;
    });
    console.log('  type:', byType);
    console.log('  chapter:', byChapter);
    console.log('  difficulty:', byDiff);
  }

  section('quiz_category');
  const qc = await supabase.from('quiz_category').select('*').order('order_idx');
  if (!qc.error) {
    qc.data.forEach((r) => console.log(`  ${r.id} ${r.slug.padEnd(20)} ${r.name} (chapter=${r.chapter})`));
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
