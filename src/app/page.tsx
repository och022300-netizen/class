"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User, ShieldAlert, CheckCircle, Database } from "lucide-react";
import { dbService } from "@/lib/firebase";

export default function Home() {
  const [isMock, setIsMock] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsMock(dbService.isMock);
  }, []);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-radial from-slate-900 via-zinc-900 to-black text-slate-100 font-sans antialiased overflow-hidden relative">
      {/* Decorative glowing blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="font-bold text-white text-lg">AG</span>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Antigravity</h1>
            <p className="text-xs text-slate-500">Class Monitor v1.0</p>
          </div>
        </div>

        {mounted && (
          <div className="flex items-center gap-2 bg-slate-800/40 backdrop-blur-md border border-slate-700/50 px-3.5 py-1.5 rounded-full shadow-inner">
            <Database className={`w-4 h-4 ${isMock ? "text-amber-400" : "text-emerald-400"}`} />
            <span className="text-xs font-medium tracking-wide">
              {isMock ? (
                <span className="text-amber-400">Local Mock DB</span>
              ) : (
                <span className="text-emerald-400">Firebase Active</span>
              )}
            </span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-center items-center px-6 py-12 z-10">
        <div className="max-w-4xl w-full text-center space-y-6 mb-12">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            수행평가 실시간 집중도 모니터링 시스템
          </h2>
          <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            학생들의 평가 화면 이탈 여부를 실시간으로 감지하고,<br />
            교실 내 3x4 2인용 책상 자리배치에 따라 입실 및 상태를 한눈에 통제합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
          {/* Student Card */}
          <Link href="/student" className="group">
            <div className="h-full bg-slate-900/40 hover:bg-slate-900/60 backdrop-blur-xl border border-slate-800 hover:border-indigo-500/50 p-8 rounded-3xl transition-all duration-300 shadow-2xl flex flex-col justify-between hover:shadow-indigo-500/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all" />
              <div className="space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                  <User className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white group-hover:text-indigo-300 transition-colors">학생 평가 응시 포털</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    학번과 성함을 입력하고 본인의 자리를 지정하여 입실한 뒤, 지정된 수행평가 에세이를 작성합니다. 창을 이탈하면 관리자에게 즉시 경고가 기록됩니다.
                  </p>
                </div>
              </div>
              <div className="mt-8 flex items-center gap-2 text-indigo-400 font-semibold text-sm group-hover:translate-x-2 transition-transform">
                입장하기 &rarr;
              </div>
            </div>
          </Link>

          {/* Admin Card */}
          <Link href="/admin" className="group">
            <div className="h-full bg-slate-900/40 hover:bg-slate-900/60 backdrop-blur-xl border border-slate-800 hover:border-violet-500/50 p-8 rounded-3xl transition-all duration-300 shadow-2xl flex flex-col justify-between hover:shadow-violet-500/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/10 transition-all" />
              <div className="space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:scale-110 transition-transform">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white group-hover:text-violet-300 transition-colors">감독 교사 대시보드</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    교실 내 3x4 2인용 책상별 배치 상태를 보며 실시간으로 학생들의 응시 현황, 화면/탭 이탈 감지 경고, 실시간 작성 글을 감독 및 설정할 수 있습니다.
                  </p>
                </div>
              </div>
              <div className="mt-8 flex items-center gap-2 text-violet-400 font-semibold text-sm group-hover:translate-x-2 transition-transform">
                대시보드 열기 &rarr;
              </div>
            </div>
          </Link>
        </div>

        {mounted && isMock && (
          <div className="mt-12 max-w-md bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 text-center">
            <p className="text-xs text-amber-400 leading-relaxed">
              💡 <strong>알림:</strong> 현재 로컬 Mock 모드입니다. 다른 탭이나 창에서 각각 <strong>학생 화면</strong>과 <strong>교사 화면</strong>을 열어놓고 테스트하면 브라우저 BroadcastChannel을 통해 실시간으로 Focus 이탈 및 작성 내용이 동기화됩니다.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 text-xs text-slate-600 border-t border-slate-900 z-10">
        &copy; 2026 Antigravity. All rights reserved. High School Performance Assessment Monitor.
      </footer>
    </div>
  );
}
