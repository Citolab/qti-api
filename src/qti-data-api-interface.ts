import {
  Assessment,
  ExtendedTestContext,
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
  log: (type: string, data: any) => Promise<void>;
  // TODO
  // authenticateByGroupCode: (
  //   code: string,
  //   metadata?: unknown
  // ) => Promise<StudentAppSessionInfo>;

  logout: () => void;
  logAction: (
    assessmentId: string,
    action: string,
    payload?: unknown
  ) => Promise<void>;
  getAssessment: (assessmentId: string) => Promise<Assessment>;
  getAssessments: () => Promise<Assessment[]>;
  setTestContext: (
    assessmentId: string,
    context: ExtendedTestContext
  ) => Promise<void>;
  setSessionState: (
    assessmentId: string,
    sessionState: SessionStateType
  ) => Promise<void>;
  getTestContext: (assessmentId: string) => Promise<ExtendedTestContext | null>;
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
