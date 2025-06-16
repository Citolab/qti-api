import {
  AuthStudentResult,
  IAuthStudentProvider,
} from "../qti-data-api-interface";
import axios from "axios";

export class FirebaseAuthStudentProvider implements IAuthStudentProvider {
  constructor(private firebaseAuthApiKey: string) {}

  getProviderId(): string {
    return "firebase";
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
