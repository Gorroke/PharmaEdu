import type { QuestionType } from '../types';
import type { QuestionRenderer } from './types';
import { MultipleChoiceRenderer } from './MultipleChoiceRenderer';
import { NumericRenderer } from './NumericRenderer';
import { MatchingRenderer } from './MatchingRenderer';
import { OrderingRenderer } from './OrderingRenderer';
import { FillBlankRenderer } from './FillBlankRenderer';
import { ErrorSpotRenderer } from './ErrorSpotRenderer';
import { MultiStepRenderer } from './MultiStepRenderer';

/**
 * 질문 타입 → 렌더러 맵.
 * 등록: multiple_choice, true_false, numeric, matching, ordering, fill_blank,
 *       error_spot, multi_step.
 *
 * Partial 사용 — 미등록 키 접근 시 undefined 반환되므로 호출자에서 fallback 처리 필요.
 */
export const QUESTION_RENDERERS: Partial<Record<QuestionType, QuestionRenderer>> = {
  multiple_choice: MultipleChoiceRenderer,
  true_false: MultipleChoiceRenderer,
  numeric: NumericRenderer,
  matching: MatchingRenderer,
  ordering: OrderingRenderer,
  fill_blank: FillBlankRenderer,
  error_spot: ErrorSpotRenderer,
  multi_step: MultiStepRenderer,
};

export type { QuestionRenderer, RendererProps } from './types';
