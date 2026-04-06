/**
 * /learn/lesson/[slug] — 레슨 뷰어 레이아웃
 *
 * 기존 /learn 레이아웃(사이드바)을 상속하지 않고 독립 레이아웃을 사용한다.
 * 레슨 뷰어는 최대 너비 제한 + 좌우 패딩만 적용한다.
 */
export default function LessonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-page">
      <main className="max-w-5xl mx-auto px-4 py-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
