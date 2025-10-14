import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// CORS origins from environment variable, same as Express backend
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [
   'http://localhost:3000',
   'https://front-web3.vercel.app',
   'https://begfi.vercel.app',
   'https://moonbeg.up.railway.app'
];

export function setCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
   const origin = request.headers.get('origin');

   // Check if origin is allowed
   if (origin && CORS_ORIGINS.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
   } else if (CORS_ORIGINS.includes('*')) {
      response.headers.set('Access-Control-Allow-Origin', '*');
   }

   // Set other CORS headers
   response.headers.set('Access-Control-Allow-Credentials', 'true');
   response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
   response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, user-id');
   response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours

   return response;
}

export function handleCors(request: NextRequest): NextResponse {
   // Handle preflight requests
   if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 });
      return setCorsHeaders(response, request);
   }

   // For non-OPTIONS requests, return a basic response
   return new NextResponse(null, { status: 200 });
}

// Helper function to wrap API responses with CORS headers
export function withCors<T>(request: NextRequest, handler: () => Promise<NextResponse<T>>): Promise<NextResponse<T>> {
   return handler().then((response) => setCorsHeaders(response, request)) as Promise<NextResponse<T>>;
}
