/**
 * modules/insurance/medical-aid.ts
 * 의료급여(D) 본인부담금 계산 모듈 — 확장판
 *
 * 지원 범위:
 *   D10 (1종)     : Mcode 정액 (기존 copayment.ts D10 로직 재사용)
 *   D20 (2종)     : FixCost 정액, 15% 정률 → FixCost 기준 (현행 500원)
 *   D40 (2종 보건): 보건기관 처방전 → 0원
 *   D80 (행려 8종): 전액 면제 (userPrice = 0)
 *   D90 (행려 보건): 전액 면제 (userPrice = 0)
 *   B014          : 30% 정률, 10원 절사 (2019.01.01~)
 *   B030          : 전액 면제 (2022.03.22~)
 *   V103          : 전액 면제 (질병코드 기반)
 *
 * 처리 우선순위:
 *   1. 보건기관 처방전 → 0원 (D40/D90)
 *   2. V103 질병코드 → 0원
 *   3. B030 면제 (2022.03.22~) → 0원
 *   4. hgGrade == "5" → 0원
 *   5. D80/D90 행려 → 0원
 *   6. B014 정률 30% (2019.01.01~) → trunc10(총액1 × 30%)
 *   7. 종별 정액: D10 → Mcode, D20/기타 → FixCost
 *   8. 건강생활유지비 차감 (1종 전용)
 *
 * 참조 문서:
 *   - C#: CopaymentCalculator.cs → CalcCopay_D()
 *   - output/CH05_보험유형별_본인부담금.md §4 (의료급여 본인부담금)
 *   - EDB InsuRateCalc2.cs 라인 3688~3762
 */

import type { CalcOptions, CalcResult, InsuRate, MediIllnessInfo } from '../../types';
import { trunc10, trunc100 } from '../../rounding';
import { isV252Series } from '../special/exemption';

// ─── 수급권자 유형 상수 ───────────────────────────────────────────────────────

/** sbrdnType 식별자 상수 */
export const SbrdnType = {
  B014: 'B014', // 30% 정률 (2019.01.01~)
  B030: 'B030', // 전액 면제 (2022.03.22~)
} as const;

// ─── 보험코드 상수 ────────────────────────────────────────────────────────────

/** 행려·면제 처리 대상 D코드 */
const ZERO_COPAY_CODES = new Set(['D80', 'D90']);

/** 보건기관 처방 관련 D코드 (isHealthCenterPresc와 조합 사용) */
const HEALTH_CENTER_CODES = new Set(['D40', 'D90']);

// ─── 공개 함수 ────────────────────────────────────────────────────────────────

/**
 * 의료급여(D) 본인부담금 계산 메인 함수
 *
 * Integration Lead가 index.ts에서 D계열 분기 시 호출.
 * result.totalPrice는 이미 trunc10 완료 상태여야 한다.
 *
 * @param options CalcOptions — insuCode, dosDate, sbrdnType, mediIllness 등
 * @param result  CalcResult  — totalPrice(확정), sumInsuDrug, sumWage 포함
 * @param rate    InsuRate    — mcode, bcode, fixCost 조회용
 * @param illness MediIllnessInfo | undefined — V252/V103 판정용
 * @returns 업데이트된 CalcResult (userPrice, pubPrice, steps 갱신)
 */
export function calcMedicalAid(
  options: CalcOptions,
  result: CalcResult,
  rate: InsuRate,
  illness?: MediIllnessInfo
): CalcResult {
  const totalPrice = result.totalPrice;
  const steps = [...result.steps];

  const insuCode = options.insuCode.toUpperCase();
  const sbrdnType = options.sbrdnType ?? '';

  // ── Step 1: 보건기관 처방전 면제 ─────────────────────────────────────────
  // D40(2종 보건), D90(행려 보건) — isHealthCenterPresc 또는 보건코드 자체로 판정
  if (options.isHealthCenterPresc || HEALTH_CENTER_CODES.has(insuCode)) {
    steps.push({
      title: '의료급여 본인부담금 (보건기관 처방전 — 전액면제)',
      formula: '보건기관 처방전 → 0원',
      result: 0,
      unit: '원',
    });
    return _buildResult(result, 0, steps);
  }

  // ── Step 2: V103 질병코드 면제 ────────────────────────────────────────────
  const illnessCode = illness?.code ?? options.mediIllness ?? '';
  const illnessBCode = options.mediIllnessB ?? '';
  if (illnessCode === 'V103' || illnessBCode === 'V103') {
    steps.push({
      title: '의료급여 본인부담금 (V103 — 전액면제)',
      formula: 'V103 질병코드 → 0원',
      result: 0,
      unit: '원',
    });
    return _buildResult(result, 0, steps);
  }

  // ── Step 3: B030 면제 (2022.03.22~) ──────────────────────────────────────
  if (sbrdnType === SbrdnType.B030 && options.dosDate >= '20220322') {
    steps.push({
      title: '의료급여 본인부담금 (B030 — 전액면제)',
      formula: `B030 수급권자 (${options.dosDate} ≥ 20220322) → 0원`,
      result: 0,
      unit: '원',
    });
    return _buildResult(result, 0, steps);
  }

  // ── Step 4: 5등급 면제 ────────────────────────────────────────────────────
  if (options.hgGrade === '5') {
    steps.push({
      title: '의료급여 본인부담금 (5등급 — 전액면제)',
      formula: 'hgGrade=5 → 0원',
      result: 0,
      unit: '원',
    });
    return _buildResult(result, 0, steps);
  }

  // ── Step 5: D80(행려 8종) / D90(행려 보건) — 전액면제 ───────────────────
  if (ZERO_COPAY_CODES.has(insuCode)) {
    steps.push({
      title: `의료급여 본인부담금 (${insuCode} 행려 — 전액면제)`,
      formula: `${insuCode} → 0원`,
      result: 0,
      unit: '원',
    });
    return _buildResult(result, 0, steps);
  }

  // ── Step 6: [C-3] 의료급여 V252 경증질환 3% 차등제 ──────────────────────
  // 근거: C# CopaymentCalculator.cs:L599-L620 IsV252ForMediAid / CalcCopay_D
  //       99_FINAL_REPORT §4.5 C-19; ch05_verifier.md §4-2 IsV252ForMediAid
  //
  // 적용 조건:
  //   - illness(MediIllnessInfo) 있음
  //   - V252/V352/V452 시리즈
  //   - D계열 보험코드
  //   - D10 1종: sbrdnType이 'B'또는'M'으로 시작하는 경우만 적용
  //   - D10 1종 기본(sbrdnType=''): 3% 미적용 (C# L721-729)
  //   - D20 2종: 무조건 적용
  //
  // 산식: userPrice = max(trunc10(totalPrice × 3%), 500)
  //       단, userPrice > totalPrice 이면 totalPrice로 cap
  if (_isV252ForMediAid(options, illness)) {
    let userPrice = Math.max(trunc10(totalPrice * 0.03), 500);
    if (userPrice > totalPrice) userPrice = totalPrice;

    steps.push({
      title: '의료급여 V252 경증질환 3% 본인부담금',
      formula: `max(trunc10(${totalPrice} × 3%), 500) = ${userPrice}원`,
      result: userPrice,
      unit: '원',
    });

    // ── [C-4] D타입 M20 이중감면 연동 (V252 경로) ────────────────────────
    // 근거: C# CopaymentCalculator.cs:L606-L617
    const m20Result = _applyDtypeM20(userPrice, options, steps);
    return _buildResultWithMpva(result, m20Result.userPrice, m20Result.mpvaAddition, steps);
  }

  // ── Step 7: B014 정률 30% (2019.01.01~) ──────────────────────────────────
  if (sbrdnType === SbrdnType.B014 && options.dosDate >= '20190101') {
    let userPrice = trunc10(totalPrice * 0.3);
    steps.push({
      title: '의료급여 본인부담금 (B014 — 30% 정률)',
      formula: `trunc10(${totalPrice} × 30%) = ${userPrice}원`,
      result: userPrice,
      unit: '원',
    });

    // ── [C-4] D타입 M20 이중감면 연동 (B014 경로) ────────────────────────
    // 근거: C# CopaymentCalculator.cs:L628-L641
    const m20Result = _applyDtypeM20(userPrice, options, steps);
    return _buildResultWithMpva(result, m20Result.userPrice, m20Result.mpvaAddition, steps);
  }

  // ── Step 8: 종별 정액 적용 ───────────────────────────────────────────────
  const fixAmt = resolveMedicalAidFixAmount(insuCode, rate, options);

  let userPrice: number;
  if (totalPrice <= fixAmt) {
    // 총액이 정액보다 작으면 총액 전체가 본인부담
    userPrice = trunc10(totalPrice);
    steps.push({
      title: `의료급여 본인부담금 (${insuCode} — 총액 < 정액, 전액)`,
      formula: `trunc10(${totalPrice}) (정액=${fixAmt}원보다 소액)`,
      result: userPrice,
      unit: '원',
    });
  } else {
    userPrice = trunc10(fixAmt);
    steps.push({
      title: `의료급여 본인부담금 (${insuCode} — 정액)`,
      formula: `trunc10(${fixAmt}) = ${userPrice}원`,
      result: userPrice,
      unit: '원',
    });
  }

  // ── [C-4] D타입 M20 이중감면 연동 (기본정액 경로) ───────────────────────
  // 근거: C# CopaymentCalculator.cs:L668-L680
  const m20Result = _applyDtypeM20(userPrice, options, steps);
  userPrice = m20Result.userPrice;

  // ── Step 9: 건강생활유지비 차감 (1종 D10 전용) ───────────────────────────
  if (insuCode === 'D10') {
    const eHealth = options.eHealthBalance ?? 0;
    if (eHealth > 0 && userPrice > 0) {
      const before = userPrice;
      userPrice = Math.max(0, userPrice - eHealth);
      steps.push({
        title: '건강생활유지비 차감 (D10 1종)',
        formula: `max(0, ${before} - ${eHealth}) = ${userPrice}원`,
        result: userPrice,
        unit: '원',
      });
    }
  }

  return _buildResultWithMpva(result, userPrice, m20Result.mpvaAddition, steps);
}

/**
 * 보험코드·요율·옵션으로부터 의료급여 정액 기준값 결정
 *
 * sbrdnType 분기 (C# CalcCopay_D 라인 603~618 + EDB Mcode 기본값 보완):
 *   D10 + sbrdnType 없음 또는 'M' 시작 → rate.mcode  (1종 기본/M코드, 현행 1000원)
 *   D10 + 'B' 시작 → rate.bcode  (1종 B코드, 현행 1500원)
 *   그 외 (D20+)   → rate.fixCost (기본, 현행 500원)
 *
 * 주의: D10 기본 수급자(sbrdnType='')는 mcode 적용.
 *       'B'로 시작하는 경우(B014, B030 등)만 bcode 분기.
 *       B014/B030은 Step 6 이전에 이미 처리되므로 여기 도달 시 bcode 사용.
 *
 * @param insuCode 보험코드 (대문자, 예: "D10")
 * @param rate     InsuRate
 * @param options  CalcOptions (sbrdnType 접근용)
 * @returns 정액 기준값 (원)
 */
export function resolveMedicalAidFixAmount(
  insuCode: string,
  rate: InsuRate,
  options: CalcOptions
): number {
  const sbrdnType = options.sbrdnType ?? '';
  const sbFirst = sbrdnType.length > 0 ? sbrdnType[0] : '';

  if (insuCode === 'D10' && sbFirst === 'B') {
    // 1종 B코드 수급권자 → Bcode
    return rate.bcode > 0 ? rate.bcode : 1500;
  }

  if (insuCode === 'D10') {
    // 1종 기본 수급자(sbrdnType 없음) 또는 M코드 수급자 → Mcode
    return rate.mcode > 0 ? rate.mcode : 1000;
  }

  // D20, D40, D80, D90, 기타 → FixCost
  return rate.fixCost > 0 ? rate.fixCost : 500;
}

/**
 * sbrdnType에 따른 본인부담 조정
 *
 * B014: 30% 정률 (2019.01.01~) — baseUserPrice를 그대로 반환 (이미 30% 적용된 값)
 * B030: 면제 (2022.03.22~)     — 0 반환
 * V103: 면제                   — 0 반환
 * 기타: baseUserPrice 그대로 반환
 *
 * 주의: 이 함수는 calcMedicalAid() 내부에서 B014 계산값 검증·재조정용으로
 *       호출하거나, Integration Lead가 외부에서 sbrdnType 후처리 시 사용 가능.
 *
 * @param baseUserPrice 조정 전 본인부담금 (이미 trunc10 적용된 값)
 * @param sbrdnType     수급권자 유형코드
 * @param totalPrice    요양급여비용총액1 (B014 재계산 필요 시 사용)
 * @param dosDate       조제일자 yyyyMMdd (날짜 임계 판정용)
 * @returns 조정 후 본인부담금
 */
export function applySbrdnTypeModifier(
  baseUserPrice: number,
  sbrdnType: string,
  totalPrice: number,
  dosDate: string
): number {
  switch (sbrdnType) {
    case SbrdnType.B014:
      // 2019.01.01 이후: 30% 정률 → trunc10(totalPrice × 30%)
      if (dosDate >= '20190101') {
        return trunc10(totalPrice * 0.3);
      }
      // 날짜 미달 시 정액 로직으로 fallthrough (baseUserPrice 유지)
      return baseUserPrice;

    case SbrdnType.B030:
      // 2022.03.22 이후: 전액면제
      if (dosDate >= '20220322') {
        return 0;
      }
      return baseUserPrice;

    case 'V103':
      // 질병코드 V103: 전액면제
      return 0;

    default:
      return baseUserPrice;
  }
}

// ─── 내부 헬퍼 ────────────────────────────────────────────────────────────────

/**
 * CalcResult에 userPrice, pubPrice, steps를 갱신해 반환
 */
function _buildResult(
  base: CalcResult,
  userPrice: number,
  steps: CalcResult['steps']
): CalcResult {
  const pubPrice = base.totalPrice - userPrice;
  const updatedSteps = [
    ...steps,
    {
      title: '청구액',
      formula: `${base.totalPrice} - ${userPrice}`,
      result: pubPrice,
      unit: '원',
    },
  ];
  return {
    ...base,
    userPrice,
    pubPrice,
    steps: updatedSteps,
  };
}

/**
 * CalcResult에 userPrice, pubPrice, mpvaPrice, steps를 갱신해 반환
 * D타입 M20 이중감면 발생 시 mpvaPrice 필드도 갱신한다.
 *
 * @param base         기존 CalcResult
 * @param userPrice    최종 본인부담금
 * @param mpvaAddition 보훈청 추가 부담분 (D타입 M20 이중감면액)
 * @param steps        누적 계산 단계
 */
function _buildResultWithMpva(
  base: CalcResult,
  userPrice: number,
  mpvaAddition: number,
  steps: CalcResult['steps']
): CalcResult {
  const mpvaPrice = (base.mpvaPrice ?? 0) + mpvaAddition;
  const pubPrice = base.totalPrice - userPrice;
  const insuPrice = base.totalPrice - userPrice - mpvaPrice;
  const updatedSteps = [
    ...steps,
    {
      title: '청구액',
      formula: `${base.totalPrice} - ${userPrice}`,
      result: pubPrice,
      unit: '원',
    },
  ];
  return {
    ...base,
    userPrice,
    pubPrice,
    mpvaPrice: mpvaAddition > 0 ? mpvaPrice : base.mpvaPrice,
    insuPrice: mpvaAddition > 0 ? insuPrice : undefined,
    steps: updatedSteps,
  };
}

/**
 * [C-3] 의료급여 V252 경증질환 3% 적용 여부 판정
 *
 * 근거: C# CopaymentCalculator.cs:L711-L734 IsV252ForMediAid()
 *
 * 조건:
 *   - illness가 있어야 함
 *   - V252/V352/V452 시리즈
 *   - D계열 보험코드
 *   - D10 1종: sbrdnType이 'B' 또는 'M'으로 시작하는 경우에만 적용
 *   - D10 1종 기본(sbrdnType='' 등): 미적용 (C# L728-729)
 *   - D20 2종 이상: 무조건 적용
 */
function _isV252ForMediAid(options: CalcOptions, illness?: MediIllnessInfo): boolean {
  if (!illness) return false;
  if (!isV252Series(illness.code)) return false;

  const insuCode = options.insuCode.toUpperCase();
  const category = insuCode.charAt(0);
  if (category !== 'D') return false;

  // D10 1종: sbrdnType 분기
  // C# L721-733: B/M코드면 3% 적용, 기본(''이거나 기타)이면 미적용
  if (insuCode === 'D10') {
    const sbFirst = (options.sbrdnType ?? '').length > 0
      ? (options.sbrdnType ?? '')[0]
      : '';
    // 'B' 또는 'M'으로 시작하는 수급권자유형이면 3% 적용
    return sbFirst === 'B' || sbFirst === 'M';
  }

  // D20, D40, D80, D90, 기타 D계열 → 무조건 적용
  return true;
}

/**
 * [C-4] D타입 M20 이중감면 처리
 *
 * 근거: C# CopaymentCalculator.cs:L606-L617 (V252 경로)
 *                                   L628-L641 (B014 경로)
 *                                   L668-L680 (기본정액 경로)
 *
 * M20 이중감면 공식 (D타입):
 *   truncUser = 2018이후: trunc10(user × num7/100)
 *               2018이전: trunc100(user × num7/100)
 *   addMpva   = user - truncUser
 *   최종 user  = user - addMpva (= truncUser)
 *
 * num7 = getDoubleReductionRate('M20', dosDate) = 2018이후:10, 2018이전:20
 *
 * 주의: G타입 M20은 veteran.ts에서 이미 처리. 여기서는 D타입(의료급여) M20만 처리.
 *
 * @param baseUserPrice 이중감면 적용 전 본인부담금
 * @param options       CalcOptions (bohunCode, dosDate)
 * @param steps         계산 단계 로그 (push용)
 * @returns { userPrice: 최종 환자부담, mpvaAddition: 보훈청 추가 부담분 }
 */
function _applyDtypeM20(
  baseUserPrice: number,
  options: CalcOptions,
  steps: CalcResult['steps']
): { userPrice: number; mpvaAddition: number } {
  const bohunCode = options.bohunCode ?? '';

  // M20이 아니면 변경 없음
  if (bohunCode !== 'M20') {
    return { userPrice: baseUserPrice, mpvaAddition: 0 };
  }

  const isAfter2018 = options.dosDate >= '20180101';
  // num7: 2018이후=10, 2018이전=20 (C# GetDoubleReductionRate 참조)
  const num7 = isAfter2018 ? 10 : 20;

  // truncUser 절사방식: 2018이후=trunc10, 2018이전=trunc100
  const truncUser = isAfter2018
    ? trunc10(baseUserPrice * num7 / 100)
    : trunc100(baseUserPrice * num7 / 100);

  const addMpva = baseUserPrice - truncUser;
  const finalUser = baseUserPrice - addMpva; // = truncUser

  steps.push({
    title: 'D타입 M20 이중감면',
    formula: `addMpva=${baseUserPrice}-${isAfter2018 ? 'trunc10' : 'trunc100'}(${baseUserPrice}×${num7}/100)=${addMpva}, 최종환자=${finalUser}`,
    result: finalUser,
    unit: '원',
  });

  return { userPrice: finalUser, mpvaAddition: addMpva };
}
