"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  dbService, 
  Student, 
  AssessmentConfig 
} from "@/lib/firebase";
import { 
  User, 
  Hash, 
  Monitor, 
  PenTool, 
  Clock, 
  CheckCircle2, 
  LogOut, 
  AlertTriangle,
  BookOpen
} from "lucide-react";

export default function StudentPage() {
  const router = useRouter();
  
  // States
  const [mounted, setMounted] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [config, setConfig] = useState<AssessmentConfig | null>(null);
  
  // Login form states
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [selectedSeat, setSelectedSeat] = useState<{ row: number; col: number; seatPos: "left" | "right" } | null>(null);
  
  // Active session state
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Timers
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [timerPulse, setTimerPulse] = useState(false);

  // Refs for event listeners to prevent stale closures
  const currentStudentRef = useRef<Student | null>(null);
  const contentRef = useRef("");
  
  // Sync input text to DB (throttled)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Component mounting & Real-time Subscriptions
  useEffect(() => {
    setMounted(true);

    // Subscribe to students list
    const unsubscribeStudents = dbService.subscribeStudents((list) => {
      setStudents(list);
      
      // Update local student session if data changes from server (e.g. reset or kicked by admin)
      const storedId = localStorage.getItem("current_student_id");
      if (storedId) {
        const found = list.find((s) => s.id === storedId);
        if (found) {
          setCurrentStudent(found);
          currentStudentRef.current = found;
          // Set initial text only once when logging in, then manage locally
          if (contentRef.current === "" && found.content !== "") {
            setContent(found.content);
            contentRef.current = found.content;
          }
        } else {
          // If logged in locally but not found in active classroom, force logout
          handleLocalLogout();
        }
      }
    });

    // Subscribe to configurations
    const unsubscribeConfig = dbService.subscribeConfig((cfg) => {
      setConfig(cfg);
    });

    // Restore session if active
    const storedId = localStorage.getItem("current_student_id");
    if (storedId) {
      // Find candidate student
      const list = getMockStudentsSync();
      const found = list.find((s) => s.id === storedId);
      if (found) {
        setCurrentStudent(found);
        currentStudentRef.current = found;
        setContent(found.content);
        contentRef.current = found.content;
      }
    }

    return () => {
      unsubscribeStudents();
      unsubscribeConfig();
    };
  }, []);

  // Helper for immediate mock read during hydration/mount
  const getMockStudentsSync = (): Student[] => {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem("focus_monitor_students");
    return raw ? JSON.parse(raw) : [];
  };

  // 2. Countdown Timer Loop
  useEffect(() => {
    if (!config || config.status !== "progress" || !config.startTime) {
      setRemainingTime(null);
      return;
    }

    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - (config.startTime || 0)) / 1000);
      const limitSeconds = config.timeLimit * 60;
      const remaining = limitSeconds - elapsedSeconds;

      if (remaining <= 0) {
        setRemainingTime(0);
        clearInterval(interval);
        // Auto submit when time runs out
        if (currentStudentRef.current && !currentStudentRef.current.submitted) {
          autoSubmitAssessment();
        }
      } else {
        setRemainingTime(remaining);
        // Alert pulsing when remaining time is under 1 minute (60s)
        setTimerPulse(remaining < 60);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [config, currentStudent]);

  // 3. Focus / Tab Out Tracking Event Listeners
  useEffect(() => {
    if (!currentStudent || currentStudent.submitted) return;

    // Track tab visibility or focus loss
    const handleBlur = () => {
      const student = currentStudentRef.current;
      if (!student || student.submitted) return;

      const logEntry = { timestamp: Date.now(), type: "이탈(화면 벗어남)" };
      const updatedLogs = [...(student.awayLogs || []), logEntry];
      const newAwayCount = student.awayCount + 1;

      dbService.updateStudent(student.id, {
        status: "away",
        awayCount: newAwayCount,
        awayLogs: updatedLogs
      });
    };

    const handleFocus = () => {
      const student = currentStudentRef.current;
      if (!student || student.submitted) return;

      const logEntry = { timestamp: Date.now(), type: "복귀(화면 포커스)" };
      const updatedLogs = [...(student.awayLogs || []), logEntry];

      dbService.updateStudent(student.id, {
        status: "online",
        awayLogs: updatedLogs
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleBlur();
      } else if (document.visibilityState === "visible") {
        handleFocus();
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentStudent]);

  // Logout utility
  const handleLocalLogout = () => {
    localStorage.removeItem("current_student_id");
    setCurrentStudent(null);
    currentStudentRef.current = null;
    setContent("");
    contentRef.current = "";
    setSelectedSeat(null);
  };

  // 4. Student Login Handling
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert("이름을 입력해 주세요.");
    if (!studentId.trim()) return alert("학번을 입력해 주세요.");
    if (!selectedSeat) return alert("자리를 선택해 주세요.");

    // Check if Student ID is already registered
    if (students.some((s) => s.id === studentId)) {
      return alert("이미 입실 완료된 학번입니다. 학번을 확인해 주십시오.");
    }

    // Check if the selected seat is already taken
    const isTaken = students.some(
      (s) => s.row === selectedSeat.row && s.col === selectedSeat.col && s.seatPos === selectedSeat.seatPos
    );
    if (isTaken) {
      return alert("선택한 자리는 이미 다른 학생이 선점했습니다. 다른 자리를 선택해 주세요.");
    }

    const newStudent: Student = {
      id: studentId,
      name: name,
      row: selectedSeat.row,
      col: selectedSeat.col,
      seatPos: selectedSeat.seatPos,
      status: "online",
      awayCount: 0,
      awayLogs: [],
      content: "",
      submitted: false,
      lastActive: Date.now()
    };

    try {
      await dbService.addStudent(newStudent);
      localStorage.setItem("current_student_id", studentId);
      setCurrentStudent(newStudent);
      currentStudentRef.current = newStudent;
      setContent("");
      contentRef.current = "";
    } catch (err) {
      console.error(err);
      alert("로그인 중 에러가 발생했습니다.");
    }
  };

  // 5. Throttled text content synchronization
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    contentRef.current = val;

    if (!currentStudent) return;

    // Clear any previous pending synchronization
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Set a throttled sync to run after 800ms of user stopping typing
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        await dbService.updateStudent(currentStudent.id, {
          content: val,
          lastActive: Date.now()
        });
      } catch (err) {
        console.error("실시간 텍스트 동기화 실패:", err);
      }
    }, 800);
  };

  // 6. Manual Assessment Submission
  const handleSubmit = async () => {
    if (!currentStudent) return;
    if (!confirm("최종 제출하시겠습니까? 제출 후에는 답안을 수정할 수 없습니다.")) return;

    setIsSubmitting(true);
    try {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      await dbService.updateStudent(currentStudent.id, {
        content: content,
        submitted: true,
        submittedAt: Date.now(),
        status: "offline"
      });
      
      // Update local state
      const updated = {
        ...currentStudent,
        content: content,
        submitted: true,
        submittedAt: Date.now(),
        status: "offline" as const
      };
      setCurrentStudent(updated);
      currentStudentRef.current = updated;
    } catch (err) {
      console.error(err);
      alert("제출 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 7. Auto Submission (Timer finished)
  const autoSubmitAssessment = async () => {
    if (!currentStudentRef.current) return;
    try {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      await dbService.updateStudent(currentStudentRef.current.id, {
        submitted: true,
        submittedAt: Date.now(),
        status: "offline"
      });
      
      alert("제한 시간이 모두 경과하여 작성 중인 내용이 자동으로 제출되었습니다.");
    } catch (err) {
      console.error("자동 제출 처리 오류:", err);
    }
  };

  // 8. Exit / Logout handling before exam
  const handleExit = async () => {
    if (!currentStudent) return;
    
    const msg = currentStudent.submitted 
      ? "로그아웃하시겠습니까?" 
      : "아직 제출하지 않았습니다. 입실 상태를 해제하고 퇴실하시겠습니까? (작성 내용은 저장되지 않습니다)";
      
    if (!confirm(msg)) return;

    try {
      if (!currentStudent.submitted) {
        // Delete student from active classroom if leaving mid-exam
        await dbService.removeStudent(currentStudent.id);
      } else {
        // Just mark offline if already submitted
        await dbService.updateStudent(currentStudent.id, { status: "offline" });
      }
      handleLocalLogout();
    } catch (err) {
      console.error(err);
      alert("퇴실 중 에러가 발생했습니다.");
    }
  };

  // Render variables
  const charCountWithSpace = content.length;
  const charCountWithoutSpace = content.replace(/\s/g, "").length;

  if (!mounted) return null;

  // --- RENDERING: INPUT SCREEN (LOGGED IN) ---
  if (currentStudent) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Top Status Bar */}
        <header className="bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 flex flex-wrap justify-between items-center z-10 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-indigo-200">
                {currentStudent.name} ({currentStudent.id})
              </span>
            </div>
            <div className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300">
              자리: {currentStudent.row + 1}열-{currentStudent.col + 1}행 ({currentStudent.seatPos === "left" ? "좌" : "우"})
            </div>
            {currentStudent.submitted ? (
              <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-full font-bold">
                제출 완료
              </span>
            ) : (
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                실시간 감독 중
              </span>
            )}
          </div>

          <div className="flex items-center gap-6">
            {/* Timer */}
            {config?.status === "progress" && remainingTime !== null && (
              <div className={`flex items-center gap-2 bg-slate-900 border ${timerPulse ? "border-red-500/50 text-red-400 bg-red-950/20" : "border-slate-800 text-slate-200"} px-4 py-1.5 rounded-xl font-mono text-sm tracking-wide transition-all ${timerPulse ? "animate-pulse" : ""}`}>
                <Clock className="w-4 h-4" />
                <span>남은 시간:</span>
                <span className="font-bold text-lg">
                  {Math.floor(remainingTime / 60)}분 {remainingTime % 60}초
                </span>
              </div>
            )}
            {config?.status === "ready" && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-1.5 rounded-xl text-xs font-semibold">
                <Clock className="w-4 h-4 animate-spin" />
                시험 시작 대기 중
              </div>
            )}
            {config?.status === "ended" && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-1.5 rounded-xl text-xs font-semibold">
                <AlertTriangle className="w-4 h-4" />
                시험 종료됨
              </div>
            )}

            <button
              onClick={handleExit}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-red-950/30 border border-slate-700 hover:border-red-900/50 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-red-400 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              퇴실/로그아웃
            </button>
          </div>
        </header>

        {/* Main Content Pane */}
        <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 flex flex-col gap-6 z-10">
          
          {/* Assessment Header Card */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold">
              <BookOpen className="w-4 h-4" />
              <span>수행평가 문항</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              {config?.title || "수행평가 주제가 아직 설정되지 않았습니다."}
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-line">
              {config?.description || "감독 교사의 지시를 기다려 주십시오."}
            </p>
            {!currentStudent.submitted && (
              <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>🚨 화면 이탈 주의:</strong> 본 수행평가는 실시간으로 포커스를 체크합니다. <strong>창을 끄거나, 다른 탭으로 이동하거나, 메신저를 켜는 등 포커스를 이탈할 시</strong> 해당 이력과 시각이 고스란히 저장되어 교사 화면에 실시간 경고로 기록되오니 다른 행동은 일절 금해 주시기 바랍니다.
                </span>
              </div>
            )}
          </div>

          {/* Typing Area */}
          {currentStudent.submitted ? (
            // Submitted view
            <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-8 text-center space-y-6 flex-1 flex flex-col justify-center items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-extrabold text-white">수행평가 제출이 완료되었습니다!</h3>
                <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                  작성하신 에세이가 안전하게 서버로 제출되었습니다. 감독 선생님의 추가 지시가 있을 때까지 대기해 주시기 바랍니다.
                </p>
              </div>

              <div className="w-full max-w-2xl bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 text-left space-y-4">
                <div className="text-xs text-slate-500 border-b border-slate-800 pb-2 flex justify-between">
                  <span>학번: {currentStudent.id} | 이름: {currentStudent.name}</span>
                  <span>제출 시각: {currentStudent.submittedAt ? new Date(currentStudent.submittedAt).toLocaleTimeString() : ""}</span>
                </div>
                <div className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap font-sans max-h-60 overflow-y-auto pr-2">
                  {content}
                </div>
                <div className="text-xs text-slate-400 text-right pt-2 border-t border-slate-800/60">
                  최종 글자수: 공백 포함 {charCountWithSpace}자 / 공백 제외 {charCountWithoutSpace}자
                </div>
              </div>
            </div>
          ) : (
            // Editing view
            <div className="flex-1 flex flex-col gap-3 min-h-[400px]">
              <div className="flex justify-between items-center px-1">
                <label className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                  <PenTool className="w-4 h-4 text-indigo-400" />
                  답안 작성란
                </label>
                <div className="text-xs text-slate-400 font-mono">
                  글자수: <span className="text-indigo-400 font-semibold">{charCountWithSpace}</span>자 (공백 제외 {charCountWithoutSpace}자)
                </div>
              </div>

              <textarea
                value={content}
                onChange={handleContentChange}
                disabled={config?.status !== "progress"}
                placeholder={config?.status === "progress" 
                  ? "이곳에 수행평가 내용을 작성해 주십시오. 입력 시 자동으로 1초 이내 서버와 동기화됩니다..." 
                  : "수행평가가 활성화되지 않았습니다. 감독 교사가 시험을 시작해야 작성이 가능합니다."
                }
                className="flex-1 w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-2xl p-5 md:p-6 text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed resize-none text-base transition-all shadow-inner disabled:cursor-not-allowed disabled:bg-slate-950 disabled:border-slate-900 disabled:text-slate-600"
              />

              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Monitor className="w-3.5 h-3.5 text-slate-500" />
                  포커스 이탈 횟수: <strong className="text-amber-400 font-semibold">{currentStudent.awayCount}회</strong>
                </span>

                <button
                  onClick={handleSubmit}
                  disabled={config?.status !== "progress" || content.trim().length === 0 || isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-600 font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-indigo-500/10 disabled:shadow-none hover:translate-y-[-1px] active:translate-y-[1px] transition-all text-sm cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "제출 중..." : "최종 답안 제출하기"}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // --- RENDERING: LOGIN SCREEN (NOT LOGGED IN) ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative font-sans">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-violet-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-4xl bg-slate-900/30 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col lg:flex-row gap-8 z-10">
        
        {/* Left Side: Login Form */}
        <div className="w-full lg:w-[350px] flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">학생 입실 등록</h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              학번과 성함을 입력하시고, 우측의 교실 자리배치도에서 자신의 좌석을 지정하여 입실해 주십시오.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-indigo-400" />
                학번 (학급번호)
              </label>
              <input
                type="text"
                placeholder="예: 30512 (3학년 5반 12번)"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                이름 (실명)
              </label>
              <input
                type="text"
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
              <span className="text-xs font-semibold text-slate-400 block">선택 좌석:</span>
              {selectedSeat ? (
                <span className="text-sm font-bold text-indigo-400">
                  {selectedSeat.row + 1}열 - {selectedSeat.col + 1}번째 책상 ({selectedSeat.seatPos === "left" ? "왼쪽 좌석" : "오른쪽 좌석"})
                </span>
              ) : (
                <span className="text-xs text-red-400/80">배치표에서 자리를 탭하여 선택하십시오.</span>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/10 hover:translate-y-[-1px] active:translate-y-[1px] transition-all text-sm cursor-pointer"
            >
              입실 처리 및 시험 대기
            </button>
          </form>

          <button 
            onClick={() => router.push("/")}
            className="text-xs text-slate-500 hover:text-slate-400 text-center block pt-2 underline underline-offset-4 cursor-pointer"
          >
            홈 화면으로 돌아가기
          </button>
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-[1px] bg-slate-800" />

        {/* Right Side: 3x4 Desks (Double Seats) Grid */}
        <div className="flex-1 space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                교실 자리 배치표
                <span className="text-xs text-slate-500 font-normal">(2인 1조, 3열 4행 책상 구조)</span>
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">원하시는 빈자리(초록)를 클릭하여 등록해 주십시오.</p>
            </div>
            
            {/* Status Legend */}
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/40"></span> 공석
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-red-500/20 border border-red-500/40"></span> 점유됨
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-indigo-500"></span> 선택좌석
              </span>
            </div>
          </div>

          {/* Teacher Desk Indicator */}
          <div className="w-full bg-slate-900/80 border border-slate-800 text-center py-2.5 rounded-xl text-slate-400 text-xs font-bold tracking-widest uppercase">
            [ 칠판 및 교단 방향 - 앞 ]
          </div>

          {/* 3x4 Double-Desk Grid */}
          <div className="grid grid-cols-4 gap-4 py-2">
            {Array.from({ length: 3 }).map((_, rowIndex) =>
              Array.from({ length: 4 }).map((_, colIndex) => {
                // Find students at this desk
                const leftStudent = students.find(
                  (s) => s.row === rowIndex && s.col === colIndex && s.seatPos === "left"
                );
                const rightStudent = students.find(
                  (s) => s.row === rowIndex && s.col === colIndex && s.seatPos === "right"
                );

                // Helper to check if a seat is active selected
                const isLeftSelected = 
                  selectedSeat?.row === rowIndex && 
                  selectedSeat?.col === colIndex && 
                  selectedSeat?.seatPos === "left";
                
                const isRightSelected = 
                  selectedSeat?.row === rowIndex && 
                  selectedSeat?.col === colIndex && 
                  selectedSeat?.seatPos === "right";

                return (
                  <div 
                    key={`desk-${rowIndex}-${colIndex}`} 
                    className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-2.5 flex flex-col gap-2 relative shadow-inner hover:border-slate-700/60 transition-colors"
                  >
                    {/* Desk label */}
                    <div className="text-[10px] text-slate-600 font-bold text-center">
                      책상 {rowIndex + 1}-{colIndex + 1}
                    </div>
                    
                    {/* Left & Right Seats */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {/* Left Seat */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!leftStudent) {
                            setSelectedSeat({ row: rowIndex, col: colIndex, seatPos: "left" });
                          }
                        }}
                        disabled={!!leftStudent}
                        className={`text-[11px] font-semibold py-3 px-1 rounded-md text-center transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:cursor-not-allowed ${
                          leftStudent 
                            ? "bg-red-500/10 border border-red-500/20 text-red-400 font-bold" 
                            : isLeftSelected
                              ? "bg-indigo-600 border border-indigo-400 text-white font-extrabold shadow-md shadow-indigo-500/20 scale-105"
                              : "bg-emerald-500/5 hover:bg-emerald-500/15 border border-emerald-500/15 hover:border-emerald-500/30 text-emerald-400"
                        }`}
                      >
                        <span className="opacity-60 text-[9px]">L</span>
                        <span className="truncate max-w-[40px] text-[10px]">
                          {leftStudent ? leftStudent.name : isLeftSelected ? "선택" : "빈석"}
                        </span>
                      </button>

                      {/* Right Seat */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!rightStudent) {
                            setSelectedSeat({ row: rowIndex, col: colIndex, seatPos: "right" });
                          }
                        }}
                        disabled={!!rightStudent}
                        className={`text-[11px] font-semibold py-3 px-1 rounded-md text-center transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:cursor-not-allowed ${
                          rightStudent 
                            ? "bg-red-500/10 border border-red-500/20 text-red-400 font-bold" 
                            : isRightSelected
                              ? "bg-indigo-600 border border-indigo-400 text-white font-extrabold shadow-md shadow-indigo-500/20 scale-105"
                              : "bg-emerald-500/5 hover:bg-emerald-500/15 border border-emerald-500/15 hover:border-emerald-500/30 text-emerald-400"
                        }`}
                      >
                        <span className="opacity-60 text-[9px]">R</span>
                        <span className="truncate max-w-[40px] text-[10px]">
                          {rightStudent ? rightStudent.name : isRightSelected ? "선택" : "빈석"}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="text-center text-slate-600 text-xs">
            [ 교실 뒤쪽 - 출입문 방향 ]
          </div>
        </div>

      </div>
    </div>
  );
}
