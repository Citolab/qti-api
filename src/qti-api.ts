import {
  PlannedTestset,
  UserInfo,
  ExtendedTestContext,
  AssessmentInfo,
  SessionStateType,
  AuthenticationMethod,
  AxiosInstanceConfig,
} from "./model";
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import {
  AuthStudentResult,
  IAuthStudentProvider,
  IQtiDataApi,
} from "./qti-data-api-interface";
import { dateId, getRefreshTokenAndRetry } from "./utils";
export class QtiApi implements IQtiDataApi {
  public axios: AxiosInstance = {} as AxiosInstance;
  public userKey = "";
  private externalAxiosConfig?: AxiosInstanceConfig;

  constructor(
    public apiUrl: string,
    private appId: string,
    private authProvider: IAuthStudentProvider,
    private shouldGetXmlResourceFromDatabase = false,
    private axiosError?: (error: AxiosError) => void,
    // New parameter for axios configuration
    axiosConfig?: AxiosInstanceConfig
  ) {
    this.externalAxiosConfig = axiosConfig;

    // get domain from apiUrl
    const apiDomain =
      apiUrl.split("/").length > 2 ? apiUrl.split("/")[2] : apiUrl;
    this.userKey = `userInfos-${appId}-${apiDomain}-${authProvider.getProviderId()}`;
    const storedUserInfo = localStorage.getItem(this.userKey);
    // remove / on end if api Url has it
    if (apiUrl.endsWith("/")) {
      this.apiUrl = apiUrl.substring(0, apiUrl.length - 1);
    }
    if (storedUserInfo) {
      this.userInfo = JSON.parse(storedUserInfo);
    } else {
      this.createAxiosInstance();
    }
  }
  updateStudentSessionInfo = async (
    id: string,
    data: Partial<PlannedTestset>
  ) => {
    await this.axios.put(`/plannedSession/${id}/update`, data);
  };

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
      if (this.userInfo?.token) {
        config.headers!["Authorization"] = `Bearer ${this.userInfo.token}`;
      }
      if (this.appId) {
        config.headers!["x-app"] = this.appId;
      }
      if (this.userInfo?.code) {
        config.headers!["x-code"] = this.userInfo.code;
      }
      if (this.userInfo?.identification) {
        config.headers!["x-name"] = this.userInfo.identification;
      }
      if (this.shouldGetXmlResourceFromDatabase) {
        config.headers!["x-xml-from-db"] = "true";
      }
      return config;
    });

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

    if (this.externalAxiosConfig?.addAuthenticationInterceptors !== false) {
      // Authentication response interceptor (additive, but can be disabled)
      this.axios.interceptors.response.use(
        (response) => {
          // Do something with successful response
          return response;
        },
        async (error: AxiosError) => {
          const originalRequest = error.config;

          if (
            (error.response?.status === 403 ||
              error.response?.status === 401) &&
            this.userInfo?.refreshToken &&
            !(originalRequest as unknown as { _retry: boolean })._retry
          ) {
            (originalRequest as unknown as { _retry: boolean })._retry = true; // Add the _retry flag to prevent infinite loop

            let authenticationMethod: (() => Promise<unknown>) | undefined;

            if (this.userInfo?.authenticationMethod === "anonymous") {
              authenticationMethod = () => this.authenticateAnonymously();
            } else if (
              this._userInfo &&
              this.userInfo?.authenticationMethod === "code" &&
              this._userInfo?.code
            ) {
              authenticationMethod = () =>
                this.authenticateByCode(this._userInfo!.code);
            }
            if (authenticationMethod) {
              return getRefreshTokenAndRetry(
                originalRequest as AxiosRequestConfig & {
                  _retry?: boolean;
                },
                error,
                this.axios,
                authenticationMethod,
                this.axiosError
              );
            }
          }

          if (this.axiosError) {
            this.axiosError(error);
          }

          return Promise.reject(error);
        }
      );
    }
  }

  async getAssessment(assessmentId: string) {
    const value = await this.axios.get<AssessmentInfo>(
      `/assessment/${assessmentId}`
    );
    return value.data;
  }

  public async getAssessments() {
    const value = await this.axios.get<AssessmentInfo[]>("/assessments");
    return value.data;
  }

  private _userInfo:
    | (UserInfo & {
        token: string;
        refreshToken: string;
        authenticationMethod?: AuthenticationMethod;
      })
    | undefined;

  get userInfo():
    | (UserInfo & {
        token: string;
        refreshToken: string;
        authenticationMethod?: AuthenticationMethod;
      })
    | undefined {
    if (this._userInfo) return this._userInfo;
    if (localStorage) {
      const u = localStorage.getItem(this.userKey);
      if (u) {
        return JSON.parse(u) as UserInfo & {
          token: string;
          refreshToken: string;
          authenticationMethod?: AuthenticationMethod;
        };
      }
    }
    return undefined;
  }

  set userInfo(
    value:
      | (UserInfo & {
          token: string;
          refreshToken: string;
          authenticationMethod?: AuthenticationMethod;
        })
      | undefined
  ) {
    if (value) {
      this._userInfo = value;
      this.createAxiosInstance();
      if (localStorage) {
        localStorage.setItem(this.userKey, JSON.stringify(value));
      }
    }
  }

  authenticateAnonymously = async (): Promise<AuthStudentResult> => {
    const userInfo = await this.anonymousLogin();
    if (userInfo) {
      this.userInfo = {
        appId: this.appId || "",
        teacherId: "",
        userId: userInfo.localId || "",
        identification: "",
        isDemo: false,
        authenticationMethod: "anonymous",
        refreshToken: userInfo.refreshToken,
        code: userInfo.localId || "",
        token: userInfo.idToken,
      };
      return userInfo;
    } else {
      throw `could not login`;
    }
  };

  authenticateByDeliveryCode = async (config: {
    code: string;
    identification?: string;
    metadata?: unknown;
  }): Promise<PlannedTestset> => {
    const userInfo = await this.anonymousLogin();
    if (userInfo) {
      this.userInfo = {
        appId: this.appId || "",
        teacherId: "",
        userId: userInfo.localId || "",
        identification: config.identification || "",
        authenticationMethod: "anonymous",
        isDemo: false,
        refreshToken: userInfo.refreshToken,
        code: "",
        token: userInfo.idToken,
      };
      const studentAppSessionInfoData = await this.axios.post<PlannedTestset>(
        `/delivery/checkCode`,
        {
          code: config.code,
        }
      );
      const studentAppSessionInfo = studentAppSessionInfoData.data;
      if (!studentAppSessionInfo) {
        console.error(`studentAppSessionInfo is undefined`);
        throw `unknown assessment code`;
      }
      const currentSession = studentAppSessionInfo.sessions.find(
        (c) => c.assessmentId === studentAppSessionInfo.currentAssessmentId
      );
      const assessment = {
        assessmentId: currentSession?.assessmentId || "",
        name: currentSession?.assessmentName || "",
        packageId: currentSession?.packageId || "",
        isDemo: studentAppSessionInfo.isDemo,
      };

      this.userInfo = {
        ...this.userInfo,
        isDemo: studentAppSessionInfo.isDemo,
        code: config.code, // <-- Set delivery code here
      };
      if (!assessment.assessmentId) {
        console.error(`assessment.assessmentId is undefined`);
        throw `unknown assessment code`;
      }

      if (studentAppSessionInfo.isDemo) {
        return {
          appId: this.appId || "",
          code: config.code, // <-- Return delivery code here
          teacherId: "",
          isDemo: true,
          sessions: [
            {
              assessmentId: assessment?.assessmentId || "",
              assessmentName: assessment?.name || "",
              packageId: assessment.packageId,
              sessionState: "not_started",
            },
          ],
        } as PlannedTestset;
      } else {
        const testSessionInfo = await this.axios.post<PlannedTestset>(
          `/session/start`,
          {
            metadata: config.metadata,
            identification: config.identification || "",
          }
        );
        if (testSessionInfo.data) {
          const studentAppSessionInfo = testSessionInfo.data as PlannedTestset;
          this.userInfo = {
            ...this.userInfo,
            code: studentAppSessionInfo?.code || config.code, // <-- Set delivery code here if available, fallback to input
            isDemo: studentAppSessionInfo?.isDemo || false,
          };
          // Ensure the returned object includes the delivery code
          return {
            ...studentAppSessionInfo,
            code: studentAppSessionInfo.code || config.code, // <-- Return delivery code here
          };
        }
        return studentAppSessionInfo;
      }
    } else {
      throw `could login`;
    }
  };

  authenticateByCode = async (code: string) => {
    const userInfo = await this.anonymousLogin();
    if (userInfo) {
      this.userInfo = {
        appId: this.appId || "",
        teacherId: "",
        userId: userInfo.localId || "",
        identification: "",
        isDemo: false,
        authenticationMethod: "code",
        code: code,
        refreshToken: userInfo.refreshToken,
        token: userInfo.idToken,
      };
      const testSessionInfo = await this.axios.post<PlannedTestset>(
        `/checkCode`,
        {
          code,
        }
      );
      if (testSessionInfo.data) {
        // const asessments = await this.getAssessments();
        const firstUnfinishedSession = testSessionInfo.data.sessions.find(
          (s) =>
            s.sessionState !== "not_available" &&
            s.sessionState !== "finished" &&
            s.sessionState !== "scored"
        );
        const assessmentInfo = firstUnfinishedSession;
        // const assessment = asessments.find(
        //   (a) => assessmentId === a.assessmentId
        // );
        const { teacherId, isDemo } = testSessionInfo.data;
        this.userInfo = {
          ...this.userInfo,
          teacherId,
          isDemo,
          code: code,
        };
        return testSessionInfo.data;
      } else {
        throw `could find session`;
      }
    } else {
      throw `could login`;
    }
  };

  authenticateByAssessmentId = async (config: {
    assessmentId: string;
    identification?: string;
    metadata?: unknown;
  }): Promise<PlannedTestset> => {
    const userInfo = await this.anonymousLogin();
    if (userInfo) {
      this.userInfo = {
        appId: this.appId || "",
        teacherId: "",
        userId: userInfo.localId || "",
        identification: config.identification || "",
        // assessmentId: config.assessmentId,
        authenticationMethod: "anonymous",
        isDemo: false,
        refreshToken: userInfo.refreshToken,
        code: "",
        token: userInfo.idToken,
      };
      const testSessionInfo = await this.axios.post<PlannedTestset>(
        `/session/start`,
        {
          metadata: config.metadata,
          assessmentId: config.assessmentId,
          identification: config.identification || "",
        }
      );
      if (testSessionInfo.data) {
        const studentAppSessionInfo = testSessionInfo.data as PlannedTestset;
        this.userInfo = {
          ...this.userInfo,
          code: studentAppSessionInfo?.code || "",
          isDemo: studentAppSessionInfo?.isDemo || false,
        };
      }
      return testSessionInfo.data;
    } else {
      throw `could login`;
    }
  };

  getAssessmentByCode = async (code: string) => {
    const assessmentInfo = await this.axios.get<AssessmentInfo>(
      `/assessment/code/${code}`
    );
    if (assessmentInfo.data) {
      return assessmentInfo.data;
    } else {
      throw `could find assessment`;
    }
  };

  log = async (type: string, data: any) => {
    const response = await this.axios.post("/student/log", {
      type,
      data,
    });
    if (response.data) {
      return response.data;
    } else {
      throw "Could not log student activity";
    }
  };

  getStudentProgress = async () => {
    const response = await this.axios.get<PlannedTestset>("session/info");
    return response.data;
  };

  logout = () => {
    //get all localStorage keys
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(`userInfo_${this.appId}`) || key === this.userKey) {
        localStorage.removeItem(key);
      }
    }
    this._userInfo = undefined;
  };

  // This might be faster to do directly from the client.
  // tried that with the firestore REST api but becasue you cannot just post and get the object
  // (you have to post and get in firebase format: { fields: { ... } } you should do this using the firebase npm package)
  async setTestContext(assessmentId: string, context: ExtendedTestContext) {
    await this.axios.post<ExtendedTestContext>(
      `/session/${assessmentId}/context`,
      context
    );
  }

  async setSessionState(assessmentId: string, sessionState: SessionStateType) {
    const content = { sessionState };
    await this.axios.post<{ content: { sessionState: SessionStateType } }>(
      `/session/${assessmentId}/sessionState`,
      content
    );
  }

  async getTestContext(assessmentId: string) {
    try {
      const testContext = await this.axios.get<ExtendedTestContext>(
        `/session/${assessmentId}/context`
      );
      return testContext?.data?.items ? testContext.data : null;
    } catch (error) {
      return null;
    }
  }

  getStudentSessionInfo = async (code: string) => {
    const sessionInfo = await this.axios.post<PlannedTestset>(`/checkCode`, {
      code,
    });
    return sessionInfo.data;
  };

  logAction = async (
    assessmentId: string,
    action: string,
    payload?: unknown
  ) => {
    const date = dateId();
    await this.axios.post(`/session/${assessmentId}/log`, {
      type: action,
      payload,
      time: date,
      createdBy: this.userInfo?.userId || "",
    });
  };

  private anonymousLogin = async () => {
    // if logged in before, then refresh the token
    if (this.userInfo && this.userInfo.refreshToken) {
      const results = await this.authProvider.refreshToken(
        this.userInfo.refreshToken
      );
      return results;
    }
    const result = await this.authProvider.authenticate();
    return result;
  };
}
