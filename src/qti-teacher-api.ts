import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import {
  PlannedSessions,
  AssessmentInfo,
  StudentResult,
  Session,
  SessionInfoTeacher,
  ItemStatisticsWithResponses,
  StudentAppSessionInfo,
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
  public axios: AxiosInstance = {} as AxiosInstance; // trick compiler
  private _token = "";
  private _refreshToken = "";
  public apiIUrl: string;
  private appId: string;
  private authProvider: ITeacherAuthProvider;
  private axiosError?: (error: AxiosError) => void;
  private admin = false;
  private checkAccess = true;

  constructor(
    public options: {
      apiIUrl: string;
      appId: string;
      authProvider: ITeacherAuthProvider;
      axiosError?: (error: AxiosError) => void;
      admin?: boolean;
      checkAccess?: boolean;
    }
  ) {
    const { apiIUrl, appId, authProvider, axiosError, admin, checkAccess } =
      options;
    this.apiIUrl = apiIUrl;
    this.appId = appId;
    this.authProvider = authProvider;
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
    if (localStorage) {
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
      if (localStorage) {
        localStorage.setItem(
          `token-${this.authProvider.getProviderId()}`,
          value
        );
      }
    }
  }

  get refreshToken() {
    if (this._refreshToken) return this._refreshToken;
    if (localStorage) {
      const token =
        localStorage.getItem(`t2-${this.authProvider.getProviderId()}`) || "";
      return token;
    }
    return "";
  }

  set refreshToken(value: string) {
    if (value) {
      this._refreshToken = value;
      if (localStorage) {
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
    if (localStorage) {
      localStorage.removeItem(`token-${this.authProvider.getProviderId()}`);
      localStorage.removeItem(`t2-${this.authProvider.getProviderId()}`);
      localStorage.removeItem("qti-firestore");
    }

    // Recreate axios instance without tokens
    this.createAxiosInstance();
  }

  private createAxiosInstance() {
    this.axios = axios.create({
      baseURL: this.apiIUrl,
    });

    this.axios.interceptors.request.use((config) => {
      if (this.token) {
        config.headers["Authorization"] = `Bearer ${this.token}`;
      }
      if (this.appId) {
        config.headers["x-app"] = this.appId;
      }

      if (this.admin) {
        config.headers["x-admin"] = "true";
      }

      return config;
    });

    this.axios.interceptors.response.use(
      (response) => {
        // Reset failed requests on successful response
        this.failedRequests = 0;
        return response;
      },
      async (error: AxiosError) => {
        if (
          (error.response?.status === 403 || error.response?.status === 401) &&
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
        if (this.axiosError) {
          this.axiosError(error);
        }
        return Promise.reject(error);
      }
    );
  }

  log = async (type: string, data: any) => {
    const response = await this.axios.post("/teacher/log", {
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
        baseURL: this.apiIUrl,
        headers,
      });

      // now check if the user has rights to access the application
      let hasAccess = true;
      if (this.checkAccess) {
        const accessResult = await tempAxios.post(`/teacher/access`);
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

  // All the remaining methods stay exactly the same since they only use this.axios
  async getTestsForApplication(): Promise<AssessmentInfo[]> {
    const response = await this.axios.get<{
      assessments: AssessmentInfo[];
    }>(removeDoubleSlashes(`${this.apiIUrl}/teacher/assessments`));
    return response.data?.assessments || [];
  }

  async getAssessmentInfo(assessmentId: string) {
    const value = await this.axios.get<AssessmentInfo>(
      `/assessment/${assessmentId}`
    );
    return value.data;
  }

  public async deleteStudent(code: string): Promise<void> {
    await this.axios.delete(`/teacher/session/${code}`);
  }

  public async addStudentIdentification(
    code: string,
    identification: string
  ): Promise<void> {
    await this.axios.post(`/teacher/student/update`, {
      code,
      identification,
    });
  }

  public async resetSession(code: string, asessmentId: string): Promise<void> {
    await this.axios.post(`/teacher/session/reset`, {
      code,
      asessmentId,
    });
  }

  public async updateSession(
    code: string,
    assessmentId: string,
    session: Session
  ): Promise<void> {
    await this.axios.post(`/teacher/session/update`, {
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
  }): Promise<PlannedSessions<SessionInfoTeacher>[]> {
    const result = await this.axios.post<PlannedSessions<SessionInfoTeacher>[]>(
      "/teacher/plan",
      {
        count,
        assessmentIds,
      }
    );
    return result.data;
  }

  public async planStudentsByIdentification({
    identifiers,
    assessmentIds,
  }: {
    identifiers: string[];
    assessmentIds?: string[] | undefined;
  }): Promise<PlannedSessions<SessionInfoTeacher>[]> {
    const result = await this.axios.post<PlannedSessions<SessionInfoTeacher>[]>(
      "/teacher/planByIdentification",
      {
        identifiers,
        assessmentIds,
      }
    );
    return result.data;
  }

  public async getPlannedSessions(): Promise<
    PlannedSessions<SessionInfoTeacher>[]
  > {
    const result = await this.axios.get<PlannedSessions<SessionInfoTeacher>[]>(
      "/teacher/students"
    );
    return result.data;
  }

  public async getItemStats<T extends ItemStatisticsWithResponses>(
    assessmentId: string,
    target: "teacher" | "reviewer" = "teacher"
  ): Promise<T[]> {
    const result = await this.axios.get<T[]>(
      `/teacher/assessment/${assessmentId}/itemStats`,
      {
        params: {
          role: target,
        },
      }
    );
    return result.data as T[];
  }

  /**
   * Create a new group groupDeliveryCode/activity
   * @returns Promise containing the generated activity code
   */
  public async createGroupDelivery(
    assessmentId: string
  ): Promise<{ groupDeliveryCode: string }> {
    const result = await this.axios.post<{ groupDeliveryCode: string }>(
      "/teacher/startGroupDelivery",
      { assessmentId }
    );
    return result.data;
  }

  /**
   * Get assessment information by assessment ID
   * @param assessmentId - The ID of the assessment
   * @returns Promise containing the assessment information
   */
  public async getAssessmentInfoByGroupCode<T = any>(
    assessmentId: string
  ): Promise<T> {
    const result = await this.axios.get<T>(`/assessment/${assessmentId}`);
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
      `/teacher/assessment/${assessmentId}/itemStats/${itemIdentifier}`,
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
    const result = await this.axios.get<T2>(
      `/teacher/assessment/${assessmentId}`
    );
    return result.data as T2;
  }
}
