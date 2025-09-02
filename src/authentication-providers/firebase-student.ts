import { AuthStatus } from "../model";
import {
  AuthStudentResult,
  IAuthStudentProvider,
  IQtiDataApi,
} from "../qti-data-api-interface";
import axios from "axios";

export class FirebaseAuthStudentProvider implements IAuthStudentProvider {
  constructor(private firebaseAuthApiKey: string) {}

  private sessionExpired = false;
  private qtiApi: IQtiDataApi | null = null; // Reference to QTI API for storage

  getProviderId(): string {
    return "firebase";
  }

  markSessionExpired(): void {
    this.sessionExpired = true;
  }

  logout(): void {
    this.qtiApi = null;
    localStorage.clear();
  }

  public getAuthStatus() {
    const userInfo = this.qtiApi?.userInfo;

    return {
      isAuthenticated: !!userInfo?.token,
      userId: userInfo?.userId || null,
      token: userInfo?.token || null,
      expiresIn: 3600, // You might want to calculate this from stored data
      isSessionExpired: this.sessionExpired,
    } as AuthStatus;
  }

  async authenticate(): Promise<AuthStudentResult> {
    const result = await axios.post<AuthStudentResult>(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${this.firebaseAuthApiKey}`,
      { returnSecureToken: true }
    );
    return result.data;
  }

  async refreshToken(refreshToken: string): Promise<AuthStudentResult> {
    const result = await axios.post<{
      id_token: string;
      user_id: string;
      refresh_token: string;
    }>(
      `https://securetoken.googleapis.com/v1/token?key=${this.firebaseAuthApiKey}`,
      {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }
    );
    return {
      idToken: result.data.id_token,
      localId: result.data.user_id,
      refreshToken: result.data.refresh_token,
    };
  }
}
