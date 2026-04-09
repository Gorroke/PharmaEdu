/**
 * B-2/B-3/B-4/B-5 — copayment.ts 신기능 단위 테스트
 *
 * 검증 항목:
 *   B-2: 선별급여(A/B/D/E항) 독립 본인부담 계산 (underUser/underInsu)
 *   B-3: U항 100/100 본인부담금 + 요양급여비용총액2
 *   B-4: 공비(PubPrice) 계산 + RealPrice/SumUser/SumInsure 확정
 *   B-5: 특수공비 302/101/102 재배분 (ApplySpecialPub)
 *
 * 근거:
 *   B-2: C# DispensingFeeCalculator.cs:L1836-L1845
 *   B-3: C# CopaymentCalculator.cs:L269-L275; CH07 R13
 *   B-4: C# CopaymentCalculator.cs:L232-L239, L282-L305
 *   B-5: C# CopaymentCalculator.cs:L984-L1062
 */

import type { CalcOptions, InsuRate, SectionTotals } from '../types';
import { calcCopayment } from '../copayment';

// ─── 공통 픽스처 ─────────────────────────────────────────────────────────────

const baseOpt: CalcOptions = {
  dosDate: '20260401',
  insuCode: 'C10',
  age: 40,
  drugList: [],
};

const baseRate: InsuRate = {
  insuCode: 'C10',
  rate: 30,
  sixAgeRate: 70,
  fixCost: 1000,
  mcode: 0,
  bcode: 0,
  age65_12000Less: 20,
};

// ─── [B-2] 선별급여 독립 본인부담 계산 ──────────────────────────────────────

console.log('--- [B-2] 선별급여 독립 본인부담 계산 ---\n');

{
  // A항 10,000원만 있는 경우
  // underUserRaw = RoundToInt(10000 × 0.5) = 5000
  // underUser = trunc10(5000) = 5000
  // underTotal = trunc10(10000) = 10000
  // underInsu = 10000 - 5000 = 5000
  const sectionTotals: SectionTotals = {
    section01: 0, sectionA: 10000, sectionB: 0, sectionD: 0,
    sectionE: 0, sectionU: 0, sectionV: 0, sectionW: 0,
  };
  const result = calcCopayment(0, 0, baseOpt, baseRate, undefined, sectionTotals);

  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.sumInsuDrug50 === 10000, `A항 합계: ${result.sumInsuDrug50} === 10000`);
  t(result.underUser === 5000, `UnderUser(A×50%): ${result.underUser} === 5000`);
  t(result.underInsu === 5000, `UnderInsu: ${result.underInsu} === 5000`);
}

{
  // B항 10,000원
  // underUserRaw = RoundToInt(10000 × 0.8) = 8000
  // underUser = trunc10(8000) = 8000
  const sectionTotals: SectionTotals = {
    section01: 0, sectionA: 0, sectionB: 10000, sectionD: 0,
    sectionE: 0, sectionU: 0, sectionV: 0, sectionW: 0,
  };
  const result = calcCopayment(0, 0, baseOpt, baseRate, undefined, sectionTotals);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.sumInsuDrug80 === 10000, `B항 합계: ${result.sumInsuDrug80} === 10000`);
  t(result.underUser === 8000, `UnderUser(B×80%): ${result.underUser} === 8000`);
}

{
  // D항 10,000원
  // underUserRaw = RoundToInt(10000 × 0.3) = 3000
  const sectionTotals: SectionTotals = {
    section01: 0, sectionA: 0, sectionB: 0, sectionD: 10000,
    sectionE: 0, sectionU: 0, sectionV: 0, sectionW: 0,
  };
  const result = calcCopayment(0, 0, baseOpt, baseRate, undefined, sectionTotals);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.sumInsuDrug30 === 10000, `D항 합계: ${result.sumInsuDrug30} === 10000`);
  t(result.underUser === 3000, `UnderUser(D×30%): ${result.underUser} === 3000`);
}

{
  // E항 10,000원
  // underUserRaw = RoundToInt(10000 × 0.9) = 9000
  const sectionTotals: SectionTotals = {
    section01: 0, sectionA: 0, sectionB: 0, sectionD: 0,
    sectionE: 10000, sectionU: 0, sectionV: 0, sectionW: 0,
  };
  const result = calcCopayment(0, 0, baseOpt, baseRate, undefined, sectionTotals);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.sumInsuDrug90 === 10000, `E항 합계: ${result.sumInsuDrug90} === 10000`);
  t(result.underUser === 9000, `UnderUser(E×90%): ${result.underUser} === 9000`);
}

{
  // A/B/D/E 혼합 (합산 후 1회 trunc10 검증)
  // A=1000, B=1000, D=1000, E=1000
  // underUserRaw = RoundToInt(500) + RoundToInt(800) + RoundToInt(300) + RoundToInt(900)
  //              = 500 + 800 + 300 + 900 = 2500
  // underUser = trunc10(2500) = 2500
  // underTotal = trunc10(4000) = 4000
  // underInsu = 4000 - 2500 = 1500
  const sectionTotals: SectionTotals = {
    section01: 0, sectionA: 1000, sectionB: 1000, sectionD: 1000,
    sectionE: 1000, sectionU: 0, sectionV: 0, sectionW: 0,
  };
  const result = calcCopayment(0, 0, baseOpt, baseRate, undefined, sectionTotals);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.underUser === 2500, `혼합 UnderUser: ${result.underUser} === 2500`);
  t(result.underInsu === 1500, `혼합 UnderInsu: ${result.underInsu} === 1500`);
}

{
  // 선별급여 없는 경우 → underUser 미생성
  const result = calcCopayment(10000, 8660, baseOpt, baseRate, undefined, undefined);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.underUser === undefined, `선별급여 없음: underUser = ${result.underUser} (undefined)`);
}

// ─── [B-3] U항 100/100 본인부담금 + 총액2 ────────────────────────────────────

console.log('\n--- [B-3] U항 100/100 본인부담금 + 요양급여비용총액2 ---\n');

{
  // U항 10,000원
  // totalPrice = trunc10(0 + 0) = 0
  // sumInsuDrug100 = 10000
  // totalPrice100 = trunc10(10000) = 10000
  // userPrice100 = 10000
  // totalPrice2 = trunc10(0 + 10000) = 10000
  const sectionTotals: SectionTotals = {
    section01: 0, sectionA: 0, sectionB: 0, sectionD: 0,
    sectionE: 0, sectionU: 10000, sectionV: 0, sectionW: 0,
  };
  const result = calcCopayment(0, 0, baseOpt, baseRate, undefined, sectionTotals);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.sumInsuDrug100 === 10000, `sumInsuDrug100: ${result.sumInsuDrug100} === 10000`);
  t(result.totalPrice100 === 10000, `totalPrice100: ${result.totalPrice100} === 10000`);
  t(result.userPrice100 === 10000, `userPrice100: ${result.userPrice100} === 10000`);
  t(result.totalPrice2 === 10000, `totalPrice2: ${result.totalPrice2} === 10000`);
}

{
  // 01항 약가 19160 + U항 5000
  // totalPrice = trunc10(10500 + 8660) = 19160  (sumInsuDrug=10500, sumWage=8660)
  // totalPrice100 = trunc10(5000) = 5000
  // totalPrice2 = trunc10(19160 + 5000) = 24160
  const sectionTotals: SectionTotals = {
    section01: 10500, sectionA: 0, sectionB: 0, sectionD: 0,
    sectionE: 0, sectionU: 5000, sectionV: 0, sectionW: 0,
  };
  const result = calcCopayment(10500, 8660, baseOpt, baseRate, undefined, sectionTotals);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.totalPrice === 19160, `totalPrice1: ${result.totalPrice} === 19160`);
  t(result.totalPrice2 === 24160, `totalPrice2(19160+5000): ${result.totalPrice2} === 24160`);
}

{
  // U항 없는 경우 → totalPrice2 미생성
  const result = calcCopayment(10000, 8660, baseOpt, baseRate, undefined, undefined);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.totalPrice2 === undefined, `U항 없음: totalPrice2 = ${result.totalPrice2} (undefined)`);
}

// ─── [B-4] RealPrice / SumUser / SumInsure ────────────────────────────────────

console.log('\n--- [B-4] RealPrice / SumUser / SumInsure ---\n');

{
  // C10, 일반 케이스
  // totalPrice = trunc10(10500 + 8660) = 19160
  // userPrice = trunc100(19160 × 30%) = 5700
  // pubPrice = 0 (희귀/특수공비/원내조제 없음)
  // insuPrice = 19160 - 5700 = 13460
  // realPrice = 5700 - 0 = 5700
  // sumUser = 5700 + 0(underUser) + 0(userPrice100) = 5700
  // sumInsure = 13460
  const result = calcCopayment(10500, 8660, baseOpt, baseRate);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.realPrice === 5700, `realPrice: ${result.realPrice} === 5700`);
  t(result.insuPrice === 13460, `insuPrice: ${result.insuPrice} === 13460`);
  t(result.sumUser === 5700, `sumUser: ${result.sumUser} === 5700`);
  t(result.sumInsure === 13460, `sumInsure: ${result.sumInsure} === 13460`);
}

{
  // 희귀질환(isRare=true) → pubPrice = userPrice
  // realPrice = userPrice - pubPrice = 0
  const opt = { ...baseOpt, isRare: true };
  const result = calcCopayment(10500, 8660, opt, baseRate);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.pubPrice === result.userPrice, `희귀질환 pubPrice=userPrice: ${result.pubPrice}=${result.userPrice}`);
  t(result.realPrice === 0, `희귀질환 realPrice=0: ${result.realPrice}`);
}

{
  // C10 + IndYN=Y (원내조제) → pubPrice = userPrice
  const opt = { ...baseOpt, indYN: 'Y' };
  const result = calcCopayment(10500, 8660, opt, baseRate);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.pubPrice === result.userPrice, `원내조제 pubPrice=userPrice: ${result.pubPrice}=${result.userPrice}`);
}

{
  // UnderUser + UserPrice100 포함 시 SumUser 검증
  // totalPrice = 0, userPrice = 0 (sumInsuDrug=0, sumWage=0)
  // U항 5000 → userPrice100 = 5000
  // A항 10000 → underUser = trunc10(5000) = 5000
  // sumUser = realPrice(0) + underUser(5000) + userPrice100(5000) = 10000
  const sectionTotals: SectionTotals = {
    section01: 0, sectionA: 10000, sectionB: 0, sectionD: 0,
    sectionE: 0, sectionU: 5000, sectionV: 0, sectionW: 0,
  };
  const result = calcCopayment(0, 0, baseOpt, baseRate, undefined, sectionTotals);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.underUser === 5000, `underUser: ${result.underUser} === 5000`);
  t(result.userPrice100 === 5000, `userPrice100: ${result.userPrice100} === 5000`);
  t(result.sumUser === 10000, `sumUser(0+5000+5000): ${result.sumUser} === 10000`);
}

// ─── [B-5] 특수공비 302/101/102 재배분 ───────────────────────────────────────

console.log('\n--- [B-5] 특수공비 302/101/102 재배분 ---\n');

{
  // C타입 specialPub=302, NPayExpYN='N'
  // sumInsuDrug100 = 5000 (U항)
  // sumUser(B-4 기준) = realPrice + underUser + userPrice100
  //   = 0 + 0 + 5000 = 5000
  // → Pub100Price = specialPub302Amount(5000)
  // → sumUser = 5000 - 5000 = 0
  const sectionTotals: SectionTotals = {
    section01: 0, sectionA: 0, sectionB: 0, sectionD: 0,
    sectionE: 0, sectionU: 5000, sectionV: 0, sectionW: 0,
  };
  const opt = { ...baseOpt, specialPub: '302', nPayExpYN: 'N' };
  const result = calcCopayment(0, 0, opt, baseRate, undefined, sectionTotals);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.pub100Price === 5000, `302 Pub100Price: ${result.pub100Price} === 5000`);
  t(result.sumUser === 0, `302 SumUser=0: ${result.sumUser} === 0`);
}

{
  // C타입 specialPub=302, NPayExpYN='' → useNPayExpandedPublic=false
  // 동일 결과: Pub100Price=sumInsuDrug100, SumUser-=sumInsuDrug100
  const sectionTotals: SectionTotals = {
    section01: 0, sectionA: 0, sectionB: 0, sectionD: 0,
    sectionE: 0, sectionU: 5000, sectionV: 0, sectionW: 0,
  };
  const opt = { ...baseOpt, specialPub: '302', nPayExpYN: '' };
  const result = calcCopayment(0, 0, opt, baseRate, undefined, sectionTotals);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.pub100Price === 5000, `302(NPayN='') Pub100Price: ${result.pub100Price} === 5000`);
}

{
  // C타입 specialPub=101
  // → Pub100Price = SumInsuDrug100 = 5000, SumUser -= 5000
  const sectionTotals: SectionTotals = {
    section01: 0, sectionA: 0, sectionB: 0, sectionD: 0,
    sectionE: 0, sectionU: 5000, sectionV: 0, sectionW: 0,
  };
  const opt = { ...baseOpt, specialPub: '101' };
  const result = calcCopayment(0, 0, opt, baseRate, undefined, sectionTotals);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.pub100Price === 5000, `101 Pub100Price: ${result.pub100Price} === 5000`);
  t(result.sumUser === 0, `101 SumUser: ${result.sumUser} === 0`);
}

{
  // C타입 specialPub=102 → 미처리 (pass)
  const sectionTotals: SectionTotals = {
    section01: 0, sectionA: 0, sectionB: 0, sectionD: 0,
    sectionE: 0, sectionU: 5000, sectionV: 0, sectionW: 0,
  };
  const opt = { ...baseOpt, specialPub: '102' };
  const result = calcCopayment(0, 0, opt, baseRate, undefined, sectionTotals);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.pub100Price === undefined, `102 미처리: pub100Price = ${result.pub100Price} (undefined)`);
}

{
  // specialPub='N' → 미처리
  const opt = { ...baseOpt, specialPub: 'N' };
  const result = calcCopayment(0, 0, opt, baseRate);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result.pub100Price === undefined, `specialPub='N': pub100Price = ${result.pub100Price} (undefined)`);
}

{
  // G타입 specialPub=302 → Pub100Price=SumUser, SumUser=0
  const sectionTotals: SectionTotals = {
    section01: 0, sectionA: 0, sectionB: 0, sectionD: 0,
    sectionE: 0, sectionU: 5000, sectionV: 0, sectionW: 0,
  };
  const opt = { ...baseOpt, insuCode: 'G10', specialPub: '302' };
  // G타입은 calcVeteran으로 분기 → ApplySpecialPub은 copayment.ts C계열 전용
  // G타입 분기에서는 _applySpecialPub이 호출되지 않음 (모듈 위임)
  // 단, G타입 302는 calcVeteran 내부에서 처리되어야 하므로 현재 미구현
  // 여기서는 타입오류 없이 처리됨을 확인
  const result = calcCopayment(0, 0, opt, baseRate, undefined, sectionTotals);
  const t = (cond: boolean, msg: string) => console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  t(result !== undefined, `G타입 specialPub=302: 에러 없이 반환됨`);
}

console.log('\n[B-2/B-3/B-4/B-5 테스트 완료]');
