# @citolab/qti-api

Shared TypeScript client and models for Citolab QTI backends. It is used by apps that run on the Firebase backend (`qti-backend-firebase`) and by apps that run on a .NET backend.

## What this package is for

- **Shared models** (`Assessment`, `Session`, `Delivery`, `ItemStatisticsWithResponses`, ...) that frontends and backends agree on.
- **Pre-configured API clients** that handle authentication, token refresh, retry on `401`/`403` and unwrapping of `{ success, data }` responses:
  - `QtiApi`: student side (login by code, test context, logging)
  - `QtiTeacherApi`: teacher/reviewer dashboards (deliveries, results, statistics)
  - `QtiToolsApi`: package upload and plausible answers
- **Pluggable authentication** via `IAuthStudentProvider` and `ITeacherAuthProvider`. Firebase providers are included; other backends supply their own (e.g. a .NET or MSAL provider in the app).

## What this package is not for

App-specific endpoints do not belong here. Call them in the app through the client's `axios` instance, which already carries the auth headers and token refresh:

```ts
const { data } = await teacherApi.axios.post(`/my-app/some-endpoint`, body);
```

Only add a method to this package when the endpoint exists with the same contract on every backend that uses the package.

## Installation

```bash
npm install @citolab/qti-api axios @citolab/qti-components
```

`axios` (>= 1.7) and `@citolab/qti-components` (8.x, 9.x or 10.x) are peer dependencies.

## Usage

### Firebase backend

```ts
import {
  FirebaseAuthStudentProvider,
  FirebaseTeacherAuthProvider,
  QtiApi,
  QtiTeacherApi,
} from "@citolab/qti-api";

const qtiApi = new QtiApi(apiUrl, new FirebaseAuthStudentProvider(firebaseApiKey));

const teacherApi = new QtiTeacherApi({
  apiIUrl: apiUrl,
  authProvider: new FirebaseTeacherAuthProvider(firebaseApiKey),
});
```

### Other backends

Implement the provider interface and pass it to the same clients:

```ts
import type { ITeacherAuthProvider, TeacherAuthResult } from "@citolab/qti-api";

class MyTeacherAuthProvider implements ITeacherAuthProvider {
  getProviderId() {
    return "my-backend";
  }
  async authenticate(email: string, password: string): Promise<TeacherAuthResult> {
    /* call your login endpoint */
  }
  // signUp, passwordReset, getLoggedInUser, refreshToken
}

const teacherApi = new QtiTeacherApi({ apiIUrl: apiUrl, authProvider: new MyTeacherAuthProvider() });
```

### Using your own axios instance

All clients accept `axiosConfig` to reuse an existing axios instance:

```ts
new QtiTeacherApi({
  apiIUrl: apiUrl,
  authProvider,
  axiosConfig: {
    instance: myAxios,
    clearInterceptors: false, // remove existing interceptors first
    addAuthenticationInterceptors: true, // token refresh / retry on 401 and 403
  },
});
```

## Releasing

```bash
npm run release:patch   # or release:minor / release:major
```

## License

This project is licensed under the [GPLv3 License](LICENSE.md).
