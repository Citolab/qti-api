import { ItemContext } from "@citolab/qti-components";
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
import { ItemWithScores } from "./model.js";

export function removeDoubleSlashes(str: string) {
  const singleForwardSlashes = str
    .replace(/([^:]\/)\/+/g, "$1")
    .replace(/\/\//g, "/")
    .replace("http:/", "http://")
    .replace("https:/", "https://");
  return singleForwardSlashes;
}

export const dateId = () => {
  const dt = new Date();
  const year = dt.getFullYear();
  const month = (dt.getMonth() + 1).toString().padStart(2, "0");
  const day = dt.getDate().toString().padStart(2, "0");
  const hour = dt.getHours().toString().padStart(2, "0");
  const minutes = dt.getMinutes().toString().padStart(2, "0");
  const seconds = dt.getSeconds().toString().padStart(2, "0");
  const milliseconds = dt.getMilliseconds().toString().padStart(3, "0");
  return `${year}${month}${day}${hour}${minutes}${seconds}${milliseconds}`;
};
export const getRefreshTokenAndRetry = async (
  request: AxiosRequestConfig & { _retry?: boolean },
  error: AxiosError,
  axiosInstance: AxiosInstance,
  loginMethod: () => Promise<unknown>,
  onAxiosError?: (error: AxiosError) => void
): Promise<AxiosResponse> => {
  if (!request || request._retry) {
    onAxiosError?.(error);
    return Promise.reject(error);
  }
  try {
    await loginMethod();
    request._retry = true;
    // Logging for development purpose.
    console.error("trying to do request again", error.request);
    return await axiosInstance(request);
  } catch (loginError) {
    onAxiosError?.(error);
    return Promise.reject(error);
  }
};

export const getNewToken = async (
  refreshToken: string,
  firebaseAuthApiKey: string
) => {
  const result = await axios.post<{
    id_token: string;
    user_id: string;
    refresh_token: string;
  }>(`https://securetoken.googleapis.com/v1/token?key=${firebaseAuthApiKey}`, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  if (result.data) {
    return {
      refreshToken: result.data.refresh_token,
      idToken: result.data.id_token,
      localId: result.data.user_id,
    };
  } else {
    return null;
  }
};

export function getResponsesAndScores(items: ItemContext[]): ItemWithScores[] {
  const itemList: ItemWithScores[] = [];

  for (const itemContext of items) {
    const itemResult: ItemWithScores = {
      identifier: itemContext.identifier ?? "",
      response: "",
      score: 0,
    };

    if (itemContext?.variables) {
      // Get all RESPONSE variables for this item, sort by name and join with &
      const responseVariables = itemContext.variables
        .filter((v) => v.identifier?.toUpperCase().startsWith("RESPONSE"))
        .sort((a, b) => (a.identifier ?? "").localeCompare(b.identifier ?? ""));

      if (responseVariables.length > 0) {
        const responseValues = responseVariables.map((v) => {
          if (Array.isArray(v.value)) {
            return v.value.map((o) => o?.toString() ?? "").join("#");
          } else {
            return v.value?.toString() ?? "";
          }
        });

        itemResult.response = responseValues.join("&");
      }

      // Get SCORE variable for this item
      const scoreVariable = itemContext.variables.find(
        (v) => v.identifier?.toUpperCase() === "SCORE"
      );

      if (scoreVariable?.value != null) {
        const score = parseFloat(scoreVariable.value.toString());
        itemResult.score = !isNaN(score) ? score : 0;
      }
    }

    itemList.push(itemResult);
  }

  return itemList;
}
