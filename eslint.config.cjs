const { defineConfig, globalIgnores } = require('eslint/config');
const eslintJs = require('@eslint/js');
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');
const reactRefresh = require('eslint-plugin-react-refresh').default;
const globals = require('globals');

module.exports = defineConfig([
    // Ignored paths (build output, vendored assets, tooling)
    globalIgnores([
        'dist/**',
        'tmp/**',
        'coverage/**',
        'node_modules/**',
        '.sfdx/**',
        'public/**'
    ]),

    // App source: React + TypeScript + Vite
    {
        files: ['src/**/*.{ts,tsx}'],
        extends: [
            eslintJs.configs.recommended,
            ...tseslint.configs.recommended
        ],
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh
        },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser
            }
        },
        rules: {
            ...reactHooks.configs['recommended-latest'].rules,
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true }
            ]
        }
    },

    // Config / tooling files running in Node
    {
        files: ['*.{js,cjs,mjs,ts}', 'vite.config.*', 'jest.config.*'],
        extends: [eslintJs.configs.recommended],
        languageOptions: {
            ecmaVersion: 'latest',
            globals: {
                ...globals.node
            }
        }
    }
]);
