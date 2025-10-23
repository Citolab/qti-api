import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";

import { ITeacherAuthProvider } from "./qti-teacher-interface.js";
import { getRefreshTokenAndRetry } from "./utils.js";
import { IQtiToolsApi } from "./qti-tools-api-interface.js";
import {
  Assessment,
  AssessmentSettings,
  AxiosInstanceConfig,
  DeleteResult,
  PackageInfo,
  PackagesListResult,
  UploadResult,
} from "./model.js";

export class QtiToolsApi implements IQtiToolsApi {
  private failedRequests = 0;
  public axios: AxiosInstance = {} as AxiosInstance;
  private _token = "";
  private _refreshToken = "";
  public apiUrl: string;
  private authProvider: ITeacherAuthProvider;
  private axiosError?: (error: AxiosError) => void;
  private admin = false;
  private checkAccess = true;
  private externalAxiosConfig?: AxiosInstanceConfig;

  constructor(
    public options: {
      apiUrl: string;
      authProvider: ITeacherAuthProvider;
      axiosError?: (error: AxiosError) => void;
      admin?: boolean;
      checkAccess?: boolean;
      // New option for external axios configuration
      axiosConfig?: AxiosInstanceConfig;
    }
  ) {
    const {
      apiUrl,
      authProvider,
      axiosError,
      admin,
      checkAccess,
      axiosConfig,
    } = options;
    this.apiUrl = apiUrl;
    this.authProvider = authProvider;
    this.externalAxiosConfig = axiosConfig;

    if (axiosError) {
      this.axiosError = axiosError;
    }
    if (admin) {
      this.admin = admin;
    }
    if (checkAccess !== undefined && checkAccess !== null) {
      this.checkAccess = checkAccess;
    }
    this.createAxiosInstance();
  }

  get token() {
    if (this._token) return this._token;
    if (typeof localStorage !== "undefined") {
      const token =
        localStorage.getItem(
          `tools-token-${this.authProvider.getProviderId()}`
        ) || "";
      return token;
    }
    return "";
  }

  set token(value: string) {
    if (value) {
      if (value === this._token) return;
      this._token = value;
      this.createAxiosInstance();
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          `tools-token-${this.authProvider.getProviderId()}`,
          value
        );
      }
    }
  }

  get refreshToken() {
    if (this._refreshToken) return this._refreshToken;
    if (typeof localStorage !== "undefined") {
      const token =
        localStorage.getItem(`tools-t2-${this.authProvider.getProviderId()}`) ||
        "";
      return token;
    }
    return "";
  }

  set refreshToken(value: string) {
    if (value) {
      this._refreshToken = value;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          `tools-t2-${this.authProvider.getProviderId()}`,
          value
        );
      }
    }
  }

  // Clear all tokens and reset state
  public clearTokensAndReset(): void {
    this._token = "";
    this._refreshToken = "";
    this.failedRequests = 0;

    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(
        `tools-token-${this.authProvider.getProviderId()}`
      );
      localStorage.removeItem(`tools-t2-${this.authProvider.getProviderId()}`);
    }

    this.createAxiosInstance();
  }

  private createAxiosInstance() {
    if (this.externalAxiosConfig?.instance) {
      // Use external axios instance
      this.axios = this.externalAxiosConfig.instance;

      // Add our QTI interceptors (they will be additive unless explicitly clearing)
      this.addQtiInterceptors();
    } else {
      // Create new axios instance (original behavior)
      this.axios = axios.create({
        baseURL: this.apiUrl,
      });
      // Always add QTI interceptors for new instances
      this.addQtiInterceptors();
    }
  }

  private addQtiInterceptors() {
    const shouldClearInterceptors =
      this.externalAxiosConfig?.clearInterceptors === true;

    if (shouldClearInterceptors) {
      // Only clear if explicitly requested
      this.axios.interceptors.request.clear();
      this.axios.interceptors.response.clear();
    }

    // Request interceptor for QTI-specific headers
    this.axios.interceptors.request.use((config) => {
      if (this.token) {
        config.headers["Authorization"] = `Bearer ${this.token}`;
      }
      if (this.admin) {
        config.headers["x-admin"] = "true";
      }
      return config;
    });

    // Response interceptor for data unwrapping (additive)
    this.axios.interceptors.response.use(
      (resp) => {
        const d = resp.data;
        if (d && typeof d === "object" && "data" in d) {
          // Check if the API response indicates failure
          if ("success" in d && d.success === false) {
            // Throw an error with the API's message
            const errorMessage = d.message || "API request failed";
            throw new Error(errorMessage);
          }

          // Only unwrap if success is true (or success field doesn't exist)
          if (!("success" in d) || d.success === true) {
            return { ...resp, data: (d as any).data };
          }
        }
        return resp;
      },
      (err) => Promise.reject(err)
    );

    if (this.externalAxiosConfig?.addAuthenticationInterceptors !== false) {
      // Authentication error handling interceptor (additive, but can be disabled)
      this.axios.interceptors.response.use(
        (response) => {
          this.failedRequests = 0;
          return response;
        },
        async (error: AxiosError) => {
          if (
            (error.response?.status === 403 ||
              error.response?.status === 401) &&
            this.refreshToken &&
            this.failedRequests === 0
          ) {
            this.failedRequests++;
            const originalRequest = error.config;

            return getRefreshTokenAndRetry(
              originalRequest as AxiosRequestConfig & { _retry?: boolean },
              error,
              this.axios,
              async () => {
                const authResult = await this.authProvider.refreshToken(
                  this.refreshToken
                );
                this.token = authResult.idToken;
                if (authResult.refreshToken) {
                  this.refreshToken = authResult.refreshToken;
                }
                return authResult;
              },
              (retryError: AxiosError) => {
                if (
                  retryError.response?.status === 401 ||
                  retryError.response?.status === 403
                ) {
                  this.clearTokensAndReset();
                }
                if (this.axiosError) {
                  this.axiosError(retryError);
                }
              }
            );
          }
          if (this.axiosError) {
            this.axiosError(error);
          }
          return Promise.reject(error);
        }
      );
    }
  }

  // Authentication methods
  public async authenticate(email: string, password: string) {
    try {
      const authResult = await this.authProvider.authenticate(email, password);

      let headers = {
        Authorization: "Bearer " + authResult.idToken,
      };

      if (this.admin) {
        headers = { ...(headers as any), "x-admin": "true" };
      }

      // Create temporary axios instance to check access
      const tempAxios = axios.create({
        baseURL: this.apiUrl,
        headers,
      });

      // Check if the user has rights to access the application
      let hasAccess = true;
      if (this.checkAccess) {
        const accessResult = await tempAxios.post(`/access`);
        hasAccess = !!accessResult.data?.hasAccess;
      }

      if (hasAccess) {
        this.token = authResult.idToken;
        if (authResult.refreshToken) {
          this.refreshToken = authResult.refreshToken;
        }
        return authResult;
      } else {
        console.error("no access to tools");
        return null;
      }
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  public async signUp(email: string, password: string) {
    const result = await this.authProvider.signUp(email, password);
    return result;
  }

  public async passwordReset(email: string) {
    await this.authProvider.passwordReset(email);
  }

  public async getLoggedInUser() {
    try {
      const user = await this.authProvider.getLoggedInUser(this.token);
      return user;
    } catch (error) {
      console.error(error);
      if (
        error instanceof AxiosError &&
        (error.response?.status === 401 || error.response?.status === 400)
      ) {
        this.clearTokensAndReset();
      }
      return null;
    }
  }

  logout() {
    this.clearTokensAndReset();
  }

  // Package management methods
  async uploadPackage(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await this.axios.post("/upload", formData, {
      timeout: 60000, // 60 seconds timeout
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(progress);
        }
      },
    });

    return {
      success: true,
      data: response.data,
      message: "Package uploaded successfully",
    };
  }

  async getPackages(): Promise<PackagesListResult> {
    const response = await this.axios.get<PackageInfo[]>("/packages");
    return {
      success: true,
      data: response.data,
    };
  }

  async deletePackage(packageId: string): Promise<DeleteResult> {
    await this.axios.delete(`/package/${packageId}`);
    return {
      success: true,
      message: "Package deleted successfully",
    };
  }

  async getPackageInfo(packageId: string): Promise<PackageInfo> {
    const response = await this.axios.get<PackageInfo>(`/package/${packageId}`);
    return response.data;
  }

  async updateAssessmentSettings(
    assessmentId: string,
    settings: AssessmentSettings
  ): Promise<any> {
    await this.axios.post(`/assessment/${assessmentId}/settings`, settings, {
      timeout: 60000, // 60 seconds timeout for potential reprocessing
    });
    return;
  }

  // Feedback submission method
  async submitFeedback(
    feedbackData: {
      type: string;
      description: string;
      feedbackId: string;
      email?: string;
      pageUrl?: string;
    },
    screenshot?: File
  ): Promise<{ success: boolean; message: string }> {
    const formData = new FormData();

    // Add required fields
    formData.append("type", feedbackData.type);
    formData.append("description", feedbackData.description);
    formData.append("feedbackId", feedbackData.feedbackId);

    // Add optional fields
    if (feedbackData.email) {
      formData.append("email", feedbackData.email);
    }
    if (feedbackData.pageUrl) {
      formData.append("pageUrl", feedbackData.pageUrl);
    }

    // Add screenshot if provided
    if (screenshot) {
      formData.append("screenshot", screenshot);
    }

    const response = await this.axios.post("/feedback", formData, {
      timeout: 30000, // 30 seconds timeout
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  }
}
