import {
  Assessment,
  ExtendedTestContext,
  LogEntry,
  Session,
  SessionStateType,
} from "./model";

export interface IQtiDataApi {
  apiUrl: string;

  authenticateByCode: (code: string) => Promise<Session>;
  authenticateByDeliveryCode: (config: {
    code: string;
    identification?: string;
    metadata?: unknown;
  }) => Promise<Session>;
  authenticateAnonymously: () => Promise<AuthStudentResult>;
  logWithoutSession: (type: string, data: LogEntry) => Promise<void>;
  logForSession: (type: string, entry: LogEntry) => Promise<void>;
  logout: () => void;
  logAction: (
    assessmentId: string,
    action: string,
    payload?: unknown
  ) => Promise<void>;
  getAssessment: (assessmentId: string) => Promise<Assessment>;
  getAssessments: () => Promise<Assessment[]>;
  setTestContext: (code: string, context: ExtendedTestContext) => Promise<void>;
  setSessionState: (
    code: string,
    sessionState: SessionStateType
  ) => Promise<void>;
  getTestContext: (code: string) => Promise<ExtendedTestContext | null>;
  getStudentSessionInfo: (code: string) => Promise<Session>;
  updateStudentSessionInfo: (
    id: string,
    data: Partial<Session>
  ) => Promise<void>;
}

// Define authentication provider interface
export interface IAuthStudentProvider {
  authenticate(): Promise<AuthStudentResult>;
  refreshToken(refreshToken: string): Promise<AuthStudentResult>;
  getProviderId(): string;
}

export interface AuthStudentResult {
  idToken: string;
  localId: string;
  refreshToken: string;
}
