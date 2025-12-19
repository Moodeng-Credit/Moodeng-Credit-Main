# Migration Plan: Next.js to React + Vite (SPA)

This document outlines the comprehensive strategy for migrating the Moodeng Credit codebase from Next.js (App Router) to a React Single Page Application (SPA) powered by Vite.

## Overview
The goal is to move away from Next.js's server-side features (SSR, Server Components, API Routes) to a purely client-side architecture. This will simplify deployment and significantly improve development speed & performance for a highly interactive dashboard.

---


## Major Steps & Difficulty

| Step | Description | Difficulty |
| :--- | :--- | :--- |
| 1 | **Project Scaffolding & Vite Setup** | Low |
| 2 | **Routing Migration (React Router)** | Medium |
| 3 | **Component & Layout Refactoring** | Medium |
| 4 | **Data Fetching & State Management** | Medium |
| 5 | **API Routes to Edge Functions** | High |
| 6 | **Authentication & Middleware** | Medium |
| 7 | **Environment & Config Updates** | Low |
| 8 | **Build & Deployment Optimization** | Low |

---

## Step-by-Step Migration Guide

### Step 1: Project Scaffolding & Vite Setup
**Difficulty: Low**
Initialize the Vite environment and migrate core dependencies.

1.  **Initialize Vite**: Create a new Vite project with the React-TS template.
    ```bash
    npm create vite@latest . -- --template react-ts
    ```
2.  **Merge Dependencies**: Update `package.json`.
    *   Remove `next`.
    *   Ensure `react`, `react-dom` are at version 19 (as currently used).
    *   Add `vite`, `@vitejs/plugin-react`.
    *   Keep existing UI libraries (Tailwind, Lucide, Radix UI, etc.).
3.  **Configure Tailwind**: Move `tailwind.config.js` and `postcss.config.js`. Update content paths to point to `index.html` and `src/**/*.{js,ts,jsx,tsx}`.
4.  **Setup `index.html`**: Move the root HTML structure from `src/app/layout.tsx` to the root `index.html`.

### Step 2: Routing Migration (React Router)
**Difficulty: Medium**
Next.js file-based routing must be replaced with `react-router-dom`.

1.  **Install React Router**: `npm install react-router-dom`.
2.  **Define Routes**: Create a `src/routes.tsx` or `src/App.tsx` to define the route tree.
    *   Map `src/app/dashboard/page.tsx` -> `/dashboard`.
    *   Map `src/app/login/page.tsx` -> `/login`.
    *   Handle nested routes using `<Outlet />`.
3.  **Replace Next.js Navigation**:
    *   Replace `next/link` with `Link` from `react-router-dom`.
    *   Replace `useRouter` from `next/navigation` with `useNavigate` from `react-router-dom`.
    *   Replace `usePathname` with `useLocation`.

### Step 3: Component & Layout Refactoring
**Difficulty: Medium**
Convert Next.js specific patterns to standard React.

1.  **Remove Server Components**: Convert all components in `src/app` to Client Components (remove `"use client"` as it's default in Vite).
2.  **Refactor Layouts**: Next.js `layout.tsx` files should be converted into Wrapper Components or Layout Components used by React Router.
3.  **Metadata**: Replace Next.js `metadata` exports with `react-helmet-async` or simple `document.title` updates in `useEffect`.
4.  **Image Optimization**: Replace `next/image` with standard `<img>` tags or a library like `react-optimized-image`. Vite handles static assets via imports.

### Step 4: Data Fetching & State Management
**Difficulty: Medium**
Move from Server-side fetching to Client-side fetching.

1.  **Standardize TanStack Query**: Since the project already uses `@tanstack/react-query`, ensure all data fetching happens within `useQuery` or `useMutation` hooks.
2.  **Remove `fetch` Cache**: Remove Next.js specific fetch options like `{ cache: 'no-store' }` or `{ next: { revalidate: ... } }`.
3.  **Global State**: Ensure Redux/Zustand stores are initialized in the root `main.tsx`.

### Step 5: API Routes to Edge Functions
**Difficulty: High**
Next.js API routes (`src/app/api/*`) must be moved to a secure backend environment.

1.  **Identify Secret Key Usage**: Any API route using `SUPABASE_SECRET_KEY` (like `create-user`) **must** be moved to Supabase Edge Functions.
2.  **Migrate Webhooks**: Move `src/app/api/webhook/route.ts` to a Supabase Edge Function to handle external triggers securely.
3.  **Update Client Calls**: Update `axios` or `fetch` calls in the frontend to point to the new Edge Function URLs instead of `/api/*`.

### Step 6: Authentication & Middleware
**Difficulty: Medium**
Replace Next.js Middleware with Client-side Auth Guards.

1.  **Supabase Client**: Update `src/lib/supabase/client.ts` to use `VITE_` environment variables. You can switch from `@supabase/ssr` to the standard `@supabase/supabase-js` for simplicity in an SPA.
2.  **Remove Server Client**: Delete `src/lib/supabase/server.ts` and `src/lib/supabase/middleware.ts` as they are Next.js specific.
3.  **Auth Guards**: Create a `ProtectedRoute` component using `react-router-dom` that checks the session via `supabase.auth.getSession()` and redirects to `/login` if unauthenticated.
4.  **Session Management**: Use `supabase.auth.onAuthStateChange` in the root component to sync auth state with your Redux/Zustand store.

### Step 7: Environment & Config Updates
**Difficulty: Low**
Update environment variable prefixes and Vite configuration.

1.  **Rename Variables**: Change `NEXT_PUBLIC_` prefixes to `VITE_`.
    *   `NEXT_PUBLIC_SUPABASE_URL` -> `VITE_SUPABASE_URL`.
2.  **Vite Config**: Setup `vite.config.ts` with necessary aliases (e.g., `@/` pointing to `src/`).
3.  **TypeScript**: Update `tsconfig.json` to include Vite types and remove Next.js specific types.

### Step 4: Build & Deployment Optimization
**Difficulty: Low**
Finalize the build process.

1.  **Build Script**: Update `package.json` build script to `vite build`.
2.  **Static Hosting**: The output will be in the `dist/` folder, which can be hosted on Vercel (as an SPA), Netlify, or S3/CloudFront.
3.  **SPA Routing**: Ensure the hosting provider is configured to redirect all requests to `index.html` (fallback routing).

---

## Critical Considerations

### 1. Will the UI look exactly the same?
**Yes**, the UI can look identical, but there are technical nuances:
*   **Styling**: Tailwind and CSS will work exactly the same.
*   **Images**: `next/image` provides automatic optimization (WebP, resizing). In Vite, you use standard `<img>` tags. You may need a Vite plugin like `vite-plugin-imagemin` if you want similar optimization.
*   **Fonts**: Next.js handles Google Fonts automatically. In Vite, you'll need to import them in your CSS or `index.html`.
*   **Transitions**: As an SPA, page transitions will be handled entirely on the client, which often feels faster but lacks the "streaming" feel of Next.js.

### 2. Are Edge Functions necessary?
**Yes, absolutely.**
Since you are moving to a Vite SPA (Client-only), you no longer have a server to hide secret keys.
*   **Security**: Your current API routes (like `create-user` and `forgot-password`) use the `SUPABASE_SECRET_KEY` (Admin/Service Role). You **cannot** put this key in a Vite app as it would be visible to anyone.
*   **Webhooks**: The Telegram webhook requires a permanent URL to receive POST requests. A client-side app cannot do this.
*   **Solution**: You must migrate these specific API routes to **Supabase Edge Functions**. They are designed exactly for this purpose and integrate perfectly with your existing Supabase project.

---
