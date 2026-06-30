"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  dbService, 
  Student, 
  AssessmentConfig 
} from "@/lib/firebase";
import { 
  Users, 
  Monitor, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Settings, 
  Trash2, 
  Play, 
  Square, 
  RotateCcw, 
  Eye, 
  RefreshCw, 
  Clock, 
  Clipboard,
  BookOpen,
  UserX,
  FileCheck,
  ChevronRight,
  ShieldAlert
} from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  
  // Real-time states
  const [mounted, setMounted] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [config, setConfig] = useState<AssessmentConfig | null>(null);

  // Active tab state
  const [activeTab, setActiveTab] = useState<"monitoring" | "submissions" | "settings">("monitoring");

  // Selected Student for details modal
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Settings Form States
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState(50);

  // Countdown timer for admin view
  const [adminRemainingTime, setAdminRemainingTime] = useState<number | null>(null);

  // 1. Subscribe to real-time database updates
  useEffect(() => {
    setMounted(true);

    const unsubscribeStudents = dbService.subscribeStudents((list) => {
      setStudents(list);
      // Keep selected student details updated in real time if modal is open
      setSelectedStudent((prev) => {
        if (!prev) return null;
        return list.find((s) => s.id === prev.id) || null;
      });
    });

    const unsubscribeConfig = dbService.subscribeConfig((cfg) => {
      setConfig(cfg);
      setTitle(cfg.title);
      setDescription(cfg.description);
      setTimeLimit(cfg.timeLimit);
    });

    return () => {
      unsubscribeStudents();
      unsubscribeConfig();
    };
  }, []);

  // 2. Local remaining time calculator
  useEffect(() => {
    if (!config || config.status !== "progress" || !config.startTime) {
      setAdminRemainingTime(null);
      return;
    }

    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - (config.startTime || 0)) / 1000);
      const limitSeconds = config.timeLimit * 60;
      const remaining = limitSeconds - elapsedSeconds;

      if (remaining <= 0) {
        setAdminRemainingTime(0);
        clearInterval(interval);
      } else {
        setAdminRemainingTime(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [config]);

  // 3. Handle changing exam configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbService.updateConfig({
        title,
        description,
        timeLimit: Number(timeLimit)
      });
      alert("평가 설정이 성공적으로 업데이트되었습니다.");
    } catch (err) {
      console.error(err);
      alert("설정 업데이트 중 에러가 발생했습니다.");
    }
  };

  // Start exam (Transition from ready -> progress)
  const handleStartExam = async () => {
    if (!confirm("수행평가를 시작하시겠습니까? 학생들의 타이머가 작동하며 작성 창이 활성화됩니다.")) return;
    try {
      await dbService.updateConfig({
        status: "progress",
        startTime: Date.now()
      });
    } catch (err) {
      console.error(err);
      alert("시험 시작 처리 중 오류가 발생했습니다.");
    }
  };

  // End exam (Transition from progress -> ended)
  const handleEndExam = async () => {
    if (!confirm("수행평가를 강제로 종료하시겠습니까? 학생들의 답안 작성이 정지됩니다.")) return;
    try {
      await dbService.updateConfig({
        status: "ended"
      });
      
      // Auto-submit all non-submitted students
      const nonSubmitted = students.filter(s => !s.submitted);
      for (const student of nonSubmitted) {
        await dbService.updateStudent(student.id, {
          submitted: true,
          submittedAt: Date.now(),
          status: "offline"
        });
      }
      alert("수행평가가 종료되었으며, 미제출된 답안들이 자동 제출 완료되었습니다.");
    } catch (err) {
      console.error(err);
      alert("시험 종료 처리 중 오류가 발생했습니다.");
    }
  };

  // Reset exam back to ready
  const handleResetExamStatus = async () => {
    if (!confirm("시험 상태를 대기 중(Ready) 상태로 돌리시겠습니까? (학생들의 입력은 차단되고 타이머가 지워집니다)")) return;
    try {
      await dbService.updateConfig({
        status: "ready",
        startTime: undefined
      });
    } catch (err) {
      console.error(err);
      alert("상태 복원 중 에러가 발생했습니다.");
    }
  };

  // Clear all student desks (Full Reset)
  const handleClearClassroom = async () => {
    if (!confirm("🚨 경고: 현재 실시간 등록된 모든 학생 정보를 초기화(전원 퇴실 조치)하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    try {
      await dbService.resetClassroom();
      setSelectedStudent(null);
      alert("교실 자리 배치가 초기화되었습니다.");
    } catch (err) {
      console.error(err);
      alert("교실 초기화 중 에러가 발생했습니다.");
    }
  };

  // Force eject specific student
  const handleEjectStudent = async (studentId: string) => {
    if (!confirm("해당 학생을 강제 퇴실 조치하시겠습니까? 로그인 세션이 해제됩니다.")) return;
    try {
      await dbService.removeStudent(studentId);
      if (selectedStudent?.id === studentId) {
        setSelectedStudent(null);
      }
      alert("해당 학생이 강제 퇴실 처리되었습니다.");
    } catch (err) {
      console.error(err);
      alert("퇴실 처리 중 에러가 발생했습니다.");
    }
  };

  // Copy student text to clipboard
  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("답안 내용이 클립보드에 복사되었습니다.");
  };

  if (!mounted) return null;

  // Stats Counters
  const totalStudentsCount = students.length;
  const onlineCount = students.filter((s) => s.status === "online" && !s.submitted).length;
  const awayCount = students.filter((s) => s.status === "away" && !s.submitted).length;
  const submittedCount = students.filter((s) => s.submitted).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative">
      {/* Glow Effects */}
      <div className="absolute top-0 left-0 w-[30%] h-[30%] bg-violet-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[45%] h-[40%] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Top Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 flex flex-wrap justify-between items-center z-10 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight text-white flex items-center gap-2">
              수행평가 감독 제어 콘솔
              <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] px-2 py-0.5 rounded font-mono">
                ADMIN
              </span>
            </h1>
            <p className="text-xs text-slate-500">실시간 학생 이탈 알림 및 답안 확인</p>
          </div>
        </div>

        {/* Dynamic Timer display for admin */}
        <div className="flex items-center gap-4">
          {config?.status === "progress" && adminRemainingTime !== null && (
            <div className="flex items-center gap-2.5 bg-red-950/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl font-mono text-sm shadow-md animate-pulse">
              <Clock className="w-4 h-4 text-red-400" />
              <span className="font-medium">수행 제한시간:</span>
              <span className="font-bold text-base">
                {Math.floor(adminRemainingTime / 60)}분 {adminRemainingTime % 60}초
              </span>
            </div>
          )}

          <button
            onClick={() => router.push("/")}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors"
          >
            포털 홈으로 이동
          </button>
        </div>
      </header>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col md:flex-row z-10">
        
        {/* Left Navigation Sidebar */}
        <aside className="w-full md:w-64 bg-slate-900/30 border-b md:border-b-0 md:border-r border-slate-900 p-4 space-y-2 flex-shrink-0 flex md:flex-col justify-start gap-2 md:gap-0">
          <button
            onClick={() => setActiveTab("monitoring")}
            className={`w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "monitoring"
                ? "bg-indigo-600/10 border border-indigo-500/30 text-indigo-300 shadow-md"
                : "border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <Monitor className="w-4 h-4" />
            실시간 배치도 모니터링
          </button>

          <button
            onClick={() => setActiveTab("submissions")}
            className={`w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "submissions"
                ? "bg-indigo-600/10 border border-indigo-500/30 text-indigo-300 shadow-md"
                : "border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <FileText className="w-4 h-4" />
            제출물 및 상태 테이블
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "settings"
                ? "bg-indigo-600/10 border border-indigo-500/30 text-indigo-300 shadow-md"
                : "border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <Settings className="w-4 h-4" />
            평가 설정 및 관리
          </button>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 p-6 md:p-8 space-y-8 overflow-y-auto max-w-7xl">
          
          {/* STATS OVERVIEW CARDS */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Stat Card: Total */}
            <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-900 rounded-2xl p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-semibold block">총 입실 학생</span>
                <span className="text-3xl font-extrabold text-white">{totalStudentsCount}명</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* Stat Card: Active/Online */}
            <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-900 rounded-2xl p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-semibold block">집중 상태 (온라인)</span>
                <span className="text-3xl font-extrabold text-emerald-400">{onlineCount}명</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-center justify-center text-emerald-400">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            </div>

            {/* Stat Card: Away */}
            <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-900 rounded-2xl p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-semibold block">화면 이탈 경고 (이탈중)</span>
                <span className={`text-3xl font-extrabold ${awayCount > 0 ? "text-amber-400 text-shadow shadow-amber-500" : "text-slate-400"}`}>{awayCount}명</span>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${awayCount > 0 ? "bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-bounce" : "bg-slate-800 text-slate-500"}`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            {/* Stat Card: Submitted */}
            <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-900 rounded-2xl p-5 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-semibold block">제출 완료</span>
                <span className="text-3xl font-extrabold text-indigo-400">{submittedCount}명</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/5 border border-indigo-500/15 flex items-center justify-center text-indigo-400">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>
          </section>

          {/* TAB CONTENT: 1. MONITORING GRID */}
          {activeTab === "monitoring" && (
            <div className="space-y-6">
              
              {/* Monitoring Header & Controls */}
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    실시간 교실 모니터링 현황
                    <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full font-bold">
                      실시간 동기화 Active
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">학생 자리를 클릭하여 실시간 작성 내용 및 상세 이탈 이력을 확인합니다.</p>
                </div>
                
                <div className="flex gap-2">
                  {config?.status === "ready" && (
                    <button
                      onClick={handleStartExam}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/10 transition-all"
                    >
                      <Play className="w-3.5 h-3.5" />
                      수행평가 개시
                    </button>
                  )}
                  {config?.status === "progress" && (
                    <button
                      onClick={handleEndExam}
                      className="bg-red-600 hover:bg-red-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-600/10 transition-all"
                    >
                      <Square className="w-3.5 h-3.5" />
                      평가 강제 종료
                    </button>
                  )}
                  {config?.status === "ended" && (
                    <button
                      onClick={handleResetExamStatus}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      대기 상태로 환원
                    </button>
                  )}
                </div>
              </div>

              {/* Classroom layout */}
              <div className="bg-slate-900/20 border border-slate-900 rounded-3xl p-6 md:p-8 space-y-6">
                
                {/* Board */}
                <div className="w-full bg-slate-900/80 border border-slate-800 text-center py-3 rounded-xl text-slate-400 text-xs font-extrabold tracking-widest uppercase shadow-inner">
                  [ 칠판 및 교단 방향 - 앞 ]
                </div>

                {/* 3x4 Seating layout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {Array.from({ length: 3 }).map((_, rowIndex) =>
                    Array.from({ length: 4 }).map((_, colIndex) => {
                      const leftStudent = students.find(
                        (s) => s.row === rowIndex && s.col === colIndex && s.seatPos === "left"
                      );
                      const rightStudent = students.find(
                        (s) => s.row === rowIndex && s.col === colIndex && s.seatPos === "right"
                      );

                      return (
                        <div 
                          key={`desk-${rowIndex}-${colIndex}`} 
                          className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 relative shadow-inner hover:border-slate-800 transition-all"
                        >
                          <div className="text-[10px] text-slate-600 font-extrabold text-center tracking-wide">
                            책상 {rowIndex + 1}열-{colIndex + 1}행
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            
                            {/* Left Seat Card */}
                            {leftStudent ? (
                              <button
                                onClick={() => setSelectedStudent(leftStudent)}
                                className={`p-3 rounded-xl text-left transition-all border flex flex-col justify-between h-28 relative overflow-hidden group cursor-pointer ${
                                  leftStudent.submitted
                                    ? "bg-slate-800/60 border-slate-700/50 text-slate-400"
                                    : leftStudent.status === "away"
                                      ? "bg-amber-950/20 border-amber-500/80 text-amber-200 animate-pulse shadow-lg shadow-amber-500/5"
                                      : "bg-emerald-950/15 border-emerald-500/40 text-emerald-200"
                                }`}
                              >
                                <div className="space-y-1 w-full">
                                  <div className="flex justify-between items-start w-full">
                                    <span className="text-[9px] opacity-60 font-bold">Seat L</span>
                                    {/* Focus Dot */}
                                    {leftStudent.submitted ? (
                                      <span className="text-[9px] bg-slate-800 text-slate-400 font-bold px-1 py-0.2 rounded border border-slate-700">제출</span>
                                    ) : leftStudent.status === "away" ? (
                                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                                    ) : (
                                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                    )}
                                  </div>
                                  
                                  <h4 className="font-extrabold text-sm text-white truncate w-full">
                                    {leftStudent.name}
                                  </h4>
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    {leftStudent.id}
                                  </p>
                                </div>

                                <div className="flex justify-between items-center w-full mt-2">
                                  <span className="text-[9px] text-slate-500 truncate max-w-[45px]">
                                    {leftStudent.submitted ? "종료" : leftStudent.status === "away" ? "이탈중" : "작성중"}
                                  </span>
                                  {leftStudent.awayCount > 0 && (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${leftStudent.status === "away" ? "bg-amber-500 text-black font-extrabold" : "bg-slate-800 text-amber-400 border border-slate-700"}`}>
                                      ⚠️{leftStudent.awayCount}
                                    </span>
                                  )}
                                </div>
                              </button>
                            ) : (
                              <div className="p-3 rounded-xl border border-dashed border-slate-800/80 bg-slate-950/30 text-center flex flex-col justify-center items-center h-28 text-slate-700">
                                <span className="text-[9px] font-bold opacity-30">Seat L</span>
                                <span className="text-[10px] mt-1 font-semibold">공석</span>
                              </div>
                            )}

                            {/* Right Seat Card */}
                            {rightStudent ? (
                              <button
                                onClick={() => setSelectedStudent(rightStudent)}
                                className={`p-3 rounded-xl text-left transition-all border flex flex-col justify-between h-28 relative overflow-hidden group cursor-pointer ${
                                  rightStudent.submitted
                                    ? "bg-slate-800/60 border-slate-700/50 text-slate-400"
                                    : rightStudent.status === "away"
                                      ? "bg-amber-950/20 border-amber-500/80 text-amber-200 animate-pulse shadow-lg shadow-amber-500/5"
                                      : "bg-emerald-950/15 border-emerald-500/40 text-emerald-200"
                                }`}
                              >
                                <div className="space-y-1 w-full">
                                  <div className="flex justify-between items-start w-full">
                                    <span className="text-[9px] opacity-60 font-bold">Seat R</span>
                                    {/* Focus Dot */}
                                    {rightStudent.submitted ? (
                                      <span className="text-[9px] bg-slate-800 text-slate-400 font-bold px-1 py-0.2 rounded border border-slate-700">제출</span>
                                    ) : rightStudent.status === "away" ? (
                                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                                    ) : (
                                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                                    )}
                                  </div>
                                  
                                  <h4 className="font-extrabold text-sm text-white truncate w-full">
                                    {rightStudent.name}
                                  </h4>
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    {rightStudent.id}
                                  </p>
                                </div>

                                <div className="flex justify-between items-center w-full mt-2">
                                  <span className="text-[9px] text-slate-500 truncate max-w-[45px]">
                                    {rightStudent.submitted ? "종료" : rightStudent.status === "away" ? "이탈중" : "작성중"}
                                  </span>
                                  {rightStudent.awayCount > 0 && (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${rightStudent.status === "away" ? "bg-amber-500 text-black font-extrabold" : "bg-slate-800 text-amber-400 border border-slate-700"}`}>
                                      ⚠️{rightStudent.awayCount}
                                    </span>
                                  )}
                                </div>
                              </button>
                            ) : (
                              <div className="p-3 rounded-xl border border-dashed border-slate-800/80 bg-slate-950/30 text-center flex flex-col justify-center items-center h-28 text-slate-700">
                                <span className="text-[9px] font-bold opacity-30">Seat R</span>
                                <span className="text-[10px] mt-1 font-semibold">공석</span>
                              </div>
                            )}

                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Rear indicator */}
                <div className="text-center text-slate-600 text-xs">
                  [ 교실 뒤쪽 - 출입문 방향 ]
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: 2. SUBMISSIONS LIST */}
          {activeTab === "submissions" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    학생 성적 및 상태 테이블
                  </h2>
                  <p className="text-xs text-slate-500">학생들의 최종 수행 내용 및 이탈 통계를 한눈에 대조합니다.</p>
                </div>
              </div>

              <div className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl">
                {students.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-sm font-semibold">
                    현재 입실한 학생이 없습니다. 학생들이 자리를 지정하고 입실하면 이곳에 집계됩니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-bold">
                          <th className="p-4 text-xs tracking-wider">좌석</th>
                          <th className="p-4 text-xs tracking-wider">학번</th>
                          <th className="p-4 text-xs tracking-wider">이름</th>
                          <th className="p-4 text-xs tracking-wider">상태</th>
                          <th className="p-4 text-xs tracking-wider">이탈 경고</th>
                          <th className="p-4 text-xs tracking-wider">작성자수 (공백포함)</th>
                          <th className="p-4 text-xs tracking-wider">제출 시각</th>
                          <th className="p-4 text-xs tracking-wider text-right">작업</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {students.map((student) => (
                          <tr key={student.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="p-4 text-xs text-slate-400 font-medium">
                              {student.row + 1}열 - {student.col + 1}행 ({student.seatPos === "left" ? "좌" : "우"})
                            </td>
                            <td className="p-4 font-mono font-bold text-slate-200">
                              {student.id}
                            </td>
                            <td className="p-4 font-extrabold text-white">
                              {student.name}
                            </td>
                            <td className="p-4">
                              {student.submitted ? (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2 py-0.5 rounded-full font-bold">
                                  제출 완료
                                </span>
                              ) : student.status === "away" ? (
                                <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
                                  🚨 이탈 중
                                </span>
                              ) : (
                                <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs px-2 py-0.5 rounded-full font-medium">
                                  작성 중
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              {student.awayCount > 0 ? (
                                <span className="text-amber-400 font-bold">
                                  ⚠️ {student.awayCount}회
                                </span>
                              ) : (
                                <span className="text-slate-600">0회</span>
                              )}
                            </td>
                            <td className="p-4 text-xs text-slate-300 font-mono">
                              {student.content?.length || 0}자
                            </td>
                            <td className="p-4 text-xs text-slate-400">
                              {student.submittedAt 
                                ? new Date(student.submittedAt).toLocaleTimeString() 
                                : "-"
                              }
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setSelectedStudent(student)}
                                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 p-1.5 rounded-md hover:text-white transition-colors cursor-pointer"
                                  title="답안지 열기"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleEjectStudent(student.id)}
                                  className="bg-slate-800 hover:bg-red-950 border border-slate-700 hover:border-red-900/50 text-slate-400 hover:text-red-400 p-1.5 rounded-md transition-colors cursor-pointer"
                                  title="강제 퇴실"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT: 3. SETTINGS & RESET */}
          {activeTab === "settings" && (
            <div className="space-y-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Form Settings */}
              <div className="lg:col-span-2 bg-slate-900/20 border border-slate-900 rounded-3xl p-6 md:p-8 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                    <BookOpen className="w-5 h-5 text-indigo-400" />
                    수행평가 문항 설정
                  </h3>
                  <p className="text-xs text-slate-500">출제할 문항 주제와 학생들에게 표시할 문항 가이드라인을 수정합니다.</p>
                </div>

                <form onSubmit={handleSaveConfig} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">평가 제목 / 대문 주제</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-700 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">지시 사항 및 추가 규정</label>
                    <textarea
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-4 text-slate-200 placeholder-slate-700 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">제한 시간 (분 단위)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(Number(e.target.value))}
                        className="w-28 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-700 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                      />
                      <span className="text-sm font-semibold text-slate-400">분</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-indigo-500/10 transition-all text-xs cursor-pointer"
                  >
                    설정 내용 실시간 배포
                  </button>
                </form>
              </div>

              {/* Classroom Control Panel */}
              <div className="bg-slate-900/20 border border-slate-900 rounded-3xl p-6 md:p-8 space-y-6 flex flex-col justify-between">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                      <Trash2 className="w-5 h-5 text-red-400" />
                      감독 제어 센터
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">교실 내 정보 초기화 및 퇴실 조치.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4 space-y-2">
                      <span className="text-xs font-semibold text-slate-400 block">시험 제어:</span>
                      <div className="flex gap-2">
                        {config?.status !== "progress" ? (
                          <button
                            onClick={handleStartExam}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" /> 시험 개시
                          </button>
                        ) : (
                          <button
                            onClick={handleEndExam}
                            className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            <Square className="w-3.5 h-3.5" /> 시험 종료
                          </button>
                        )}
                        <button
                          onClick={handleResetExamStatus}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/50 p-2.5 rounded-lg transition-colors cursor-pointer"
                          title="대기 모드로 초기화"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4 space-y-2">
                      <span className="text-xs font-semibold text-slate-400 block">DB 청소:</span>
                      <button
                        onClick={handleClearClassroom}
                        className="w-full bg-red-950/20 hover:bg-red-650/40 border border-red-900/50 text-red-400 font-bold py-3 rounded-lg text-xs tracking-wide transition-all cursor-pointer"
                      >
                        교실 자리 비우기 (전원 퇴실)
                      </button>
                      <p className="text-[10px] text-slate-500 leading-relaxed text-center">
                        * 주의: 현재 등록된 모든 학생 정보를 파기합니다. 교실 자리가 모두 초기화되며 학생 화면에서는 자동 로그아웃 처리됩니다.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4 text-center">
                  <span className="text-[10px] text-slate-500 block">대시보드 통신 규정</span>
                  <span className="text-xs font-bold text-slate-300">
                    {dbService.isMock ? "로컬 가상 BroadcastChannel 모드" : "원격 Firebase Live Firestore 연결"}
                  </span>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* STUDENT DETAIL MODAL (LIVE ANSWER VIEWER & TIMELINE) */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fade-in">
          
          <div className="bg-slate-900 border border-slate-800/80 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] relative animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                  좌석: {selectedStudent.row + 1}열-{selectedStudent.col + 1}행 ({selectedStudent.seatPos === "left" ? "좌측" : "우측"})
                </span>
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2 mt-0.5">
                  {selectedStudent.name}
                  <span className="text-sm text-slate-400 font-mono">({selectedStudent.id})</span>
                </h3>
              </div>

              <div className="flex items-center gap-3">
                {selectedStudent.submitted ? (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full font-bold">
                    최종 제출 완료
                  </span>
                ) : selectedStudent.status === "away" ? (
                  <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                    화면 이탈 발생!
                  </span>
                ) : (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    집중 상태
                  </span>
                )}
                
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="text-slate-400 hover:text-white font-bold p-1 rounded-md text-sm border border-slate-800 hover:border-slate-700 bg-slate-950/20 transition-all cursor-pointer"
                >
                  &times; 닫기
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Real-time Content Preview */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-indigo-400" />
                    실시간 답안지 작성 상황
                  </h4>
                  <div className="text-[10px] text-slate-500 font-mono">
                    글자수: 공백포함 <strong className="text-indigo-400">{selectedStudent.content?.length || 0}자</strong> / 공백제외 {selectedStudent.content?.replace(/\s/g, "").length || 0}자
                  </div>
                </div>
                
                <div className="relative">
                  <textarea
                    readOnly
                    value={selectedStudent.content || "학생이 내용을 아직 입력하지 않았습니다."}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-300 text-sm leading-relaxed resize-none h-60 focus:outline-none"
                  />
                  <div className="absolute bottom-4 right-4 flex gap-1.5">
                    <button
                      onClick={() => handleCopyToClipboard(selectedStudent.content || "")}
                      className="bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      내용 복사
                    </button>
                  </div>
                </div>
              </div>

              {/* Exit/Focus Loss Logs */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  집중도 이탈 타임라인 로그 ({selectedStudent.awayCount}회 이력)
                </h4>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 max-h-44 overflow-y-auto space-y-2.5">
                  {(!selectedStudent.awayLogs || selectedStudent.awayLogs.length === 0) ? (
                    <div className="text-center py-6 text-slate-600 text-xs font-semibold">
                      안심구역: 이 학생은 시험 창을 한 번도 벗어나지 않았습니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedStudent.awayLogs.map((log, idx) => {
                        const isEject = log.type.includes("이탈");
                        return (
                          <div key={idx} className="flex justify-between items-center text-xs font-semibold border-b border-slate-900 pb-1.5">
                            <span className="flex items-center gap-1.5 text-slate-400">
                              <span className={`w-1.5 h-1.5 rounded-full ${isEject ? "bg-red-400" : "bg-emerald-400"}`} />
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={isEject ? "text-amber-400" : "text-slate-500"}>
                              {log.type}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-between items-center gap-4">
              <span className="text-[10px] text-slate-500">
                마지막 활동 시각: {selectedStudent.lastActive ? new Date(selectedStudent.lastActive).toLocaleTimeString() : "-"}
              </span>
              
              <button
                onClick={() => handleEjectStudent(selectedStudent.id)}
                className="bg-red-950/40 hover:bg-red-600 border border-red-900/50 hover:border-red-500 text-red-400 hover:text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <UserX className="w-3.5 h-3.5" />
                학생 강제 퇴실 처리 (강제 로그아웃)
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
