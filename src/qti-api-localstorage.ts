import {
  PlannedTestset,
  UserInfo,
  ExtendedTestContext,
  SessionStateType,
} from "./model";
import { IQtiDataApi } from "./qti-data-api-interface";

// This is a wrapper around the QtiApi that stores the data in local storage.
// Package is retrieved from the server
export class QtiApiStoreContextToLocalStorage implements IQtiDataApi {
  apiUrl = "";

  constructor(public qtiApi: IQtiDataApi) {
    this.apiUrl = qtiApi.apiUrl;
  }
  authenticateByDeliveryCode = (config: {
    code: string;
    identification?: string;
    metadata?: unknown;
  }): Promise<PlannedTestset> => {
    return this.qtiApi.authenticateByDeliveryCode(config);
  };

  updateStudentSessionInfo = async (
    id: string,
    data: Partial<PlannedTestset>
  ) => {
    await this.qtiApi.updateStudentSessionInfo(id, data);
  };
  public log(type: string, data: any) {
    console.log(`Action: ${type}`, data);
    return Promise.resolve();
  }

  public async getAssessments() {
    return this.qtiApi.getAssessments();
  }

  public async getAssessment(assessmentId: string) {
    return this.qtiApi.getAssessment(assessmentId);
  }

  private _userInfo: (UserInfo & { token: string }) | undefined;

  get userInfo(): (UserInfo & { token: string }) | undefined {
    if (this._userInfo) return this._userInfo;
    if (localStorage) {
      const u = localStorage.getItem("userInfo");
      if (u) {
        return JSON.parse(u) as UserInfo & { token: string };
      }
    }
    return undefined;
  }
  set userInfo(value: (UserInfo & { token: string }) | undefined) {
    if (value) {
      this._userInfo = value;
      if (localStorage) {
        localStorage.setItem("userInfo", JSON.stringify(value));
      }
    }
  }

  authenticateByCode = async (code: string) => {
    return this.qtiApi.authenticateByCode(code);
  };

  getAssessmentByCode = async (code: string) => {
    return this.qtiApi.getAssessmentByCode(code);
  };

  authenticateAnonymously = async () => {
    return this.qtiApi.authenticateAnonymously();
  };

  getStudentProgress = async () => {
    // TODO: update this when storing responses?
    const stored = localStorage.getItem(`${this.userInfo?.code}_progress`);
    if (stored) {
      return JSON.parse(stored) as PlannedTestset;
    }
    return null;
  };

  logout = () => {
    localStorage.removeItem("qti-firestore");
  };

  // This might be faster to do directly from the client.
  // tried that with the firestore REST api but becasue you cannot just post and get the object
  // (you have to post and get in firebase format: { fields: { ... } } you should do this using the firebase npm package)
  async setTestContext(assessmentId: string, context: ExtendedTestContext) {
    const key = `${this.userInfo?.code}_${assessmentId}_context`;
    localStorage.setItem(key, JSON.stringify(context));
  }

  async setSessionState(assessmentId: string, sessionState: SessionStateType) {
    //TODO
    console.log(assessmentId, sessionState);
  }

  async getTestContext(assessmentId: string) {
    const key = `${this.userInfo?.code}_${assessmentId}_context`;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as ExtendedTestContext;
    }
    return null;
  }

  async getStudentSessionInfo(code: string) {
    return this.qtiApi.getStudentSessionInfo(code);
  }

  logAction = async (
    assessmentId: string,
    action: string,
    payload?: unknown
  ) => {
    console.log("logAction", assessmentId, action, payload);
  };
}
