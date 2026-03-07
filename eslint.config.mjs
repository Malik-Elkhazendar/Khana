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
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:dto',
                'type:util',
                'type:engine',
                'type:data-access',
                'type:notifications',
              ],
            },
            {
              sourceTag: 'type:e2e',
              onlyDependOnLibsWithTags: [
                'type:app',
                'type:e2e',
                'type:dto',
                'type:util',
                'type:engine',
                'type:data-access',
                'type:notifications',
              ],
            },
            {
              sourceTag: 'type:dto',
              onlyDependOnLibsWithTags: ['type:dto'],
            },
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:dto', 'type:util'],
            },
            {
              sourceTag: 'type:engine',
              onlyDependOnLibsWithTags: ['type:dto', 'type:util', 'type:engine'],
            },
            {
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: ['type:dto', 'type:util', 'type:data-access'],
            },
            {
              sourceTag: 'type:notifications',
              onlyDependOnLibsWithTags: ['type:dto', 'type:util', 'type:notifications'],
            },
            {
              sourceTag: 'platform:web',
              onlyDependOnLibsWithTags: ['platform:web', 'platform:shared'],
            },
            {
              sourceTag: 'platform:api',
              onlyDependOnLibsWithTags: ['platform:api', 'platform:shared'],
            },
            {
              sourceTag: 'platform:shared',
              onlyDependOnLibsWithTags: ['platform:shared'],
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
