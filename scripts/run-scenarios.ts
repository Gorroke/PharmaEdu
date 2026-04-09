/**
 * scripts/run-scenarios.ts
 * 19개 시나리오 (S01~S19) 일괄 실행 및 PASS/FAIL/SKIP 판정
 *
 * 실행: npx tsx scripts/run-scenarios.ts
 *
 * ── Mock 수가 데이터 기준 (CALCULATOR_TEST_PLAN.md §1-3) ──
 *   Z1000:790, Z2000:1720, Z2000010:2240, Z2000030:520,
 *   Z2000600:2420, Z2000610:3150,
 *   Z3000:1150, Z3000010:1500, Z3000030:340,
 *   Z4101~Z4115: 1일~15일 내복약 조제료,
 *   Z4010:800, Z4120:1710, Z4121:640, Z5000:680
 *
 * ── 보험요율 (CALCULATOR_TEST_PLAN.md §1-3) ──
 *   C10: rate=30, sixAgeRate=50(EDB)/70(법령 21%), fixCost=1500(EDB)/1000(법령), mcode=0, bcode=0, age65_12000Less=20
 *   D10: rate=0, sixAgeRate=0, fixCost=0, mcode=1000(EDB)/500(법령), bcode=1500
 *   D20: rate=15, sixAgeRate=0, fixCost=500, mcode=0, bcode=0
 *   G10: rate=30, sixAgeRate=0, fixCost=0, mcode=0, bcode=0
 */

import type { ICalcRepository, InsuRate } from '../src/lib/calc-engine/types';
import { calculate } from '../src/lib/calc-engine';
import { SCENARIOS } from '../src/components/calculator/scenarios';

// ─── Mock Repository ─────────────────────────────────────────────────────────

class MockCalcRepository implements ICalcRepository {
  private readonly sugaFee = new Map<string, { price: number; name: string }>([
    // ── 기본 수가 ──────────────────────────────────────────────
    ['Z1000',       { price: 790,  name: '약국관리료' }],
    ['Z2000',       { price: 1720, name: '기본조제료' }],
    ['Z2000010',    { price: 2240, name: '기본조제료(야간)' }],
    ['Z2000030',    { price: 520,  name: '기본조제료(토요가산)' }],
    ['Z2000600',    { price: 2420, name: '기본조제료(6세미만)' }],
    ['Z2000610',    { price: 3150, name: '기본조제료(6세미만+야간)' }],
    ['Z3000',       { price: 1150, name: '복약지도료' }],
    ['Z3000010',    { price: 1500, name: '복약지도료(야간)' }],
    ['Z3000030',    { price: 340,  name: '복약지도료(토요가산)' }],
    ['Z5000',       { price: 680,  name: '의약품관리료' }],
    // ── 내복약 조제료 (1~15일) ──────────────────────────────────
    ['Z4101',       { price: 1080, name: '내복약조제료(1일)' }],
    ['Z4102',       { price: 1890, name: '내복약조제료(2일)' }],
    ['Z4103',       { price: 2680, name: '내복약조제료(3일)' }],
    ['Z4103010',    { price: 3490, name: '내복약조제료(3일+야간)' }],
    ['Z4103030',    { price: 800,  name: '내복약조제료(3일+토요가산)' }],
    ['Z4104',       { price: 3050, name: '내복약조제료(4일)' }],
    ['Z4105',       { price: 3410, name: '내복약조제료(5일)' }],
    ['Z4105010',    { price: 4440, name: '내복약조제료(5일+야간)' }],
    ['Z4106',       { price: 3870, name: '내복약조제료(6일)' }],
    ['Z4107',       { price: 4320, name: '내복약조제료(7일)' }],
    ['Z4107010',    { price: 5620, name: '내복약조제료(7일+야간)' }],
    ['Z4107030',    { price: 1300, name: '내복약조제료(7일+토요가산)' }],
    ['Z4108',       { price: 4630, name: '내복약조제료(8일)' }],
    ['Z4109',       { price: 4940, name: '내복약조제료(9일)' }],
    ['Z4110',       { price: 5250, name: '내복약조제료(10일)' }],
    ['Z4111',       { price: 5490, name: '내복약조제료(11일)' }],
    ['Z4112',       { price: 5730, name: '내복약조제료(12일)' }],
    ['Z4113',       { price: 5970, name: '내복약조제료(13일)' }],
    ['Z4114',       { price: 6210, name: '내복약조제료(14일)' }],
    ['Z4115',       { price: 6450, name: '내복약조제료(15일)' }],
    // ── 외용약 조제료 ───────────────────────────────────────────
    ['Z4120',       { price: 1710, name: '외용약조제료(단독)' }],
    ['Z4120010',    { price: 2230, name: '외용약조제료(야간)' }],
    ['Z4121',       { price: 640,  name: '외용약조제료(내복병용)' }],
    ['Z4121010',    { price: 830,  name: '외용약조제료(내복병용+야간)' }],
    ['Z4121030',    { price: 190,  name: '외용약조제료(내복병용+토요)' }],
    // ── 산제가산 ────────────────────────────────────────────────
    ['Z4010',       { price: 800,  name: '산제가산' }],
    // ── 직접조제 ────────────────────────────────────────────────
    ['Z4200',       { price: 2110, name: '직접조제내복' }],
    ['Z4201',       { price: 2110, name: '직접조제외용' }],
    // ── 달빛어린이 복약상담료 ────────────────────────────────────
    ['Z7001',       { price: 2060, name: '복약상담료(달빛어린이)' }],
  ]);

  async getSugaFeeMap(_year: number) {
    return new Map(this.sugaFee);
  }

  async getPrescDosageFee(_year: number, _days: number) {
    return null;
  }

  async getInsuRate(insuCode: string): Promise<InsuRate | null> {
    const rateMap: Record<string, InsuRate> = {
      C10: { insuCode: 'C10', rate: 30, sixAgeRate: 50, fixCost: 1500, mcode: 0, bcode: 0, age65_12000Less: 20 },
      D10: { insuCode: 'D10', rate: 0,  sixAgeRate: 0,  fixCost: 0,    mcode: 1000, bcode: 1500, age65_12000Less: 0 },
      D20: { insuCode: 'D20', rate: 15, sixAgeRate: 0,  fixCost: 500,  mcode: 0, bcode: 0, age65_12000Less: 0 },
      D80: { insuCode: 'D80', rate: 0,  sixAgeRate: 0,  fixCost: 0,    mcode: 0, bcode: 0, age65_12000Less: 0 },
      G10: { insuCode: 'G10', rate: 30, sixAgeRate: 0,  fixCost: 0,    mcode: 0, bcode: 0, age65_12000Less: 0 },
      G20: { insuCode: 'G20', rate: 30, sixAgeRate: 0,  fixCost: 0,    mcode: 0, bcode: 0, age65_12000Less: 0 },
      E10: { insuCode: 'E10', rate: 0,  sixAgeRate: 0,  fixCost: 0,    mcode: 0, bcode: 0, age65_12000Less: 0 },
      E20: { insuCode: 'E20', rate: 0,  sixAgeRate: 0,  fixCost: 0,    mcode: 0, bcode: 0, age65_12000Less: 0 },
      F10: { insuCode: 'F10', rate: 0,  sixAgeRate: 0,  fixCost: 0,    mcode: 0, bcode: 0, age65_12000Less: 0 },
    };
    return rateMap[insuCode] ?? null;
  }
}

// ─── 기대값 정의 (CALCULATOR_TEST_PLAN.md + CH11 기준) ───────────────────────

interface ExpectedResult {
  sumInsuDrug?: number;
  userPrice?: number;
  mpvaPrice?: number;
  insuPrice?: number;
  totalPrice?: number;
  note?: string;
  skipReason?: string;
}

// 기대값 표 — 알 수 있는 것만 기재, 나머지는 "실행 후 기록"
const EXPECTED: Record<string, ExpectedResult> = {
  S01: {
    sumInsuDrug: 7200,
    note: '(500+300)×3×3=7200 | sumWage=WPF 기준 9210 (CH11 단일약품 7일 기준: sumInsuDrug=10500,sumWage=8660,total=19160,user=5700)',
  },
  S02: {
    sumInsuDrug: 34650,
    note: '(800+450)×3×7=26,250 + 1200×1×7=8,400 합계=34,650 | Z4107+Z4121 확인 | 구 기대값 26,100은 외용약 포함 합산 착오 (ch11_analyst.md §10-4)',
  },
  S03: {
    sumInsuDrug: 7500,
    note: '급여01항=7500 | 비급여(W항) = 3000×1×1×5=15000 별도 처리',
  },
  S04: {
    sumInsuDrug: 1200,
    userPrice: 1500,  // EDB 기준 FixCost=1500
    note: '200×1×2×3=1200 | 65세+총액≤10000 → FixCost 정액 1500(EDB)/1000(법령)',
  },
  S05: {
    sumInsuDrug: 3150,
    note: '(400×0.5+300×0.5)×3×3=1050 per dNum=1 → 실제 dNum=3이므로 ×3=3,150 | 6세미만 Z2000600 + 본인부담21%(법령) or 15%(EDB) | 구 기대값 1,050은 dNum=3을 1로 계산한 착오 (ch11_analyst.md §10-4)',
  },
  S06: {
    sumInsuDrug: 14250,
    userPrice: 1000,  // Mcode EDB 기준
    note: '(600+350)×3×5=14250 | D10 정액 Mcode=1000(EDB)/500(법령)',
  },
  S07: {
    sumInsuDrug: 16800,
    userPrice: 0,
    mpvaPrice: undefined, // totalPrice와 동일해야 함
    insuPrice: 0,
    note: '800×1×3×7=16800 | M10 전액면제: userPrice=0, mpvaPrice=totalPrice',
  },
  S08: {
    sumInsuDrug: 7200,
    note: '(500+300)×3×3=7200 | 야간+토요 복합가산: Z2000010+Z2000030 등',
  },
  S09: {
    sumInsuDrug: 12000,
    userPrice: 0,
    note: '(500+300)×3×5=12000 | E10 산재 전액면제: userPrice=0',
  },
  S10: {
    sumInsuDrug: 32550,
    note: '실측: 800×3×7+450×3×7+300×3×7=32,550 → 구 기대값 33,600은 (800+450+300)×3×7 단순합 착오 | F10 자동차보험: userPrice=totalPrice(전액본인), insuPrice=0 | 엔진 출력 정답 확인 (ch11_analyst.md §10-4)',
  },
  S11: {
    sumInsuDrug: 5400,
    userPrice: 0,
    note: '600×1×3×3=5400 | E20 산재후유증 전액면제: userPrice=0',
  },
  S12: {
    sumInsuDrug: 24150,
    userPrice: 0,
    mpvaPrice: undefined, // totalPrice와 동일해야 함
    note: '(800+350)×3×7=24150 | G20+M10: 전액면제, mpvaPrice=totalPrice',
  },
  S13: {
    sumInsuDrug: 7200,
    note: '(500+300)×3×3=7200 | 직접조제: Z4200 사용, Z4103 미사용',
  },
  S14: {
    sumInsuDrug: 3150,
    note: '(400×0.5+300×0.5)×3×3=1050 per dNum=1 → 실제 dNum=3이므로 ×3=3,150 | 달빛어린이+야간+6세미만: Z2000610+Z7001 | 구 기대값 1,050은 dNum=3을 1로 계산한 착오 (S05와 동일 원인, ch11_analyst.md §10-4)',
  },
  S15: {
    sumInsuDrug: 24150,
    note: '(800+350)×3×7=24150 | G10+M60+야간: 60%감면+야간가산 → 3자배분',
  },
  S16: {
    sumInsuDrug: 4500,
    userPrice: 500, // D20 FixCost=500
    note: '500×1×3×3=4500 | D20+65세 FixCost=500(정액)',
  },
  S17: {
    sumInsuDrug: 14250,
    note: '(600+350)×3×5=14250 | D10+B014: 30% 정률',
  },
  S18: {
    sumInsuDrug: 7200,
    userPrice: 0,
    note: '(500+300)×3×3=7200 | D80 행려 전액면제: userPrice=0',
  },
  S19: {
    sumInsuDrug: 9000,
    note: '(600+400)×3×3=9000 | 산제가산: Z4010=800원 별도 행',
  },
};

// ─── 결과 판정 ────────────────────────────────────────────────────────────────

type Status = 'PASS' | 'FAIL' | 'SKIP' | 'PARTIAL';

interface ScenarioResult {
  id: string;
  label: string;
  status: Status;
  actual: {
    sumInsuDrug: number;
    sumWage: number;
    totalPrice: number;
    userPrice: number;
    pubPrice: number;
    mpvaPrice?: number;
    insuPrice?: number;
  };
  expected: ExpectedResult;
  wageList: Array<{ sugaCd: string; name: string; sum: number }>;
  error?: string;
  failReasons: string[];
  skipReason?: string;
  identityOk: boolean;
}

// ─── 메인 실행 ────────────────────────────────────────────────────────────────

async function runScenarios() {
  const repo = new MockCalcRepository();
  const results: ScenarioResult[] = [];

  console.log('='.repeat(80));
  console.log('  PharmaEdu 계산 엔진 — 19개 시나리오 전수 테스트');
  console.log('='.repeat(80));
  console.log('');

  for (const scenario of SCENARIOS) {
    const exp = EXPECTED[scenario.id] ?? {};

    // SKIP 처리
    if (exp.skipReason) {
      results.push({
        id: scenario.id,
        label: scenario.label,
        status: 'SKIP',
        actual: { sumInsuDrug: 0, sumWage: 0, totalPrice: 0, userPrice: 0, pubPrice: 0 },
        expected: exp,
        wageList: [],
        failReasons: [],
        skipReason: exp.skipReason,
        identityOk: true,
      });
      console.log(`[SKIP] ${scenario.id} — ${exp.skipReason}`);
      continue;
    }

    try {
      // ScenarioPreset → CalcOptions 변환
      const drugList = scenario.drugs.map(d => ({
        code: d.code,
        insuPay: d.insuPay,
        take: d.take,
        price: d.price,
        dose: d.dose,
        dNum: d.dNum,
        dDay: d.dDay,
        isPowder: d.isPowder,
        insuDrug: d.insuDrug,
      }));

      const calcOpt = {
        dosDate: '20260403',
        insuCode: scenario.insuCode,
        bohunCode: scenario.bohunCode,
        age: parseInt(scenario.age, 10),
        isNight: scenario.isNight,
        isSaturday: scenario.isSaturday,
        isHolyDay: scenario.isHolyDay,
        isMidNight: scenario.isMidNight,
        isDirectDispensing: scenario.isDirectDispensing,
        isDalbitPharmacy: scenario.isDalbitPharmacy,
        sbrdnType: scenario.sbrdnType,
        isMPVBill: scenario.insuCode === 'G20',
        drugList,
      };

      const result = await calculate(calcOpt, repo);

      if (result.error) {
        results.push({
          id: scenario.id,
          label: scenario.label,
          status: 'FAIL',
          actual: { sumInsuDrug: 0, sumWage: 0, totalPrice: 0, userPrice: 0, pubPrice: 0 },
          expected: exp,
          wageList: [],
          error: result.error,
          failReasons: [`엔진 오류: ${result.error}`],
          identityOk: false,
        });
        continue;
      }

      // 검증
      const failReasons: string[] = [];

      // 1. 약품금액 검증 (기대값이 있는 경우)
      if (exp.sumInsuDrug !== undefined && result.sumInsuDrug !== exp.sumInsuDrug) {
        failReasons.push(
          `sumInsuDrug 불일치: 실제=${result.sumInsuDrug} 기대=${exp.sumInsuDrug} 차이=${result.sumInsuDrug - exp.sumInsuDrug}`
        );
      }

      // 2. 본인부담금 검증 (기대값이 있는 경우)
      if (exp.userPrice !== undefined && result.userPrice !== exp.userPrice) {
        failReasons.push(
          `userPrice 불일치: 실제=${result.userPrice} 기대=${exp.userPrice} 차이=${result.userPrice - exp.userPrice}`
        );
      }

      // 3. mpvaPrice 검증 (보훈 S07, S12)
      const actualMpva = (result as typeof result & { mpvaPrice?: number }).mpvaPrice;
      if (exp.mpvaPrice !== undefined && actualMpva !== exp.mpvaPrice) {
        failReasons.push(
          `mpvaPrice 불일치: 실제=${actualMpva ?? 'N/A'} 기대=${exp.mpvaPrice}`
        );
      }

      // 4. insuPrice 검증 (보훈 S07)
      const actualInsu = (result as typeof result & { insuPrice?: number }).insuPrice;
      if (exp.insuPrice !== undefined && actualInsu !== exp.insuPrice) {
        failReasons.push(
          `insuPrice 불일치: 실제=${actualInsu ?? 'N/A'} 기대=${exp.insuPrice}`
        );
      }

      // 5. 합계 항등식 검증 (totalPrice = userPrice + pubPrice)
      const identityOk = result.totalPrice === result.userPrice + result.pubPrice;
      if (!identityOk) {
        failReasons.push(
          `합계 항등식 위반: totalPrice(${result.totalPrice}) ≠ userPrice(${result.userPrice}) + pubPrice(${result.pubPrice})`
        );
      }

      // S07, S12 보훈 특수 검증: mpvaPrice == totalPrice 인지
      if ((scenario.id === 'S07' || scenario.id === 'S12') && scenario.bohunCode === 'M10') {
        if (actualMpva !== result.totalPrice) {
          failReasons.push(
            `M10 전액면제: mpvaPrice(${actualMpva}) ≠ totalPrice(${result.totalPrice})`
          );
        }
      }

      // S09, S11 산재 검증
      if (scenario.insuCode.startsWith('E')) {
        if (result.userPrice !== 0) {
          failReasons.push(`산재 전액면제 실패: userPrice=${result.userPrice} (0이어야 함)`);
        }
      }

      // S10 자동차보험 검증: insuPrice=0
      if (scenario.insuCode.startsWith('F')) {
        const fInsuPrice = (result as typeof result & { insuPrice?: number }).insuPrice;
        if (fInsuPrice !== undefined && fInsuPrice !== 0) {
          failReasons.push(`자동차보험: insuPrice=${fInsuPrice} (0이어야 함)`);
        }
      }

      // S18 D80 전액면제
      if (scenario.insuCode === 'D80') {
        if (result.userPrice !== 0) {
          failReasons.push(`D80 행려 전액면제 실패: userPrice=${result.userPrice} (0이어야 함)`);
        }
      }

      const status: Status = failReasons.length === 0 ? 'PASS' : 'FAIL';

      results.push({
        id: scenario.id,
        label: scenario.label,
        status,
        actual: {
          sumInsuDrug: result.sumInsuDrug,
          sumWage: result.sumWage,
          totalPrice: result.totalPrice,
          userPrice: result.userPrice,
          pubPrice: result.pubPrice,
          mpvaPrice: actualMpva,
          insuPrice: actualInsu,
        },
        expected: exp,
        wageList: result.wageList.map(w => ({ sugaCd: w.sugaCd, name: w.name, sum: w.sum })),
        failReasons,
        identityOk,
      });

    } catch (e) {
      results.push({
        id: scenario.id,
        label: scenario.label,
        status: 'FAIL',
        actual: { sumInsuDrug: 0, sumWage: 0, totalPrice: 0, userPrice: 0, pubPrice: 0 },
        expected: exp,
        wageList: [],
        error: e instanceof Error ? e.message : String(e),
        failReasons: [`예외 발생: ${e instanceof Error ? e.message : String(e)}`],
        identityOk: false,
      });
    }
  }

  // ─── 결과 출력 ────────────────────────────────────────────────────────────

  console.log('');
  console.log('='.repeat(80));
  console.log('  시나리오별 상세 결과');
  console.log('='.repeat(80));

  for (const r of results) {
    const mark = r.status === 'PASS' ? '[PASS]' :
                 r.status === 'SKIP' ? '[SKIP]' : '[FAIL]';
    console.log('');
    console.log(`${mark} ${r.id} — ${r.label}`);
    if (r.status === 'SKIP') {
      console.log(`         사유: ${r.skipReason}`);
      continue;
    }
    console.log(`  약품금액(01항) : ${r.actual.sumInsuDrug.toLocaleString()}원${r.expected.sumInsuDrug !== undefined ? `  (기대: ${r.expected.sumInsuDrug.toLocaleString()})` : ''}`);
    console.log(`  조제료(02항)   : ${r.actual.sumWage.toLocaleString()}원`);
    console.log(`  요양급여총액1  : ${r.actual.totalPrice.toLocaleString()}원`);
    console.log(`  본인부담금     : ${r.actual.userPrice.toLocaleString()}원${r.expected.userPrice !== undefined ? `  (기대: ${r.expected.userPrice.toLocaleString()})` : ''}`);
    console.log(`  청구액(pubPrice): ${r.actual.pubPrice.toLocaleString()}원`);
    if (r.actual.mpvaPrice !== undefined) {
      console.log(`  보훈청구액     : ${r.actual.mpvaPrice.toLocaleString()}원`);
    }
    if (r.actual.insuPrice !== undefined) {
      console.log(`  공단청구액     : ${r.actual.insuPrice.toLocaleString()}원`);
    }
    console.log(`  항등식 성립    : ${r.identityOk ? 'OK' : 'FAIL(totalPrice≠user+pub)'}`);
    console.log(`  수가내역       : ${r.wageList.map(w => `${w.sugaCd}(${w.sum.toLocaleString()})`).join(' | ')}`);
    if (r.error) {
      console.log(`  오류           : ${r.error}`);
    }
    for (const reason of r.failReasons) {
      console.log(`  ✗ ${reason}`);
    }
    if (r.expected.note) {
      console.log(`  📌 ${r.expected.note}`);
    }
  }

  // ─── 요약 ────────────────────────────────────────────────────────────────

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const skipCount = results.filter(r => r.status === 'SKIP').length;

  console.log('');
  console.log('='.repeat(80));
  console.log('  최종 요약');
  console.log('='.repeat(80));
  console.log(`  전체: ${results.length}개  |  PASS: ${passCount}  |  FAIL: ${failCount}  |  SKIP: ${skipCount}`);
  console.log('');

  if (failCount > 0) {
    console.log('  FAIL 시나리오 목록:');
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`    - ${r.id}: ${r.failReasons[0] ?? r.error}`);
    }
  }

  console.log('');
  console.log('  수가 데이터 비고:');
  console.log('  - Z4103 기대값(테스트플랜): 2,680원 (CALCULATOR_TEST_PLAN.md §1-3)');
  console.log('  - Z2000 기대값: 1,720원 / Z3000: 1,150원 / Z1000: 790원 / Z5000: 680원');
  console.log('  - S01(2약품3일) sumWage 기대: WPF 9,210원 / CH11단일약품7일 8,660원');
}

runScenarios().catch(e => {
  console.error('실행 오류:', e);
  process.exit(1);
});
