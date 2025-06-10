import {
  ItemInfoWithContent,
  StudentAppSessionInfo,
  UserInfo,
  ExtendedTestContext,
  AssessmentInfo,
  SessionStateType,
  AuthenticationMethod,
} from './model';
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { IQtiDataApi } from './qti-data-api-interface';
import { dateId, getNewToken, getRefreshTokenAndRetry } from './utils';

export class QtiApi implements IQtiDataApi {
  public axios: AxiosInstance = {} as AxiosInstance; // trick compiler
  public userKey = '';
  constructor(
    public apiIUrl: string,
    private appId: string,
    private firebaseAuthApiKey: string,
    private shouldGetXmlResourceFromDatabase = false,
    private axiosError?: (error: AxiosError) => void
  ) {
    // get domain from apiUrl
    const apiDomain =
      apiIUrl.split('/').length > 2 ? apiIUrl.split('/')[2] : apiIUrl;
    this.userKey = `userInfos-${appId}-${apiDomain}`;
    const storedUserInfo = localStorage.getItem(this.userKey);
    // remove / on end if api Url has it
    if (apiIUrl.endsWith('/')) {
      this.apiIUrl = apiIUrl.substring(0, apiIUrl.length - 1);
    }
    if (storedUserInfo) {
      this.userInfo = JSON.parse(storedUserInfo);
    } else {
      this.createAxiosInstance();
    }
  }

  private createAxiosInstance() {
    this.axios = axios.create({
      baseURL: this.apiIUrl,
    });

    this.axios.interceptors.request.use((config) => {
      if (this.userInfo?.token) {
        config.headers['Authorization'] = `Bearer ${this.userInfo.token}`;
      }
      if (this.appId) {
        config.headers['x-app'] = this.appId;
      }
      if (this.userInfo?.assessment?.assessmentId) {
        config.headers['x-assessment'] =
          this.userInfo?.assessment?.assessmentId;
      }
      if (this.userInfo?.code) {
        config.headers['x-code'] = this.userInfo.code;
      }
      if (this.userInfo?.identification) {
        config.headers['x-name'] = this.userInfo.identification;
      }
      if (this.shouldGetXmlResourceFromDatabase) {
        config.headers['x-xml-from-db'] = 'true';
      }
      return config;
    });
    this.axios.interceptors.response.use(
      (response) => {
        // Do something with successful response
        return response;
      },
      (error: AxiosError) => {
        const originalRequest = error.config;

        if (
          (error.response?.status === 403 || error.response?.status === 401) &&
          this.userInfo?.refreshToken &&
          !(originalRequest as unknown as { _retry: boolean })._retry
        ) {
          (originalRequest as unknown as { _retry: boolean })._retry = true; // Add the _retry flag to prevent infinite loop

          let authenticationMethod: (() => Promise<unknown>) | undefined;

          if (this.userInfo?.authenticationMethod === 'anonymous') {
            authenticationMethod = () => this.anonymousLogin();
          } else if (
            this._userInfo &&
            this.userInfo?.authenticationMethod === 'code' &&
            this._userInfo?.code
          ) {
            authenticationMethod = () =>
              this.authenticateByCode(this._userInfo!.code);
          } else if (
            this._userInfo &&
            this.userInfo?.authenticationMethod === 'assessment' &&
            this._userInfo?.assessment?.assessmentId
          ) {
            authenticationMethod = () =>
              this.authenticateByAssessmentId({
                assessmentId: this._userInfo?.assessment?.assessmentId || '',
                identification: this._userInfo?.identification,
              });
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

  async getAssessment(assessmentId: string) {
    const value = await this.axios.get<AssessmentInfo>(
      `/assessment/${assessmentId}`
    );
    return value.data;
  }

  public async getAssessments() {
    const value = await this.axios.get<AssessmentInfo[]>('/assessments');
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
      const u = localStorage.getItem(`userInfo_${this.appId}`);
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

  authenticateAnonymously = async (): Promise<StudentAppSessionInfo> => {
    const userInfo = await this.anonymousLogin();
    if (userInfo) {
      this.userInfo = {
        appId: this.appId || '',
        teacherId: '',
        userId: userInfo.localId || '',
        identification: '',
        isDemo: false,
        authenticationMethod: 'anonymous',
        refreshToken: userInfo.refreshToken,
        code: userInfo.localId || '',
        token: userInfo.idToken,
      };
      return { ...this.userInfo, sessions: [] };
    } else {
      throw `could not login`;
    }
  };

  authenticateByAssessmentCode = async (config: {
    code: string;
    identification?: string;
    metadata?: unknown;
  }): Promise<StudentAppSessionInfo> => {
    const userInfo = await this.anonymousLogin();
    if (userInfo) {
      this.userInfo = {
        appId: this.appId || '',
        teacherId: '',
        userId: userInfo.localId || '',
        identification: config.identification || '',
        authenticationMethod: 'anonymous',
        isDemo: false,
        refreshToken: userInfo.refreshToken,
        code: '',
        token: userInfo.idToken,
      };
      const studentAppSessionInfoData =
        await this.axios.post<StudentAppSessionInfo>(`/assessment/checkCode`, {
          code: config.code,
          identification: config.identification || '',
        });
      const studentAppSessionInfo = studentAppSessionInfoData.data;
      if (!studentAppSessionInfo) {
        console.error(`studentAppSessionInfo is undefined`);
        throw `unknown assessment code`;
      }
      let assessment = studentAppSessionInfo.assessment;
      if (!assessment) {
        const currentSession = studentAppSessionInfo.sessions.find(
          (c) => c.assessmentId === studentAppSessionInfo.currentAssessmentId
        );
        assessment = {
          assessmentId: currentSession?.assessmentId || '',
          name: currentSession?.assessmentName || '',
          packageId: currentSession?.packageId || '',
          isDemo: studentAppSessionInfo.isDemo,
        };
      }

      this.userInfo = {
        ...this.userInfo,
        assessment,
        isDemo: studentAppSessionInfo.isDemo,
      };
      if (!assessment.assessmentId) {
        console.error(`assessment.assessmentId is undefined`);
        throw `unknown assessment code`;
      }

      if (studentAppSessionInfo.isDemo) {
        return {
          appId: this.appId || '',
          code: config.code,
          teacherId: '',
          isDemo: true,
          sessions: [
            {
              assessmentId: assessment?.assessmentId || '',
              assessmentName: assessment?.name || '',
              packageId: assessment.packageId,
              sessionState: 'not_started',
            },
          ],
        } as StudentAppSessionInfo;
      } else {
        const testSessionInfo = await this.axios.post<StudentAppSessionInfo>(
          `/session/start`,
          {
            metadata: config.metadata,
            assessmentId: studentAppSessionInfo.assessment?.assessmentId || '',
            identification: config.identification || '',
          }
        );
        if (testSessionInfo.data) {
          const studentAppSessionInfo =
            testSessionInfo.data as StudentAppSessionInfo;
          this.userInfo = {
            ...this.userInfo,
            code: studentAppSessionInfo?.code || '',
            isDemo: studentAppSessionInfo?.isDemo || false,
            assessment: studentAppSessionInfo?.assessment || undefined,
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
        appId: this.appId || '',
        teacherId: '',
        userId: userInfo.localId || '',
        identification: '',
        isDemo: false,
        authenticationMethod: 'code',
        code,
        refreshToken: userInfo.refreshToken,
        token: userInfo.idToken,
      };
      const testSessionInfo = await this.axios.post<StudentAppSessionInfo>(
        `/checkCode`,
        {
          code,
        }
      );
      if (testSessionInfo.data) {
        // const asessments = await this.getAssessments();
        const firstUnfinishedSession = testSessionInfo.data.sessions.find(
          (s) =>
            s.sessionState !== 'not_available' &&
            s.sessionState !== 'finished' &&
            s.sessionState !== 'scored'
        );
        const assessmentInfo = (testSessionInfo.data.assessment ||
          firstUnfinishedSession) as AssessmentInfo;
        // const assessment = asessments.find(
        //   (a) => assessmentId === a.assessmentId
        // );
        const { teacherId, isDemo } = testSessionInfo.data;
        this.userInfo = {
          ...this.userInfo,
          assessment: assessmentInfo,
          teacherId,
          isDemo,
          code,
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
  }): Promise<StudentAppSessionInfo> => {
    const userInfo = await this.anonymousLogin();
    if (userInfo) {
      this.userInfo = {
        appId: this.appId || '',
        teacherId: '',
        userId: userInfo.localId || '',
        identification: config.identification || '',
        // assessmentId: config.assessmentId,
        authenticationMethod: 'anonymous',
        isDemo: false,
        refreshToken: userInfo.refreshToken,
        code: '',
        token: userInfo.idToken,
      };
      const testSessionInfo = await this.axios.post<StudentAppSessionInfo>(
        `/session/start`,
        {
          metadata: config.metadata,
          assessmentId: config.assessmentId,
          identification: config.identification || '',
        }
      );
      if (testSessionInfo.data) {
        const studentAppSessionInfo =
          testSessionInfo.data as StudentAppSessionInfo;
        this.userInfo = {
          ...this.userInfo,
          code: studentAppSessionInfo?.code || '',
          isDemo: studentAppSessionInfo?.isDemo || false,
          assessment: studentAppSessionInfo.assessment,
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

  getStudentProgress = async () => {
    const response = await this.axios.get<StudentAppSessionInfo>(
      'session/info'
    );
    return response.data;
  };
  getItemsByAssessmentId = async (assessmentId: string) => {
    const response = await this.axios.get<ItemInfoWithContent[]>(
      `/assessment/${assessmentId}/items`
    );
    return response.data;
  };

  logout = () => {
    //get all localStorage keys
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(`userInfo_${this.appId}`)) {
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
    const sessionInfo = await this.axios.post<StudentAppSessionInfo>(
      `/checkCode`,
      {
        code,
      }
    );
    return sessionInfo.data;
  }

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
      createdBy: this.userInfo?.userId || '',
    });
  };

  private anonymousLogin = async () => {
    // if logged in before, then refresh the token
    if (this.userInfo && this.userInfo.refreshToken) {
      const results = getNewToken(
        this.userInfo.refreshToken,
        this.firebaseAuthApiKey
      );
      return results;
    }
    const result = await axios.post<{
      idToken: string;
      localId: string;
      refreshToken: string;
    }>(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${this.firebaseAuthApiKey}`,
      { returnSecureToken: true }
    );
    return result.data;
  };
}
