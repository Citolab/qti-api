import {
  Assessment,
  AuthStatus,
  ExtendedTestContext,
  LogEntry,
  Session,
  TestsetSession,
  TestsetResult,
  UserInfo,
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
  authenticateByTestsetCode: (config: {
    code: string;
    identification?: string;
    metadata?: unknown;
  }) => Promise<TestsetSession>;
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
  getCurrentUser: () => Promise<UserInfo | null>;
  getStudentSessionInfo: (code: string) => Promise<Session>;
  scoreItems: (code: string) => Promise<ExtendedTestContext>;
  updateStudentSessionInfo: (
    id: string,
    data: Partial<Session>
  ) => Promise<void>;
  // Testset-related methods
  getTestsetSession: (code: string) => Promise<TestsetSession>;
  getTestsetResult: (testsetSessionId: string) => Promise<TestsetResult>;
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
