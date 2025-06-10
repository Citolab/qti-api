import { ResponseInteraction } from '@citolab/qti-components/exports/expression-result.js';
import { ItemContext } from '@citolab/qti-components/exports/item.context.js';
import { TestContext } from '@citolab/qti-components/qti-test/core';

export type SessionStateType =
  | 'not_generated'
  | 'not_available'
  | 'not_started'
  | 'started'
  | 'finished'
  | 'scored';

export type AuthenticationMethod =
  | 'anonymous'
  | 'code'
  | 'assessment'
  | 'group_code';

export interface ExtendedItemContext extends ItemContext {
  scoreType?: string;
}

export interface ExtendedTestContext extends Omit<TestContext, 'items'> {
  navPartId?: string | null;
  navSectionId?: string | null;
  navItemId?: string | null;
  navItemLoading?: boolean;
  navTestLoading?: boolean;
  state?: SessionStateType;
  items: ExtendedItemContext[];
}
export interface UserInfo {
  userId?: string;
  teacherId: string;
  code: string;
  appId: string;
  isDemo?: boolean;
  assessment?: AssessmentInfo | undefined;
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
export interface StudentAppSessionInfo extends UserInfo {
  currentAssessmentId?: string;
  sessions: {
    packageId: string;
    assessmentId: string;
    assessmentName: string;
    assessmentHref?: string;
    sessionState: SessionStateType;
    itemIds?: string[];
    canStart?: boolean;
    startFrom?: number;
    endAt?: number;
    startCode?: string;
  }[];
  testGroup?: 'experimental' | 'control';
}

export interface StudentResult<T extends ItemContext> {
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

export interface ItemStatisticsWithResponses extends ItemStatistics {
  responses: UniqueResponse[];
}

export interface Session {
  code: string;
  assessmentId: string;
  sessionState: SessionStateType;
}

export interface PlannedSessions<T extends Session> {
  code: string;
  identification?: string; // name or student id
  sessions: T[];
}

export interface SessionInfoTeacher extends Session {
  testScore: number;
}

// QTI PACKAGE MODEL
export interface PackageResource {
  type: 'test' | 'item' | 'manifest';
  identifier: string;
  path: string;
  content: string;
}

export type interactionType =
  | 'unknown'
  | 'inlineChoice'
  | 'choice'
  | 'textEntry'
  | 'extendedTextEntry'
  | 'info'
  | 'customInteraction'
  | 'matchInteraction';

export interface ItemInfo {
  identifier: string;
  title: string;
  href: string;
  categories: string[];
  type: 'regular' | 'info';
  interactionType?: interactionType;
  correctAnswer?: string;
  calamity?: boolean;
  thumbnail?: string;
  alternativeCount?: number;
  navNumber?: number;
  sequenceNumber?: number;
  maxScore?: number;
  weight?: number;
}

export interface ItemInfoWithContent extends ItemInfo {
  content: string;
}

// Define a type instead of an interface for this case
export type AssessmentItemRefInfo<T extends ItemInfo> = T & {
  itemRefIdentifier: string;
};

export interface AssessmentInfo {
  packageId: string;
  assessmentId: string;
  name: string;
  assessmentHref?: string;
  items?: AssessmentItemRefInfo<ItemInfoWithContent>[];
  isDemo?: boolean;
  teacherId?: string;
  packageName?: string;
  canStart?: boolean;
  startFrom?: number;
  endAt?: number;
  startCode?: string;
}

export interface AsssessmentResource extends PackageResource {
  type: 'test';
  items: ItemInfo[];
}

export interface AssessmentItemRef extends PackageResource {
  index: number;
}

export interface ItemResult {
  itemId: string;
  score: number;
  response: string;
  completionStatus: 'completed' | 'incomplete' | 'not_attempted' | 'unknown';
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

export interface PackageInfo {
  name: string;
  itemCount: number;
  qtiVersion: number;
  created: number;
  createdBy: string;
  createdByUsername: string;
  errorMessage: string;
  bucketname: string;
  assessments: QtiResource[];
  items: QtiResource[];
  packageZip: string;
}

export interface QtiResource {
  identifier: string;
  location: string;
}

export interface ApplicationInfo {
  name: string;
  demoCodes: string[];
  assessments: AssessmentInfo[];
}

export interface ApplicationInfoWithUsers extends ApplicationInfo {
  users: {
    id: string;
    email: string;
    password?: string;
  }[];
}

export interface EventLog {
  action: string;
  timestamp: number;
  parameters?: { [key: string]: string };
}

export interface CheckResponse {
  sentence: string;
  explanation: string;
  suggestion?: string;
  sentence_part: string;
}
