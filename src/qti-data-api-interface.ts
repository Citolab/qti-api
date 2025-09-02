import {
  Assessment,
  AuthStatus,
  ExtendedTestContext,
  LogEntry,
  Session,
  UserInfoWithToken,
} from "./model";

export interface IQtiDataApi {
  apiUrl: string;
  userInfo?: UserInfoWithToken;
  authenticateByCode: (code: string) => Promise<Session>;
  authenticateByDeliveryCode: (config: {
    code: string;
    identification?: string;
    metadata?: unknown;
  }) => Promise<Session>;
  authenticateAnonymously: () => Promise<AuthStudentResult>;
  log: (type: string, entry: LogEntry) => Promise<void>;
  logout: () => void;
  logAction: (
    assessmentId: string,
    action: string,
    payload?: unknown
  ) => Promise<void>;
  getAssessment: (assessmentId: string) => Promise<Assessment>;
  getAssessments: () => Promise<Assessment[]>;
  setTestContext: (code: string, context: ExtendedTestContext) => Promise<void>;
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
  getAuthStatus(): AuthStatus;
  markSessionExpired(): void;
  logout(): void;
}

export interface AuthStudentResult {
  idToken: string;
  localId: string;
  refreshToken: string;
  expiresIn?: number;
}
