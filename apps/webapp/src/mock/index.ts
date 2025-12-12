// 1. Import the library.
import { HttpResponse, http } from "msw";
import { setupWorker } from "msw/browser";

// 2. Describe network behavior with request handlers.
export const worker = setupWorker(
  http.get("https://github.com/octocat", ({ request, params, cookies }) => {
    return HttpResponse.json(
      {
        message: "Mocked response",
      },
      {
        status: 202,
        statusText: "Mocked status",
      },
    );
  }),
);
