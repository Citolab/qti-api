import { ItemContext } from "@citolab/qti-components/exports/item.context.js";
import {
  Assessment,
  StudentResult,
  BaseSession,
  ItemStatisticsWithResponses,
  UniqueResponse,
  Delivery,
  PackageInfo,
  Session,
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
  getAssessments: () => Promise<Assessment[]>;
  getPackages: () => Promise<PackageInfo[]>;
  log: (type: string, data: any) => Promise<void>;

  // planning
  planStudents: (config: {
    count?: number;
    deliveryCodes: string[];
  }) => Promise<Session[]>;

  // delivery management
  createDelivery: (assessmentId: string) => Promise<Delivery>;
  stopDelivery: (deliveryCode: string) => Promise<Delivery>;
  startDelivery: (deliveryCode: string) => Promise<Delivery>;
  deleteDelivery: (deliveryCode: string) => Promise<void>;
  getAssessmentDeliveries: (assessmentId: string) => Promise<Delivery[]>;
  downloadResultsByDeliveryCode: (deliveryCode: string) => Promise<Blob>;
  downloadResultsByAssessmentId: (assessmentId: string) => Promise<Blob>;
  // session management
  deleteStudent: (code: string) => Promise<void>;
  resetSession: (code: string) => Promise<void>;
  reopenSession: (code: string) => Promise<void>;
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
  getAssessment: (assessmentId: string) => Promise<Assessment>;
  getStudentResults: <T extends ItemContext, T2 extends StudentResult<T>[]>(
    assessmentId: string
  ) => Promise<T2>;
  getStudentResultsByDelivery: <T extends ItemContext, T2 extends StudentResult<T>[]>(
    deliveryId: string
  ) => Promise<T2>;
  getSessions: () => Promise<Session[]>;
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
