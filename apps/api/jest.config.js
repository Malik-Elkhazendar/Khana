module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/api',
  passWithNoTests: true,
  moduleNameMapper: {
    '^@khana/(.*)$': '<rootDir>/../../libs/$1/src',
  },
  roots: ['<rootDir>/src', '<rootDir>/test'],
};
