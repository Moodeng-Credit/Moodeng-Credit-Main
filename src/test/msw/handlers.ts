import { http, HttpResponse } from 'msw';

export const handlers = [
   http.get('https://example.test/ping', () => {
      return HttpResponse.json({ status: 'ok' });
   })
];
