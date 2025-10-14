import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import connectDB from '@/lib/database';
import { getTokenFromRequest, verifyToken } from '@/lib/utils/auth';
import { clearAuthCookie } from '@/lib/utils/cookieConfig';
import { ERROR_CODES, ERROR_MESSAGES } from '@/types/errorCodes';

const PUBLIC_API_ROUTES = ['/api/auth/login', '/api/auth/register', '/api/webhook'];
const PUBLIC_PAGE_ROUTES = ['/', '/login', '/register', '/guide', '/whylend', '/benefits'];

// Request size limit: 1MB
const MAX_REQUEST_SIZE = 1024 * 1024;

function redirectToLoginWithClearedCookie(request: NextRequest): NextResponse {
   const response = NextResponse.redirect(new URL('/login', request.url));
   clearAuthCookie(response);
   return response;
}

function isPublicRoute(pathname: string, publicRoutes: string[]): boolean {
   return publicRoutes.some((route) => pathname === route || pathname.startsWith(route));
}

function addUserIdToHeaders(request: NextRequest, userId: string): NextResponse {
   const requestHeaders = new Headers(request.headers);
   requestHeaders.set('user-id', userId);
   return NextResponse.next({
      request: {
         headers: requestHeaders
      }
   });
}

async function ensureDatabaseConnection(): Promise<NextResponse | null> {
   try {
      await connectDB();
      return null;
   } catch (error) {
      console.error('Database connection failed in middleware:', error);
      return NextResponse.json(
         {
            success: false,
            error: ERROR_MESSAGES[ERROR_CODES.SERVER_ERROR],
            errorCode: ERROR_CODES.SERVER_ERROR
         },
         { status: 500 }
      );
   }
}

function handlePublicApiRoute(request: NextRequest, token: string | null): NextResponse {
   if (token) {
      const payload = verifyToken(token);
      if (payload) {
         return addUserIdToHeaders(request, payload.user.id);
      }
   }
   return NextResponse.next();
}

function authenticateApiRequest(request: NextRequest, token: string | null, pathname: string): NextResponse | null {
   const isLogoutRoute = pathname.startsWith('/api/auth/logout');

   if (!token && !isLogoutRoute) {
      return NextResponse.json(
         {
            success: false,
            error: ERROR_MESSAGES[ERROR_CODES.AUTH_UNAUTHORIZED],
            errorCode: ERROR_CODES.AUTH_UNAUTHORIZED
         },
         { status: 401 }
      );
   }

   const payload = verifyToken(token);
   if (!payload && !isLogoutRoute) {
      return NextResponse.json(
         {
            success: false,
            error: ERROR_MESSAGES[ERROR_CODES.AUTH_TOKEN_INVALID],
            errorCode: ERROR_CODES.AUTH_TOKEN_INVALID
         },
         { status: 401 }
      );
   }

   return addUserIdToHeaders(request, payload?.user.id || '');
}

async function handleApiRoute(request: NextRequest, pathname: string): Promise<NextResponse> {
   // Check request size for POST/PUT/PATCH requests
   if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
         return NextResponse.json(
            {
               success: false,
               error: ERROR_MESSAGES[ERROR_CODES.VALIDATION_PAYLOAD_TOO_LARGE],
               errorCode: ERROR_CODES.VALIDATION_PAYLOAD_TOO_LARGE
            },
            { status: 413 }
         );
      }
   }

   const dbError = await ensureDatabaseConnection();
   if (dbError) return dbError;

   const token = getTokenFromRequest(request);

   if (isPublicRoute(pathname, PUBLIC_API_ROUTES)) {
      return handlePublicApiRoute(request, token);
   }

   const authResponse = authenticateApiRequest(request, token, pathname);
   return authResponse || NextResponse.next();
}

function handlePageRoute(request: NextRequest, pathname: string): NextResponse {
   if (isPublicRoute(pathname, PUBLIC_PAGE_ROUTES)) {
      return NextResponse.next();
   }

   const token = getTokenFromRequest(request);
   if (!token) {
      return redirectToLoginWithClearedCookie(request);
   }

   const payload = verifyToken(token);
   if (!payload) {
      return redirectToLoginWithClearedCookie(request);
   }

   return NextResponse.next();
}

export async function middleware(request: NextRequest) {
   const { pathname } = request.nextUrl;

   if (pathname.startsWith('/api/')) {
      return handleApiRoute(request, pathname);
   }

   return handlePageRoute(request, pathname);
}

export const config = {
   matcher: ['/api/:path*', '/dashboard/:path*', '/profile/:path*'],
   runtime: 'nodejs'
};
