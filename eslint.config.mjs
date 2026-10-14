import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// import 방향: apps → app → (api, ui, core), api → core, ui → core (docs/DEV_GUIDE.md ‘import 규칙’)
export default tseslint.config(
  { ignores: ['**/dist/**', '**/out/**', '**/.astro/**', '**/node_modules/**', 'docs/**', 'supabase/functions/**'] },
  js.configs.recommended,
  { files: ['**/*.mjs', '**/*.cjs'], languageOptions: { globals: globals.node } },
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { boundaries, 'react-hooks': reactHooks },
    settings: {
      'boundaries/elements': [
        { type: 'apps', pattern: 'apps/*' },
        { type: 'app', pattern: 'packages/app' },
        { type: 'api', pattern: 'packages/api' },
        { type: 'ui', pattern: 'packages/ui' },
        { type: 'core', pattern: 'packages/core' },
      ],
      'import/resolver': { typescript: true },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'apps', allow: ['app', 'api', 'ui', 'core'] },
            { from: 'app', allow: ['app', 'api', 'ui', 'core'] },
            { from: 'api', allow: ['api', 'core'] },
            { from: 'ui', allow: ['ui', 'core'] },
            { from: 'core', allow: ['core'] },
          ],
        },
      ],
    },
  },
);
