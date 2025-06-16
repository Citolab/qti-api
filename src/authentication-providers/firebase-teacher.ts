import axios from "axios";
import {
  ITeacherAuthProvider,
  TeacherAuthResult,
  TeacherUserInfo,
} from "../qti-teacher-interface";

export class FirebaseTeacherAuthProvider implements ITeacherAuthProvider {
  constructor(private firebaseAuthApiKey: string) {}

  getProviderId(): string {
    return "firebase";
  }

  async authenticate(
    email: string,
    password: string
  ): Promise<TeacherAuthResult> {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.firebaseAuthApiKey}`;
    const result = await axios.post<TeacherAuthResult>(url, {
      email,
      password,
      returnSecureToken: true,
    });
    return result.data;
  }

  async signUp(email: string, password: string): Promise<TeacherAuthResult> {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${this.firebaseAuthApiKey}`;
    const result = await axios.post<TeacherAuthResult>(url, {
      email,
      password,
      returnSecureToken: true,
    });
    return result.data;
  }

  async passwordReset(email: string): Promise<void> {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${this.firebaseAuthApiKey}`;
    await axios.post<{ email: string }>(url, {
      email,
      requestType: "PASSWORD_RESET",
    });
  }

  async getLoggedInUser(token: string): Promise<TeacherUserInfo | null> {
    try {
      const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${this.firebaseAuthApiKey}`;
      const userDataResult = await axios.post<
        { idToken: string },
        {
          data: {
            users: TeacherUserInfo[];
          };
        }
      >(url, {
        idToken: token,
      });

      if (userDataResult.data.users.length > 0) {
        return userDataResult.data.users[0];
      }
      return null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async refreshToken(refreshToken: string): Promise<TeacherAuthResult> {
    const url = `https://securetoken.googleapis.com/v1/token?key=${this.firebaseAuthApiKey}`;
    const result = await axios.post<{
      id_token: string;
      refresh_token: string;
      user_id: string;
    }>(url, {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    return {
      idToken: result.data.id_token,
      refreshToken: result.data.refresh_token,
      localId: result.data.user_id,
    };
  }
}
