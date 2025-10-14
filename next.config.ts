import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
   serverExternalPackages: ['mongoose'],
   allowedDevOrigins: ['127.0.0.1', 'localhost'],
   async headers() {
      return [
         {
            source: '/:path*',
            headers: [
               {
                  key: 'X-DNS-Prefetch-Control',
                  value: 'on'
               },
               {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload'
               },
               {
                  key: 'X-Frame-Options',
                  value: 'SAMEORIGIN'
               },
               {
                  key: 'X-Content-Type-Options',
                  value: 'nosniff'
               },
               {
                  key: 'X-XSS-Protection',
                  value: '1; mode=block'
               },
               {
                  key: 'Referrer-Policy',
                  value: 'strict-origin-when-cross-origin'
               },
               {
                  key: 'Permissions-Policy',
                  value: 'camera=(), microphone=(), geolocation=()'
               }
            ]
         }
      ];
   },
   images: {
      remotePatterns: [
         {
            protocol: 'https',
            hostname: 'c.animaapp.com',
            port: '',
            pathname: '/**'
         },
         {
            protocol: 'https',
            hostname: 'cdn.builder.io',
            port: '',
            pathname: '/**'
         }
      ],
      dangerouslyAllowSVG: true,
      contentDispositionType: 'attachment',
      contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"
   },
   webpack: (config, { isServer }) => {
      // Enable top-level await for Mongoose
      config.experiments = {
         ...config.experiments,
         topLevelAwait: true
      };

      // Only externalize these packages on the server-side
      if (isServer) {
         config.externals.push('pino-pretty', 'lokijs', 'encoding');
      }

      // Fix for @metamask/sdk trying to import React Native dependencies
      config.resolve.fallback = {
         ...config.resolve.fallback,
         '@react-native-async-storage/async-storage': false,
         'react-native': false,
         fs: false,
         net: false,
         tls: false
      };

      // Ignore React Native specific modules that @metamask/sdk might try to import
      config.resolve.alias = {
         ...config.resolve.alias,
         '@react-native-async-storage/async-storage': false,
         'react-native': false
      };

      return config;
   }
};

export default nextConfig;
