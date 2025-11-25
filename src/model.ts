import type {
  ItemContext,
  ResponseInteraction,
  TestContext,
} from "./types/qti-components.js";
import { AxiosInstance } from "axios";

export enum SessionStateEnum {
  NOT_GENERATED = "not_generated",
  NOT_AVAILABLE = "not_available",
  NOT_STARTED = "not_started",
  STARTED = "started",
  FINISHED = "finished",
  SCORED = "scored",
}

export type SessionStateType = `${SessionStateEnum}`;

export enum DeliveryStateEnum {
  NOT_STARTED = "not_started",
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export type DeliveryStateType = `${DeliveryStateEnum}`;

export type AuthenticationMethod =
  | "anonymous"
  | "code"
  | "assessment"
  | "group_code"
  | "testset_code";

export interface ObjectBase {
  id: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface ExtendedItemContext extends ItemContext {
  scoreType?: string;
}

export interface ExtendedTestContext extends Omit<TestContext, "items"> {
  navPartId?: string | null;
  navSectionId?: string | null;
  navItemId?: string | null;
  navItemLoading?: boolean;
  navTestLoading?: boolean;
  state?: SessionStateType;
  items: ExtendedItemContext[];
}

export interface UserInfoWithToken extends UserInfo {
  token: string;
  refreshToken: string;
  authenticationMethod?: AuthenticationMethod;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  userId: string | null;
  token: string | null;
  expiresIn: number | null;
  isSessionExpired: boolean;
}

export interface UserInfo {
  userId?: string;
  teacherId: string;
  code?: string;
  deliveryCode?: string;
  testsetSessionCode?: string; // Code for testset session
  isDemo?: boolean;
  identification?: string; // name or student id
  password?: string;
}

export interface ItemResponse {
  itemId: string;
  outcomes: {
    score: number;
    isCorrect: boolean;
  } | null;
  interactionResponses: ResponseInteraction[] | null;
  isValid: boolean;
}

export interface StudentResult<T extends ItemContext> {
  sessionId: string;
  deliveryId: string;
  identification?: string;
  assessmentId: string;
  code: string;
  state?: SessionStateType;
  score: number;
  items: T[];
}

export interface UniqueResponse {
  id: string;
  responseIdentifier: string;
  value: string;
  count: number;
  sessionIds: string[];
  responseIds: string[];
  score: number | null;
  scoreExternal: number | null;
}
export interface ItemStatistics {
  itemId: string;
  responseIdentifier: string;
  count: number;
  numberCorrect: number;
}

export interface BaseStatistics {
  lastUpdated: number;
  itemStatistics: ItemStatisticsWithResponses<UniqueResponse>[];
}

export interface AssessmentStatistics extends BaseStatistics {
  assessmentId: string;
  assessmentName: string;
}

export interface DeliveryStatistics extends AssessmentStatistics {
  deliveryId: string;
  deliveryCode: string;
}

export interface ItemStatisticsWithResponses<
  ResponseType extends UniqueResponse
> extends ItemStatistics {
  responses: ResponseType[];
}

export interface BaseSession extends ObjectBase {
  code: string;
  teacherId: string;
  deliveryId: string;
  assessmentId: string;
  sessionState: SessionStateType;
  identification?: string;
}

export interface Session extends BaseSession {
  packageId: string;
  assessmentName: string;
  assessmentHref?: string;
  isDemo?: boolean;
  itemIds?: string[];
  canStart?: boolean;
  startFrom?: number;
  password?: string;
  endedAt?: number;
  testScore?: number;
  testsetSessionId?: string; // Reference to parent testset session if part of a testset
  sequenceInTestset?: number; // Order within the testset (0-based)
}

// QTI PACKAGE MODEL
export interface PackageResource {
  type: "test" | "item" | "manifest";
  identifier: string;
  path: string;
  content: string;
}

export type interactionType =
  | "unknown"
  | "inlineChoice"
  | "choice"
  | "textEntry"
  | "extendedTextEntry"
  | "info"
  | "customInteraction"
  | "matchInteraction";

export interface ItemInfo {
  identifier: string;
  title: string;
  href: string;
  categories: string[];
  type: "regular" | "info";
  interactionType?: interactionType;
  correctAnswer?: string;
  calamity?: boolean;
  thumbnail?: string;
  alternativeCount?: number;
  completionStatus?: "completed" | "incomplete" | "not_attempted" | "unknown";
  navNumber?: number;
  sequenceNumber?: number;
  maxScore?: number;
  weight?: number;
  manualScoringRequired?: boolean;
  plausibleAnswers?: GeneratedAnswer[];
}

// Define a type instead of an interface for this case
export type AssessmentItemRefInfo<T extends ItemInfo> = T & {
  itemRefIdentifier: string;
};

export interface AssessmentBasicInfo {
  packageId: string;
  name: string;
}

export interface Assessment extends AssessmentBasicInfo, ObjectBase {
  assessmentHref?: string;
  items: AssessmentItemRefInfo<ItemInfo>[];
  isDemo?: boolean;
  demoCode?: string;
  teacherId?: string;
  packageName?: string;
  canStart?: boolean;
  startFrom?: number;
  endedAt?: number;
  startCode?: string;
  isDigital?: boolean;
  settings?: AssessmentSettings;
}

export interface GeneratedAnswer {
  id?: number;
  answerText: string;
  score: number;
  certainty?: number;
  notes?: string | null;
  correctedScore?: number | null;
}

export interface PlausibleAnswer extends ObjectBase {
  assessmentId: string;
  itemIdentifier: string;
  generatedAnswers: GeneratedAnswer[];
  generatedAt: number;
}

export interface PlausibleAnswerScoreUpdate {
  id?: number;
  answerText?: string;
  correctedScore: number | null;
}

export interface AssessmentSettings {
  forceFullScreen: boolean;
  responsive: boolean;
  backendScoring: boolean;
  studentIdentification: "number" | "name" | "none";
  identificationRegex?: string | null;
  dimensions?: { width: number; height: number } | null;
}

export interface AsssessmentResource extends PackageResource {
  type: "test";
  items: ItemInfo[];
}

export interface AssessmentItemRef extends PackageResource {
  index: number;
}

export interface ItemResult {
  itemId: string;
  score: number;
  response: string;
  completionStatus: "completed" | "incomplete" | "not_attempted" | "unknown";
}

export interface Item extends QtiResource {
  packageId: string;
  packageZip: string;
  created: number;
  createdBy: string;
  createdByUsername: string;
  draft: boolean;
  isDeleted: boolean;
}

export interface PackageInfo extends ObjectBase {
  id: string;
  name: string;
  itemCount: number;
  qtiVersion: number;
  errorMessage: string;
  bucketname: string;
  downloadUrl?: string;
  downloadUrlQti3?: string;
  assessments: Assessment[];
  packageZip: string;
}

export interface QtiResource {
  identifier: string;
  location: string;
}

export interface ApplicationInfo {
  name: string;
  demoCodes: string[];
  assessments: Assessment[];
}

export interface ApplicationInfoWithUsers extends ApplicationInfo {
  users: {
    id: string;
    email: string;
    password?: string;
  }[];
}

export interface LogEntry extends ObjectBase {
  type: string;
  data: any;
  teacherId?: string;
  deliveryId?: string;
  code?: string;
}
export interface CheckResponse {
  sentence: string;
  explanation: string;
  suggestion?: string;
  sentence_part: string;
}

export type AxiosInstanceConfig = {
  instance?: AxiosInstance;
  clearInterceptors?: boolean;
  addAuthenticationInterceptors?: boolean;
};

export interface UploadResult {
  success: boolean;
  data: PackageInfo;
  message: string;
}

export interface PackagesListResult {
  success: boolean;
  data: PackageInfo[];
}

export interface DeleteResult {
  success: boolean;
  message: string;
}

export interface Delivery extends ObjectBase {
  startedAt?: number;
  endedAt?: number;
  state: DeliveryStateEnum;
  canStop?: boolean;
  canRestart?: boolean;
  assessmentId: string;
  name?: string;
}

export enum TestsetStateEnum {
  NOT_STARTED = "not_started",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  PAUSED = "paused",
}

export type TestsetStateType = `${TestsetStateEnum}`;

export interface Testset extends ObjectBase {
  name: string;
  description?: string;
  teacherId: string;
  assessmentIds: string[];
  assessments?: Assessment[]; // Optional populated assessments
  isActive: boolean;
  isDemo?: boolean;
}

export interface TestsetSession extends ObjectBase {
  code: string;
  testsetId: string;
  testset?: Testset; // Optional populated testset
  teacherId: string;
  identification?: string; // student name or id
  firstname?: string;
  lastname?: string;
  state: TestsetStateType;
  sessionIds: string[]; // references to individual assessment sessions
  sessions?: Session[]; // Optional populated sessions
  currentSessionIndex?: number; // which assessment is currently active
  password?: string; // Optional password for the session
  startedAt?: number;
  endedAt?: number;
  isDemo?: boolean;
}

export interface TestsetResult {
  testsetSessionId: string;
  testsetId: string;
  identification?: string;
  state: TestsetStateType;
  sessions: Session[];
}

export interface ItemWithScores {
  identifier: string;
  response: string;
  score: number;
}
