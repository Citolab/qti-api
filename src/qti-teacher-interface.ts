import { ItemContext } from "@citolab/qti-components/exports/item.context.js";
import {
  PlannedSessions,
  AssessmentInfo,
  ItemInfo,
  StudentResult,
  SessionInfoTeacher,
  Session,
  ItemStatisticsWithResponses,
  SessionStateType,
} from "./model";

export interface IQtiTeacherApi {
  // token
  token: string;
  // authentication
  authenticate: (
    email: string,
    password: string
  ) => Promise<{
    idToken: string;
  } | null>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{
    idToken: string;
  }>;
  passwordReset: (email: string) => Promise<void>;
  logout: () => void;
  getLoggedInUser: () => Promise<{
    displayName: string;
    email: string;
    localId: string;
  } | null>;

  // assessment packages
  getTestsForApplication: () => Promise<AssessmentInfo[]>;
  log: (type: string, data: any) => Promise<void>;
  // planning
  planStudents: (config: {
    count?: number;
    assessmentIds?: string[];
  }) => Promise<PlannedSessions<SessionInfoTeacher>[]>;
  planStudentsByIdentification: (config: {
    identifiers: string[];
    assessmentIds?: string[];
  }) => Promise<PlannedSessions<SessionInfoTeacher>[]>;
  createGroupDelivery: (assessmentId: string) => Promise<{
    groupDeliveryCode: string;
  }>;
  deleteStudent: (code: string) => Promise<void>;
  resetSession: (code: string, assessmentId: string) => Promise<void>;
  addStudentIdentification: (
    code: string,
    identification: string
  ) => Promise<void>;
  updateSession: (
    code: string,
    assessmentId: string,
    session: Session
  ) => Promise<void>;
  getItemStats<T extends ItemStatisticsWithResponses>(
    assessmentId: string,
    target: "teacher" | "reviewer"
  ): Promise<T[]>;
  updateItemStatResponseScore: (
    itemIdentifier: string,
    assessmentId: string,
    responseId: string,
    score: number,
    target: "teacher" | "reviewer"
  ) => Promise<void>;

  getAssessmentInfo: (assessmentId: string) => Promise<AssessmentInfo>;
  getAssessmentInfoByGroupCode: (groupCode: string) => Promise<AssessmentInfo>;
  getStudentResults: <T extends ItemContext, T2 extends StudentResult<T>[]>(
    assessmentId: string
  ) => Promise<T2>;

  getPlannedSessions: () => Promise<PlannedSessions<SessionInfoTeacher>[]>;
}

export interface ITeacherAuthProvider {
  /**
   * Authenticate with email and password
   */
  authenticate(email: string, password: string): Promise<TeacherAuthResult>;

  /**
   * Sign up a new user
   */
  signUp(email: string, password: string): Promise<TeacherAuthResult>;

  /**
   * Send password reset email
   */
  passwordReset(email: string): Promise<void>;

  /**
   * Get logged in user information
   */
  getLoggedInUser(token: string): Promise<TeacherUserInfo | null>;

  /**
   * Refresh expired tokens
   */
  refreshToken(refreshToken: string): Promise<TeacherAuthResult>;

  /**
   * Get provider-specific identifier
   */
  getProviderId(): string;
}

export interface TeacherAuthResult {
  idToken: string;
  refreshToken?: string;
  localId?: string;
}

export interface TeacherUserInfo {
  displayName: string;
  email: string;
  localId: string;
}
