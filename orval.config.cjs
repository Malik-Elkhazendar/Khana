module.exports = {
  khana: {
    input: {
      target: './apps/api/openapi/khana.v1.json',
      validation: false,
    },
    output: {
      mode: 'tags-split',
      target:
        './apps/manager-dashboard/src/app/shared/services/api/generated/endpoints.ts',
      schemas:
        './apps/manager-dashboard/src/app/shared/services/api/generated/model',
      client: 'angular',
      clean: true,
      prettier: true,
      tsconfig: './apps/manager-dashboard/tsconfig.app.json',
      override: {
        angular: {
          providedIn: 'root',
        },
      },
    },
  },
};
