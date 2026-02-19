import js from '@eslint/js';
import tanstackQuery from '@tanstack/eslint-plugin-query';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

export default [
   js.configs.recommended,
   // Configuration for JavaScript config files (no TypeScript parser)
   {
      files: ['*.config.js', '*.config.mjs', '*.config.cjs'],
      languageOptions: {
         ecmaVersion: 2022,
         sourceType: 'module',
         globals: {
            ...globals.node,
         }
      },
      rules: {
         'no-console': 'off'
      }
   },
   // Configuration for TypeScript and React files
   {
      files: ['**/*.{js,jsx,ts,tsx}'],
      ignores: ['*.config.js', '*.config.mjs', '*.config.cjs'],
      languageOptions: {
         parser: typescriptParser,
         parserOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            project: './tsconfig.app.json',
            ecmaFeatures: {
               jsx: true
            }
         },
         globals: {
            ...globals.browser,
            ...globals.es2021,
            React: 'readonly',
            JSX: 'readonly',
         }
      },
      plugins: {
         '@typescript-eslint': typescript,
         react: react,
         'react-hooks': reactHooks,
         'react-refresh': reactRefresh,
         'unused-imports': unusedImports,
         '@tanstack/query': tanstackQuery,
         import: importPlugin
      },
      settings: {
         react: {
            version: 'detect'
         }
      },
      rules: {
         // Start: Turn off Locally if having performance issues but turn on in CI / build
         '@typescript-eslint/no-floating-promises': 'off',
         '@typescript-eslint/no-misused-promises': 'off', // Too strict for standard React patterns
         'import/no-cycle': 'off',
         // End...

         // React 18 specific rules
         'react/jsx-filename-extension': 'off',
         'no-param-reassign': 'error',
         'react/prop-types': 'off',
         'react/require-default-props': 'off',
         'react/no-array-index-key': ['error'],
         'react/react-in-jsx-scope': 'off',
         'react/jsx-props-no-spreading': 'off',
         'react/jsx-no-useless-fragment': ['error'],
         'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
         'react/jsx-boolean-value': ['error', 'never'],
         'no-shadow': ['error'],
         'react/display-name': 'off',

         // Modern React 18 hook rules
         'react/hook-use-state': ['error'],
         'react-hooks/rules-of-hooks': 'error',
         'react-hooks/exhaustive-deps': 'warn',
         'react/no-object-type-as-default-prop': ['error'],

         // React 18 concurrent features
         'react/jsx-key': ['error', { checkFragmentShorthand: true }],
         'react/no-unstable-nested-components': 'error',
         'react/jsx-no-leaked-render': ['error', { validStrategies: ['ternary'] }],

         // React Refresh rules
         'react-refresh/only-export-components': 'error',

         // Performance optimization rules
         'react/jsx-no-constructed-context-values': ['error'],
         'react/no-danger': ['error'],
         'react/no-arrow-function-lifecycle': ['error'],
         'react/no-invalid-html-attribute': ['error'],
         'react/forbid-dom-props': 'off',

         // tanstack query rules
         '@tanstack/query/exhaustive-deps': 'error',
         '@tanstack/query/no-rest-destructuring': 'error',
         '@tanstack/query/stable-query-client': 'error',
         '@tanstack/query/no-unstable-deps': 'error',
         '@tanstack/query/infinite-query-property-order': 'error',
         '@tanstack/query/no-void-query-fn': 'error',

         // typescript rules
         '@typescript-eslint/no-explicit-any': ['error'],
         'no-console': 'off',
         'prefer-destructuring': 'off',
         '@typescript-eslint/naming-convention': 'off',
         'no-unused-vars': 'off',
         '@typescript-eslint/no-unused-vars': ['error'],
         '@typescript-eslint/consistent-type-imports': ['error'],

         // import rules
         'import/order': 'off',
         'import/no-extraneous-dependencies': 'off',
         'import/named': 'off',
         'import/namespace': 'off',
         'import/default': 'off',
         'import/no-named-as-default-member': 'off',
         'import/no-unresolved': ['off'],
         'import/no-namespace': ['off'],
         'unused-imports/no-unused-imports': 'error'
      }
   },
   {
      files: ['**/*.{ts,tsx}'],
      rules: {
         'no-restricted-imports': [
            'error',
            {
               paths: [],
               patterns: [
                  {
                     group: ['../*', './*'],
                     message: 'Please use absolute imports with @/ instead of relative paths'
                  }
               ]
            }
         ]
      }
   },
   {
      ignores: ['node_modules', '.next', '.git', '.vscode', 'dist', 'build', 'src/generated/**']
   }
];

