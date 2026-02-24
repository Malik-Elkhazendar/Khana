import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
  {
    files: [
      'apps/api/src/**/*.ts',
      'apps/api/src/**/*.js',
      'apps/manager-dashboard/src/**/*.ts',
      'apps/manager-dashboard/src/**/*.js',
    ],
    ignores: [
      '**/*.spec.ts',
      '**/*.spec.js',
      'apps/manager-dashboard/src/test-setup.ts',
      'apps/manager-dashboard/src/app/shared/services/logger.service.ts',
    ],
    rules: {
      'no-console': 'error',
    },
  },
];
