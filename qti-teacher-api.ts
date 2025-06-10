import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  PlannedSessions,
  AssessmentInfo,
  ItemInfoWithContent,
  StudentResult,
  Session,
  SessionInfoTeacher,
  ItemStatisticsWithResponses,
} from './model';
import { IQtiTeacherApi } from './qti-teacher-interface';
import {
  getNewToken,
  getRefreshTokenAndRetry,
  removeDoubleSlashes,
} from './utils';
import { ItemContext } from '@citolab/qti-components/exports/item.context.js';

export class QtiTeacherApi implements IQtiTeacherApi {
  private failedRequests = 0;
  public axios: AxiosInstance = {} as AxiosInstance; // trick compiler
  private _token = '';
  private _refreshToken = '';
  public apiIUrl: string;
  private appId: string;
  private firebaseAuthApiKey: string;
  private axiosError?: (error: AxiosError) => void;
  private admin = false;
  private checkAccess = true;

  constructor(
    public options: {
      apiIUrl: string;
      appId: string;
      firebaseAuthApiKey: string;
      axiosError?: (error: AxiosError) => void;
      admin?: boolean;
      checkAccess?: boolean;
    }
  ) {
    const {
      apiIUrl,
      appId,
      firebaseAuthApiKey,
      axiosError,
      admin,
      checkAccess,
    } = options;
    this.apiIUrl = apiIUrl;
    this.appId = appId;
    this.firebaseAuthApiKey = firebaseAuthApiKey;
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
      const token = localStorage.getItem('token') || '';
      return token;
    }
    return '';
  }
  set token(value: string) {
    if (value) {
      if (value === this._token) return;
      this._token = value;

      this.createAxiosInstance();
      if (localStorage) {
        localStorage.setItem('token', value);
      }
    }
  }

  get refreshToken() {
    if (this._refreshToken) return this._refreshToken;
    if (localStorage) {
      const token = localStorage.getItem('t2') || '';
      return token;
    }
    return '';
  }
  set refreshToken(value: string) {
    if (value) {
      this._refreshToken = value;
      if (localStorage) {
        localStorage.setItem('t2', value);
      }
    }
  }

  // Clear all tokens and reset state
  public clearTokensAndReset(): void {
    // Clear internal state
    this._token = '';
    this._refreshToken = '';
    this.failedRequests = 0;

    // Clear localStorage
    if (localStorage) {
      localStorage.removeItem('token');
      localStorage.removeItem('t2');
      localStorage.removeItem('qti-firestore');
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
        config.headers['Authorization'] = `Bearer ${this.token}`;
      }
      if (this.appId) {
        config.headers['x-app'] = this.appId;
      }

      if (this.admin) {
        config.headers['x-admin'] = 'true';
      }

      return config;
    });
    this.axios.interceptors.response.use(
      (response) => {
        // Reset failed requests on successful response
        this.failedRequests = 0;
        return response;
      },
      (error: AxiosError) => {
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
            () => getNewToken(this.refreshToken, this.firebaseAuthApiKey),
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

  public async getLoggedInUser() {
    try {
      const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${this.firebaseAuthApiKey}`;
      const userDataResult = await axios.post<
        { idToken: string },
        {
          data: {
            users: {
              displayName: string;
              email: string;
              localId: string;
            }[];
          };
        }
      >(url, {
        idToken: this.token,
      });
      if (userDataResult.data.users.length > 0) {
        return userDataResult.data.users[0] as {
          displayName: string;
          email: string;
          localId: string;
        };
      }
      return null;
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
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.firebaseAuthApiKey}`;
    const loginResult = await axios.post<{ idToken: string }>(url, {
      email,
      password,
      returnSecureToken: true,
    });
    let headers = {
      'x-app': this.appId,
      Authorization: 'Bearer ' + loginResult.data.idToken,
    };

    if (this.admin) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      headers = { ...(headers as any), 'x-admin': 'true' };
    }
    // this.createAxiosInstance();
    this.axios = axios.create({
      baseURL: this.apiIUrl,
      headers,
    });
    // now check if the user has rights to access the application
    try {
      let hasAccess = true;
      if (this.checkAccess) {
        const accessResult = await this.axios.post(`/teacher/access`);
        hasAccess = !!accessResult.data?.hasAccess;
      }
      const token = loginResult.data.idToken;
      this.token = token;
      if (hasAccess) {
        return loginResult.data;
      } else {
        console.error('no access');
        return null;
      }
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  public async signUp(email: string, password: string) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${this.firebaseAuthApiKey}`;
    const loginResult = await axios.post<{ idToken: string }>(url, {
      email,
      password,
      returnSecureToken: true,
    });
    return loginResult.data;
  }

  public async passwordReset(email: string) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${this.firebaseAuthApiKey}`;
    await axios.post<{ email: string }>(url, {
      email,
      requestType: 'PASSWORD_RESET',
    });
  }

  logout() {
    this.clearTokensAndReset();
  }

  // use authInstance for requests to the qti-backend api
  async getTestsForApplication(): Promise<AssessmentInfo[]> {
    const response = await this.axios.get<{
      assessments: AssessmentInfo[];
    }>(removeDoubleSlashes(`${this.apiIUrl}/teacher/assessments`));
    return response.data?.assessments || [];
  }

  getItemsForApplication(): Promise<ItemInfoWithContent[]> {
    throw new Error('Method not implemented.');
  }

  async getAssessmentInfo(assessmentId: string) {
    const value = await this.axios.get<AssessmentInfo>(
      `/assessment/${assessmentId}`
    );
    return value.data;
  }

  public async getItemsByAssessmentId(assessmentId: string) {
    const response = await this.axios.get<ItemInfoWithContent[]>(
      removeDoubleSlashes(`${this.apiIUrl}/assessment/${assessmentId}/items`)
    );
    return response.data;
  }
  public async deleteStudent(code: string): Promise<void> {
    await this.axios.delete(`/teacher/session/${code}`);
  }

  public async addStudentId(code: string, studentId: string): Promise<void> {
    await this.axios.post(`/teacher/student/update`, {
      code,
      studentId,
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
      '/teacher/plan',
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
      '/teacher/planByIdentification',
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
      '/teacher/students'
    );
    return result.data;
  }

  public async getItemStats<T extends ItemStatisticsWithResponses>(
    itemIdentifiers: string[],
    target: 'teacher' | 'reviewer' = 'teacher'
  ): Promise<T[]> {
    const result = await this.axios.get<T[]>(
      target === 'teacher'
        ? `/teacher/itemStats/${itemIdentifiers.join(',')}`
        : `teacher/review/itemStats/${itemIdentifiers.join(',')}`
    );
    return result.data as T[];
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
    responseId: string,
    scoreExternal: number | null,
    target: 'teacher' | 'reviewer' = 'teacher'
  ) {
    await this.axios.post(`/teacher/itemStats/${itemIdentifier}`, {
      responseId,
      scoreExternal,
      target,
    });
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
