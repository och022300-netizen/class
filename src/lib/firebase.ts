import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  collection, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  writeBatch 
} from "firebase/firestore";

export interface Student {
  id: string;          // 학번 (예: "30512")
  name: string;        // 이름
  row: number;         // 자리 행 (0 ~ 2)
  col: number;         // 자리 열 (0 ~ 3)
  seatPos: 'left' | 'right'; // 책상 내 위치
  status: 'online' | 'away' | 'offline'; // 상태
  awayCount: number;   // 이탈 횟수
  awayLogs: Array<{    // 이탈 로그
    timestamp: number;
    type: string;
  }>;
  content: string;     // 실시간 입력 텍스트
  submitted: boolean;  // 제출 완료 여부
  submittedAt?: number; // 제출 시각
  lastActive: number;  // 마지막 활동 시각
}

export interface AssessmentConfig {
  title: string;
  description: string;
  timeLimit: number; // 분 단위
  startTime?: number; // 시작 타임스탬프
  status: 'ready' | 'progress' | 'ended'; // 상태
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const hasFirebaseConfig = !!(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
);

// Firebase Initialize
let app: any;
let firestoreDb: any;

if (hasFirebaseConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    firestoreDb = getFirestore(app);
    console.log("Firebase가 성공적으로 초기화되었습니다.");
  } catch (error) {
    console.error("Firebase 초기화 에러, Mock 모드로 전환합니다:", error);
  }
} else {
  console.log("Firebase 환경 변수가 설정되지 않았습니다. 실시간 로컬 Mock 모드로 동작합니다.");
}

// Default Configuration for Mock
const DEFAULT_CONFIG: AssessmentConfig = {
  title: "인공지능 윤리에 관한 자유 에세이 작성",
  description: "수행평가 화면을 벗어나는 경우(새 탭 이동, 창 최소화, 화면 이탈 등) 관리자 화면에 경고 기록이 전송됩니다. 아래 텍스트 상자에 작성해 주시기 바랍니다.",
  timeLimit: 50,
  status: "ready"
};

// --- Mock Database Implementation (BroadcastChannel & LocalStorage) ---
const channelName = "classroom_focus_channel";
let broadcastChannel: BroadcastChannel | null = null;

if (typeof window !== "undefined") {
  broadcastChannel = new BroadcastChannel(channelName);
}

const getMockStudents = (): Student[] => {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("focus_monitor_students");
  return raw ? JSON.parse(raw) : [];
};

const saveMockStudents = (students: Student[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem("focus_monitor_students", JSON.stringify(students));
  broadcastChannel?.postMessage({ type: "STUDENTS_UPDATED" });
};

const getMockConfig = (): AssessmentConfig => {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  const raw = localStorage.getItem("focus_monitor_config");
  return raw ? JSON.parse(raw) : DEFAULT_CONFIG;
};

const saveMockConfig = (config: AssessmentConfig) => {
  if (typeof window === "undefined") return;
  localStorage.setItem("focus_monitor_config", JSON.stringify(config));
  broadcastChannel?.postMessage({ type: "CONFIG_UPDATED" });
};

// --- Unified DB Service ---
export const dbService = {
  isMock: !firestoreDb,

  // 1. 학생 목록 실시간 구독
  subscribeStudents: (callback: (students: Student[]) => void): (() => void) => {
    if (firestoreDb) {
      const studentsRef = collection(firestoreDb, "students");
      return onSnapshot(studentsRef, (snapshot) => {
        const list: Student[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Student);
        });
        callback(list);
      }, (err) => {
        console.error("Firestore 학생 구독 오류:", err);
      });
    } else {
      // Mock Subscription
      callback(getMockStudents());

      const handleMessage = (e: MessageEvent) => {
        if (e.data?.type === "STUDENTS_UPDATED") {
          callback(getMockStudents());
        }
      };

      const handleStorage = (e: StorageEvent) => {
        if (e.key === "focus_monitor_students") {
          callback(getMockStudents());
        }
      };

      if (typeof window !== "undefined") {
        broadcastChannel?.addEventListener("message", handleMessage);
        window.addEventListener("storage", handleStorage);
      }

      return () => {
        if (typeof window !== "undefined") {
          broadcastChannel?.removeEventListener("message", handleMessage);
          window.removeEventListener("storage", handleStorage);
        }
      };
    }
  },

  // 2. 설정 실시간 구독
  subscribeConfig: (callback: (config: AssessmentConfig) => void): (() => void) => {
    if (firestoreDb) {
      const docRef = doc(firestoreDb, "config", "assessment");
      return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data() as AssessmentConfig);
        } else {
          // If no doc, write default and callback
          setDoc(docRef, DEFAULT_CONFIG).then(() => callback(DEFAULT_CONFIG));
        }
      }, (err) => {
        console.error("Firestore 설정 구독 오류:", err);
      });
    } else {
      // Mock Subscription
      callback(getMockConfig());

      const handleMessage = (e: MessageEvent) => {
        if (e.data?.type === "CONFIG_UPDATED") {
          callback(getMockConfig());
        }
      };

      const handleStorage = (e: StorageEvent) => {
        if (e.key === "focus_monitor_config") {
          callback(getMockConfig());
        }
      };

      if (typeof window !== "undefined") {
        broadcastChannel?.addEventListener("message", handleMessage);
        window.addEventListener("storage", handleStorage);
      }

      return () => {
        if (typeof window !== "undefined") {
          broadcastChannel?.removeEventListener("message", handleMessage);
          window.removeEventListener("storage", handleStorage);
        }
      };
    }
  },

  // 3. 학생 정보 수정
  updateStudent: async (id: string, updates: Partial<Student>): Promise<void> => {
    if (firestoreDb) {
      const docRef = doc(firestoreDb, "students", id);
      await updateDoc(docRef, updates);
    } else {
      const list = getMockStudents();
      const index = list.findIndex((s) => s.id === id);
      if (index !== -1) {
        list[index] = { ...list[index], ...updates };
        saveMockStudents(list);
      }
    }
  },

  // 4. 학생 추가 (입실)
  addStudent: async (student: Student): Promise<void> => {
    if (firestoreDb) {
      const docRef = doc(firestoreDb, "students", student.id);
      await setDoc(docRef, student);
    } else {
      const list = getMockStudents();
      // 중복 제거 후 추가
      const filtered = list.filter((s) => s.id !== student.id);
      filtered.push(student);
      saveMockStudents(filtered);
    }
  },

  // 5. 학생 퇴실
  removeStudent: async (id: string): Promise<void> => {
    if (firestoreDb) {
      const docRef = doc(firestoreDb, "students", id);
      await deleteDoc(docRef);
    } else {
      const list = getMockStudents();
      const filtered = list.filter((s) => s.id !== id);
      saveMockStudents(filtered);
    }
  },

  // 6. 교실 학생 초기화 (전원 퇴실)
  resetClassroom: async (): Promise<void> => {
    if (firestoreDb) {
      const studentsRef = collection(firestoreDb, "students");
      const snapshot = await getDocs(studentsRef);
      const batch = writeBatch(firestoreDb);
      snapshot.forEach((d) => {
        batch.delete(doc(firestoreDb, "students", d.id));
      });
      await batch.commit();
    } else {
      saveMockStudents([]);
    }
  },

  // 7. 설정 수정
  updateConfig: async (updates: Partial<AssessmentConfig>): Promise<void> => {
    if (firestoreDb) {
      const docRef = doc(firestoreDb, "config", "assessment");
      await setDoc(docRef, updates, { merge: true });
    } else {
      const config = getMockConfig();
      saveMockConfig({ ...config, ...updates });
    }
  }
};
