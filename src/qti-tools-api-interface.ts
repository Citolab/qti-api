// Import AssessmentInfo from your existing model
import {
  Assessment,
  AssessmentSettings,
  DeleteResult,
  PackageInfo,
  PackagesListResult,
  PlausibleAnswer,
  PlausibleAnswerScoreUpdate,
  UploadResult,
} from "./model.js";

export interface IQtiToolsApi {
  // Authentication token
  token: string;

  // Authentication methods
  authenticate: (
    email: string,
    password: string
  ) => Promise<{ idToken: string } | null>;
  signUp: (email: string, password: string) => Promise<{ idToken: string }>;
  passwordReset: (email: string) => Promise<void>;
  logout: () => void;
  getLoggedInUser: () => Promise<{
    displayName: string;
    email: string;
    localId: string;
  } | null>;

  // Package management methods
  uploadPackage: (
    file: File,
    onProgress?: (progress: number) => void
  ) => Promise<UploadResult>;
  updateAssessmentSettings: (
    assessmentId: string,
    settings: AssessmentSettings
  ) => Promise<void>;
  getPackages: () => Promise<PackagesListResult>;
  deletePackage: (packageId: string) => Promise<DeleteResult>;
  getPackageInfo: (packageId: string) => Promise<PackageInfo>;

  // Plausible answers
  getPlausibleAnswers: (assessmentId: string) => Promise<PlausibleAnswer[]>;
  getPlausibleAnswersForItem: (
    assessmentId: string,
    itemIdentifier: string
  ) => Promise<PlausibleAnswer>;
  updatePlausibleAnswerScores: (
    assessmentId: string,
    itemIdentifier: string,
    updates: PlausibleAnswerScoreUpdate[]
  ) => Promise<PlausibleAnswer>;
  getPlausibleAnswerProgress: (
    assessmentId: string
  ) => Promise<{
    pending: boolean;
    totalItems: number;
    completedItems: number;
    pendingItems: number;
  }>;
  getPlausibleAnswerCheckedStatus: (
    assessmentId: string
  ) => Promise<{
    checked: boolean;
    totalItems: number;
    checkedItems: number;
  }>;

  // Feedback submission
  submitFeedback: (
    feedbackData: {
      type: string;
      description: string;
      feedbackId: string;
      email?: string;
      pageUrl?: string;
    },
    screenshot?: File
  ) => Promise<{ success: boolean; message: string }>;
}
