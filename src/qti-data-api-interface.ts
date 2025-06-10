import {
  AssessmentInfo,
  ItemInfoWithContent,
  StudentAppSessionInfo,
  ExtendedTestContext,
  SessionStateType,
} from './model';

export interface IQtiDataApi {
  apiIUrl: string;

  authenticateByCode: (code: string) => Promise<StudentAppSessionInfo>;
  authenticateByAssessmentCode: (config: {
    code: string;
    identification?: string;
    metadata?: unknown;
  }) => Promise<StudentAppSessionInfo>;
  authenticateAnonymously: () => Promise<StudentAppSessionInfo>;

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
  getItemsByAssessmentId: (
    packageId: string,
    assessmentId: string
  ) => Promise<ItemInfoWithContent[]>;
  getAssessmentByCode: (code: string) => Promise<AssessmentInfo>;
  getAssessment: (assessmentId: string) => Promise<AssessmentInfo>;
  getAssessments: () => Promise<AssessmentInfo[]>;
  setTestContext: (
    assessmentId: string,
    context: ExtendedTestContext
  ) => Promise<void>;
  setSessionState: (
    assessmentId: string,
    sessionState: SessionStateType
  ) => Promise<void>;
  getTestContext: (assessmentId: string) => Promise<ExtendedTestContext | null>;
  getStudentSessionInfo: (code: string) => Promise<StudentAppSessionInfo>;
}
