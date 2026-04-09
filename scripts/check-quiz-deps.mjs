// quiz_question / quiz_category 의 DB 의존성 확인
// FK, view, trigger, sequence 등 CASCADE 영향 범위 점검
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => {
    const idx = l.indexOf('=');
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// PostgREST는 raw SQL 못 돌리므로, 정보 스키마 뷰 직접 조회 — 안 되면 RPC 필요
// 대신 information_schema를 통해 안 되면 그냥 메시지

async function main() {
  // 1) quiz_question / quiz_category 컬럼 (현 상태 보존용)
  console.log('═'.repeat(60));
  console.log('  현재 quiz_question 컬럼 (기존 코드 호환 보장용)');
  console.log('═'.repeat(60));
  const qq = await supabase.from('quiz_question').select('*').limit(1);
  if (qq.data?.[0]) {
    console.log('컬럼:', Object.keys(qq.data[0]));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  현재 quiz_category 컬럼');
  console.log('═'.repeat(60));
  const qc = await supabase.from('quiz_category').select('*').limit(1);
  if (qc.data?.[0]) {
    console.log('컬럼:', Object.keys(qc.data[0]));
  }

  // 2) information_schema 로 FK 의존 확인 시도
  console.log('\n' + '═'.repeat(60));
  console.log('  외래키 의존성 (information_schema 직접 조회 시도)');
  console.log('═'.repeat(60));

  // PostgREST는 information_schema를 expose 하지 않을 수도 있음 → 그냥 시도
  const fkProbe = await supabase
    .from('quiz_question')  // dummy
    .select('id')
    .limit(0);
  console.log('  (information_schema는 PostgREST 노출 안 됨 — SQL Editor로 별도 확인 필요)');
  console.log('  다음 쿼리를 SQL Editor에서 돌려야 함:');
  console.log('');
  console.log('  SELECT tc.table_name AS dependent_table, kcu.column_name AS fk_column,');
  console.log('         ccu.table_name AS referenced_table');
  console.log('  FROM information_schema.table_constraints tc');
  console.log('  JOIN information_schema.key_column_usage kcu');
  console.log('    ON tc.constraint_name = kcu.constraint_name');
  console.log('  JOIN information_schema.constraint_column_usage ccu');
  console.log('    ON ccu.constraint_name = tc.constraint_name');
  console.log('  WHERE tc.constraint_type = \'FOREIGN KEY\'');
  console.log('    AND ccu.table_name IN (\'quiz_question\', \'quiz_category\');');
}

main().catch((e) => { console.error(e); process.exit(1); });
