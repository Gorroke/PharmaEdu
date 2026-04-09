/**
 * /learn/lesson/[slug] — 레슨 뷰어 중첩 레이아웃
 *
 * 상위 /learn/layout.tsx 에서 사이드바를 이미 제공하므로
 * 이 레이아웃은 children을 그대로 전달하기만 한다.
 */
export default function LessonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
