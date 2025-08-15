import { ItemContext } from "@citolab/qti-components/exports/item.context.js";
import {
  PlannedTestset,
  Assessment,
  StudentResult,
  BaseSession,
  ItemStatisticsWithResponses,
  UniqueResponse,
  Delivery,
  PackageInfo,
  PlannedSession,
} from "./model";
import { AxiosInstance } from "axios";

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
  getTestsForApplication: () => Promise<Assessment[]>;
  getPackagesForApplication: () => Promise<PackageInfo[]>;
  log: (type: string, data: any) => Promise<void>;

  // planning
  planStudents: (config: {
    count?: number;
    assessmentIds?: string[];
  }) => Promise<PlannedSession[]>;
  planStudentsByIdentification: (config: {
    identifiers: string[];
    assessmentIds?: string[];
  }) => Promise<PlannedSession[]>;

  // delivery management
  createGroupDelivery: (assessmentId: string) => Promise<{
    groupCode: string;
  }>;
  stopGroupDelivery: (deliveryCode: string) => Promise<{
    code: string;
    finishedAt: number;
  }>;
  restartGroupDelivery: (deliveryCode: string) => Promise<{
    code: string;
    startedAt: number;
    state: string;
  }>;
  getGroupDeliveries: (assessmentId: string) => Promise<Delivery[]>;
  downloadResults: (
    assessmentId: string,
    deliveryCode?: string
  ) => Promise<Blob>;

  // session management
  deleteStudent: (code: string) => Promise<void>;
  resetSession: (code: string, assessmentId: string) => Promise<void>;
  addStudentIdentification: (
    code: string,
    identification: string
  ) => Promise<void>;

  updateSession: (
    code: string,
    assessmentId: string,
    session: BaseSession
  ) => Promise<void>;

  // statistics and results
  getItemStats<T extends ItemStatisticsWithResponses<UniqueResponse>>(
    assessmentId: string,
    target: "teacher" | "reviewer"
  ): Promise<T[]>;
  updateItemStatResponseScore: (
    itemIdentifier: string,
    assessmentId: string,
    responseId: string,
    score: number | null,
    target: "teacher" | "reviewer"
  ) => Promise<void>;

  // assessment info
  getAssessmentInfo: (assessmentId: string) => Promise<Assessment>;
  getAssessmentInfoByGroupCode: (groupCode: string) => Promise<Assessment>;
  getStudentResults: <T extends ItemContext, T2 extends StudentResult<T>[]>(
    assessmentId: string
  ) => Promise<T2>;
  getPlannedSessions: () => Promise<PlannedSession[]>;
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
