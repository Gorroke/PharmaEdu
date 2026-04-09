import type { QuizQuestion } from '../types';
import type { FC } from 'react';

export interface RendererProps {
  question: QuizQuestion;
  /**
   * 직렬화된 사용자 답변.
   * - multiple_choice / true_false: 선택 인덱스 문자열 ("0"~"3")
   * - numeric: 숫자 문자열
   * - matching: JSON 페어 배열
   * - ordering: CSV 인덱스
   * - fill_blank: JSON 배열
   * - multi_step: JSON 객체
   * - error_spot: 인덱스 문자열
   */
  userAnswer: string;
  isAnswered: boolean;
  isCorrect: boolean | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export type QuestionRenderer = FC<RendererProps>;
