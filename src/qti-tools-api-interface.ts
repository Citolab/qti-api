// Import AssessmentInfo from your existing model
import {
  Assessment,
  AssessmentSettings,
  DeleteResult,
  PackageInfo,
  PackagesListResult,
  UploadResult,
} from "./model";

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
  getPackages: () => Promise<PackagesListResult>;
  deletePackage: (packageId: string) => Promise<DeleteResult>;
  getPackageInfo: (packageId: string) => Promise<PackageInfo>;

  // Assessment settings methods (if needed for tools API)
  getAssessmentSettings?: (assessmentId: string) => Promise<void>;
  updateAssessmentSettings?: (
    assessmentId: string,
    settings: AssessmentSettings
  ) => Promise<void>;
}
