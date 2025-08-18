import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import {
  Assessment,
  StudentResult,
  BaseSession,
  ItemStatisticsWithResponses,
  UniqueResponse,
  Delivery,
  AxiosInstanceConfig,
  PackageInfo,
  Session,
} from "./model";
import { IQtiTeacherApi, ITeacherAuthProvider } from "./qti-teacher-interface";
import {
  getNewToken,
  getRefreshTokenAndRetry,
  removeDoubleSlashes,
} from "./utils";
import { ItemContext } from "@citolab/qti-components/exports/item.context.js";

export class QtiTeacherApi implements IQtiTeacherApi {
  private failedRequests = 0;
  public axios: AxiosInstance = {} as AxiosInstance;
  private _token = "";
  private _refreshToken = "";
  public apiUrl: string;
  private appId: string;
  private authProvider: ITeacherAuthProvider;
  private axiosError?: (error: AxiosError) => void;
  private admin = false;
  private checkAccess = true;
  private externalAxiosConfig?: AxiosInstanceConfig;

  constructor(
    public options: {
      apiIUrl: string;
      appId: string;
      authProvider: ITeacherAuthProvider;
      axiosError?: (error: AxiosError) => void;
      admin?: boolean;
      checkAccess?: boolean;
      // New option for external axios configuration
      axiosConfig?: AxiosInstanceConfig;
    }
  ) {
    const {
      apiIUrl,
      appId,
      authProvider,
      axiosError,
      admin,
      checkAccess,
      axiosConfig,
    } = options;

    this.apiUrl = apiIUrl;
    this.appId = appId;
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
        localStorage.getItem(`token-${this.authProvider.getProviderId()}`) ||
        "";
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
          `token-${this.authProvider.getProviderId()}`,
          value
        );
      }
    }
  }

  get refreshToken() {
    if (this._refreshToken) return this._refreshToken;
    if (typeof localStorage !== "undefined") {
      const token =
        localStorage.getItem(`t2-${this.authProvider.getProviderId()}`) || "";
      return token;
    }
    return "";
  }

  set refreshToken(value: string) {
    if (value) {
      this._refreshToken = value;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(`t2-${this.authProvider.getProviderId()}`, value);
      }
    }
  }

  // Clear all tokens and reset state
  public clearTokensAndReset(): void {
    // Clear internal state
    this._token = "";
    this._refreshToken = "";
    this.failedRequests = 0;

    // Clear localStorage
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(`token-${this.authProvider.getProviderId()}`);
      localStorage.removeItem(`t2-${this.authProvider.getProviderId()}`);
      localStorage.removeItem("qti-firestore");
    }

    // Recreate axios instance without tokens
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
      const config: any = {
        baseURL: this.apiUrl,
      };

      this.axios = axios.create(config);
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
      // Add QTI-specific headers (these are additive and won't conflict with auth)
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      if (this.appId) {
        config.headers["x-app"] = this.appId;
      }
      if (this.admin) {
        config.headers["x-admin"] = "true";
      }
      return config;
    });

    if (this.externalAxiosConfig?.addAuthenticationInterceptors) {
      // Response interceptor for QTI-specific token refresh and error handling
      this.axios.interceptors.response.use(
        (response) => {
          // Reset failed requests on successful response
          this.failedRequests = 0;
          return response;
        },
        async (error: AxiosError) => {
          // Only handle QTI-specific token refresh if we have a refresh token
          if (
            (error.response?.status === 403 ||
              error.response?.status === 401) &&
            this.refreshToken &&
            this.failedRequests === 0
          ) {
            this.failedRequests++; // Increment to prevent infinite loops
            const originalRequest = error.config;

            return getRefreshTokenAndRetry(
              originalRequest as AxiosRequestConfig & {
                _retry?: boolean;
              },
              error,
              this.axios,
              async () => {
                const authResult = await this.authProvider.refreshToken(
                  this.refreshToken
                );
                // Update tokens
                this.token = authResult.idToken;
                if (authResult.refreshToken) {
                  this.refreshToken = authResult.refreshToken;
                }
                return authResult;
              },
              // Modified to handle failed refresh attempts
              (retryError: AxiosError) => {
                // If refresh also fails, clear tokens and call original error handler
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

          // Always call the custom error handler if provided
          if (this.axiosError) {
            this.axiosError(error);
          }
          return Promise.reject(error);
        }
      );
    }

    // Response interceptor for data unwrapping (additive)
    this.axios.interceptors.response.use(
      (resp) => {
        const d = resp.data;
        if (d && typeof d === "object" && "data" in d) {
          // Replace the entire resp.data with the inner payload
          return { ...resp, data: (d as any).data };
        }
        return resp;
      },
      (err) => Promise.reject(err)
    );
  }

  // Rest of your methods remain the same...
  log = async (type: string, data: any) => {
    const response = await this.axios.post("/log", {
      type,
      data,
    });
    if (response.data) {
      return response.data;
    } else {
      throw "Could not log teacher activity";
    }
  };

  public async getLoggedInUser() {
    try {
      const user = await this.authProvider.getLoggedInUser(this.token);
      return user;
    } catch (error) {
      console.error(error);
      // If token lookup fails, clear tokens
      if (
        error instanceof AxiosError &&
        (error.response?.status === 401 || error.response?.status === 400)
      ) {
        this.clearTokensAndReset();
      }
      return null;
    }
  }

  // use default axios instance for authentication requests
  public async authenticate(email: string, password: string) {
    try {
      const authResult = await this.authProvider.authenticate(email, password);

      let headers = {
        "x-app": this.appId,
        Authorization: "Bearer " + authResult.idToken,
      };

      if (this.admin) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        headers = { ...(headers as any), "x-admin": "true" };
      }

      // Create temporary axios instance to check access
      const tempAxios = axios.create({
        baseURL: this.apiUrl,
        headers,
      });

      // now check if the user has rights to access the application
      let hasAccess = true;
      if (this.checkAccess) {
        const accessResult = await tempAxios.post(`/access`);
        hasAccess = !!accessResult.data?.hasAccess;
      }

      if (hasAccess) {
        // Set tokens and recreate axios instance
        this.token = authResult.idToken;
        if (authResult.refreshToken) {
          this.refreshToken = authResult.refreshToken;
        }
        return authResult;
      } else {
        console.error("no access");
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

  logout() {
    this.clearTokensAndReset();
  }

  async getTestsForApplication(): Promise<Assessment[]> {
    const response = await this.axios.get<{
      assessments: Assessment[];
    }>(removeDoubleSlashes(`${this.apiUrl}/assessments`));
    return response.data?.assessments || [];
  }

  async getPackagesForApplication(): Promise<PackageInfo[]> {
    const response = await this.axios.get<{ packages: PackageInfo[] }>(
      `${this.apiUrl}/packages`
    );
    return response.data?.packages || [];
  }

  async getAssessmentInfo(assessmentId: string) {
    const value = await this.axios.get<Assessment>(
      `/assessment/${assessmentId}`
    );
    return value.data;
  }

  public async deleteStudent(code: string): Promise<void> {
    await this.axios.delete(`/session/${code}`);
  }

  public async addStudentIdentification(
    code: string,
    identification: string
  ): Promise<void> {
    await this.axios.post(`/student/update`, {
      code,
      identification,
    });
  }

  public async resetSession(code: string): Promise<void> {
    await this.axios.post(`/session/reset`, {
      code,
    });
  }

  public async reopenSession(code: string): Promise<void> {
    await this.axios.post(`/session/reopen`, {
      code,
    });
  }

  public async updateSession(
    code: string,
    assessmentId: string,
    session: BaseSession
  ): Promise<void> {
    await this.axios.post(`/session/update`, {
      code,
      assessmentId,
      session,
    });
  }

  public async planStudents({
    count,
    assessmentIds,
  }: {
    count?: number | undefined;
    assessmentIds?: string[] | undefined;
  }): Promise<Session[]> {
    const result = await this.axios.post<Session[]>("/plan", {
      count,
      assessmentIds,
    });
    return result.data;
  }

  public async planStudentsByIdentification({
    identifiers,
    assessmentIds,
  }: {
    identifiers: string[];
    assessmentIds?: string[] | undefined;
  }): Promise<Session[]> {
    const result = await this.axios.post<Session[]>("/planByIdentification", {
      identifiers,
      assessmentIds,
    });
    return result.data;
  }

  public async getSessions(): Promise<Session[]> {
    const result = await this.axios.get<Session[]>("/students");
    return result.data;
  }

  public async getItemStats<
    T extends ItemStatisticsWithResponses<UniqueResponse>
  >(
    assessmentId: string,
    target: "teacher" | "reviewer" = "teacher"
  ): Promise<T[]> {
    const result = await this.axios.get<T[]>(
      `/assessment/${assessmentId}/itemStats`,
      {
        params: {
          role: target,
        },
      }
    );
    return result.data as T[];
  }

  /**
   * Create a new group delivery/activity
   * @returns Promise containing the generated activity code
   */
  public async createDelivery(assessmentId: string): Promise<Delivery> {
    const result = await this.axios.post<{
      success: boolean;
      data: Delivery;
      message: string;
    }>("/delivery/create", {
      assessmentId,
    });
    if (!result.data?.success) {
      throw new Error(result.data?.message || "Failed to create delivery");
    }
    return result.data?.data;
  }

  /**
   * Start a delivery
   * @param assessmentId - The assessment ID to start delivery for
   * @returns Promise containing the delivery information
   */
  public async startDelivery(assessmentId: string): Promise<Delivery> {
    const result = await this.axios.post<{
      success: boolean;
      data: Delivery;
      message: string;
    }>("/delivery/start", { assessmentId });

    if (!result.data?.success) {
      throw new Error(result.data?.message || "Failed to start delivery");
    }
    return result.data?.data;
  }

  /**
   * Stop a group delivery
   * @param deliveryCode - The delivery code to stop
   * @returns Promise containing the delivery code and finish timestamp
   */
  public async stopDelivery(deliveryCode: string): Promise<Delivery> {
    const result = await this.axios.post<{
      success: boolean;
      data: Delivery;
      message: string;
    }>("/delivery/stop", { code: deliveryCode });
    if (!result.data?.success) {
      throw new Error(result.data?.message || "Failed to stop delivery");
    }
    return result.data?.data;
  }

  /**
   * Get all deliveries for an assessment
   * @param assessmentId - The assessment ID
   * @returns Promise containing array of deliveries
   */
  public async getAssessmentDeliveries(
    assessmentId: string
  ): Promise<Delivery[]> {
    const result = await this.axios.get<Delivery[]>(
      `/assessment/${assessmentId}/deliveries`
    );
    return result.data;
  }

  /**
   * Download results as CSV
   * @param assessmentId - The assessment ID
   * @param deliveryCode - Optional delivery code to filter results
   * @returns Promise containing the CSV blob
   */
  public async downloadResultsByDeliveryCode(
    deliveryCode: string
  ): Promise<Blob> {
    const result = await this.axios.get(`/delivery/${deliveryCode}/csv`, {
      responseType: "blob",
    });
    return result.data;
  }

  public async downloadResultsByAssessmentId(
    assessmentId: string
  ): Promise<Blob> {
    const result = await this.axios.get(`/assessment/${assessmentId}/csv`, {
      responseType: "blob",
    });
    return result.data;
  }

  /**
   * Updates the score of a specific response in an item's statistics.
   *
   * @param itemIdentifier The identifier of the item.
   * @param responseId The identifier of the response.
   * @param score The new score.
   * @param target The target for the score update, either 'teacher' or 'reviewer'. Default: teacher.
   */
  public async updateItemStatResponseScore(
    itemIdentifier: string,
    assessmentId: string,
    responseId: string,
    scoreExternal: number | null,
    target: "teacher" | "reviewer" = "teacher"
  ) {
    await this.axios.post(
      `/assessment/${assessmentId}/itemStats/${itemIdentifier}`,
      {
        responseId,
        scoreExternal,
        target,
      }
    );
  }

  public async getStudentResults<
    T extends ItemContext,
    T2 extends StudentResult<T>[]
  >(assessmentId: string) {
    const result = await this.axios.get<T2>(`/assessment/${assessmentId}`);
    return result.data as T2;
  }
}
