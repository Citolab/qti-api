import {
  integer,
  ResponseInteraction,
} from "@citolab/qti-components/exports/expression-result.js";
import { ItemContext } from "@citolab/qti-components/exports/item.context.js";
import { TestContext } from "@citolab/qti-components/qti-test";
import { AxiosInstance } from "axios";

export enum SessionStateEnum {
  NOT_GENERATED = "not_generated",
  NOT_AVAILABLE = "not_available",
  NOT_STARTED = "not_started",
  STARTED = "started",
  COMPLETED = "completed",
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
  | "group_code";

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
  score: number;
  items: T[];
}

export interface UniqueResponse {
  id: string;
  value: string;
  count: number;
  studentIds: string[];
  score: number | null;
  scoreExternal: number | null;
}
export interface ItemStatistics {
  itemId: string;
  count: number;
  numberCorrect: number;
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
  endAt?: number;
  testScore?: number;
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
  endAt?: number;
  startCode?: string;
  settings?: AssessmentSettings;
}

export interface AssessmentSettings {
  forceFullScreen: boolean;
  responsive: boolean;
  backendScoring: boolean;
  studentIdentification: boolean;
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
  startedAt?: integer;
  completedAt?: integer;
  endTime?: integer;
  state: DeliveryStateEnum;
  canStop?: boolean;
  canRestart?: boolean;
  assessmentId: string;
}
