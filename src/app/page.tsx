import { createServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createServerSupabase();

  // 각 테이블의 행 수 조회
  const [sugaRes, feeRes, insuRes, holidayRes, dosageRes] = await Promise.all([
    supabase.from("suga_fee").select("*", { count: "exact", head: true }),
    supabase.from("fee_base_params").select("*", { count: "exact", head: true }),
    supabase.from("insu_rate").select("*", { count: "exact", head: true }),
    supabase.from("holiday").select("*", { count: "exact", head: true }),
    supabase.from("presc_dosage_fee").select("*", { count: "exact", head: true }),
  ]);

  // 샘플: 2026년 Z1000 조회
  const { data: sample } = await supabase
    .from("suga_fee")
    .select("code, name, price")
    .eq("apply_year", 2026)
    .eq("code", "Z1000")
    .single();

  const tables = [
    { name: "suga_fee", label: "수가 단가", count: sugaRes.count, expected: 568 },
    { name: "fee_base_params", label: "기본 파라미터", count: feeRes.count, expected: 3 },
    { name: "insu_rate", label: "보험요율", count: insuRes.count, expected: 18 },
    { name: "holiday", label: "공휴일", count: holidayRes.count, expected: 53 },
    { name: "presc_dosage_fee", label: "투약일수 조제료", count: dosageRes.count, expected: 50 },
  ];

  const allOk = tables.every((t) => t.count === t.expected);

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-blue-600">팜에듀</h1>
          <p className="text-slate-600">약국 조제료 계산 시뮬레이터 + 퀴즈 학습 플랫폼</p>
        </header>

        <section className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className={allOk ? "text-green-600" : "text-red-600"}>
              {allOk ? "✓" : "✗"}
            </span>
            Supabase 연결 상태
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2">테이블</th>
                <th className="py-2">설명</th>
                <th className="py-2 text-right">실제</th>
                <th className="py-2 text-right">예상</th>
                <th className="py-2 text-right">상태</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t) => (
                <tr key={t.name} className="border-b">
                  <td className="py-2 font-mono text-xs">{t.name}</td>
                  <td className="py-2">{t.label}</td>
                  <td className="py-2 text-right font-mono">{t.count ?? "—"}</td>
                  <td className="py-2 text-right font-mono text-slate-400">{t.expected}</td>
                  <td className="py-2 text-right">
                    {t.count === t.expected ? (
                      <span className="text-green-600">OK</span>
                    ) : (
                      <span className="text-red-600">FAIL</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {sample && (
          <section className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-bold mb-4">샘플 조회</h2>
            <p className="text-sm text-slate-500 mb-2">2026년 Z1000 (약국관리료)</p>
            <div className="bg-slate-50 rounded p-4 font-mono text-sm">
              <div>code: <strong>{sample.code}</strong></div>
              <div>name: <strong>{sample.name}</strong></div>
              <div>price: <strong>{sample.price}원</strong></div>
            </div>
          </section>
        )}

        <section className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-6 text-center">
            <div className="text-3xl mb-2">🧮</div>
            <h3 className="font-semibold">계산기</h3>
            <p className="text-xs text-slate-500 mt-1">조제료 시뮬레이터</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6 text-center">
            <div className="text-3xl mb-2">📝</div>
            <h3 className="font-semibold">퀴즈</h3>
            <p className="text-xs text-slate-500 mt-1">매일 1문제 풀기</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6 text-center">
            <div className="text-3xl mb-2">📖</div>
            <h3 className="font-semibold">학습</h3>
            <p className="text-xs text-slate-500 mt-1">단계별 교육</p>
          </div>
        </section>
      </div>
    </main>
  );
}
