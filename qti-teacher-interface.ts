import { ItemContext } from '@citolab/qti-components/exports/item.context.js';
import {
  PlannedSessions,
  AssessmentInfo,
  ItemInfoWithContent,
  StudentResult,
  SessionInfoTeacher,
  Session,
  ItemStatisticsWithResponses,
} from './model';

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
  getItemsForApplication: () => Promise<ItemInfoWithContent[]>;
  getItemsByAssessmentId: (
    assessmentId: string
  ) => Promise<ItemInfoWithContent[]>;

  // planning
  planStudents: (config: {
    count?: number;
    assessmentIds?: string[];
  }) => Promise<PlannedSessions<SessionInfoTeacher>[]>;

  planStudentsByIdentification: (config: {
    identifiers: string[];
    assessmentIds?: string[];
  }) => Promise<PlannedSessions<SessionInfoTeacher>[]>;
  deleteStudent: (code: string) => Promise<void>;
  resetSession: (code: string, assessmentId: string) => Promise<void>;
  addStudentId: (code: string, studentId: string) => Promise<void>;
  updateSession: (
    code: string,
    assessmentId: string,
    session: Session
  ) => Promise<void>;
  getItemStats<T extends ItemStatisticsWithResponses>(
    itemIdentifiers: string[],
    target: 'teacher' | 'reviewer'
  ): Promise<T[]>;

  updateItemStatResponseScore: (
    itemIdentifier: string,
    responseId: string,
    score: number,
    target: 'teacher' | 'reviewer'
  ) => Promise<void>;

  getAssessmentInfo: (assessmentId: string) => Promise<AssessmentInfo>;

  getStudentResults: <T extends ItemContext, T2 extends StudentResult<T>[]>(
    assessmentId: string
  ) => Promise<T2>;

  getPlannedSessions: () => Promise<PlannedSessions<SessionInfoTeacher>[]>;
}
