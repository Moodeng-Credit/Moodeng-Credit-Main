const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const reactRefresh = require('eslint-plugin-react-refresh');
const unusedImports = require('eslint-plugin-unused-imports');
const tanstackQuery = require('@tanstack/eslint-plugin-query');
const nextPlugin = require('@next/eslint-plugin-next');
const importPlugin = require('eslint-plugin-import');

module.exports = [
   js.configs.recommended,
   // Configuration for JavaScript config files (no TypeScript parser)
   {
      files: ['*.config.js', '*.config.mjs', '*.config.cjs'],
      languageOptions: {
         ecmaVersion: 2022,
         sourceType: 'module',
         globals: {
            module: 'readonly',
            require: 'readonly',
            process: 'readonly',
            __dirname: 'readonly',
            __filename: 'readonly'
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
            project: './tsconfig.json',
            ecmaFeatures: {
               jsx: true
            }
         },
         globals: {
            React: 'readonly',
            JSX: 'readonly',
            console: 'readonly',
            process: 'readonly',
            document: 'readonly',
            window: 'readonly',
            location: 'readonly',
            fetch: 'readonly',
            setTimeout: 'readonly',
            clearTimeout: 'readonly',
            global: 'readonly'
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
         '@typescript-eslint/no-floating-promises': process.env.NODE_ENV === 'production' ? 'off' : 'off',
         '@typescript-eslint/no-misused-promises': process.env.NODE_ENV === 'production' ? 'off' : 'off', // Too strict for standard React patterns
         'import/no-cycle': process.env.NODE_ENV === 'production' ? 'error' : 'off',
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
      plugins: {
         '@next/next': nextPlugin
      },

      rules: { ...nextPlugin.configs.recommended.rules }
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
      ignores: ['node_modules', '.next', '.git', '.vscode', 'dist', 'build']
   }
];
