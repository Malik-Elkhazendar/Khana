import { Type, applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { SWAGGER_BEARER_AUTH_SCHEME } from './swagger.constants';
import { SwaggerErrorResponse } from './swagger.models';

type SwaggerErrorStatus = 400 | 401 | 403 | 404 | 409 | 429;

const ERROR_DESCRIPTIONS: Record<SwaggerErrorStatus, string> = {
  400: 'Request validation failed or the payload is invalid for this operation.',
  401: 'Authentication is required or the supplied token is invalid.',
  403: 'The authenticated user does not have access to this tenant or action.',
  404: 'The requested resource could not be found in the current tenant scope.',
  409: 'The request conflicts with current resource state or business rules.',
  429: 'Too many requests were made and throttling was applied.',
};

const ERROR_EXAMPLES: Record<
  SwaggerErrorStatus,
  {
    statusCode: number;
    message: string | string[];
    error: string;
    timestamp: string;
    path: string;
  }
> = {
  400: {
    statusCode: 400,
    message: ['email must be an email'],
    error: 'Bad Request',
    timestamp: '2026-03-11T12:00:00.000Z',
    path: '/api/v1/auth/login',
  },
  401: {
    statusCode: 401,
    message: 'Invalid email or password',
    error: 'Unauthorized',
    timestamp: '2026-03-11T12:00:00.000Z',
    path: '/api/v1/auth/login',
  },
  403: {
    statusCode: 403,
    message: 'Forbidden resource',
    error: 'Forbidden',
    timestamp: '2026-03-11T12:00:00.000Z',
    path: '/api/v1/bookings',
  },
  404: {
    statusCode: 404,
    message: 'Booking not found',
    error: 'Not Found',
    timestamp: '2026-03-11T12:00:00.000Z',
    path: '/api/v1/bookings/00000000-0000-4000-8000-000000000000',
  },
  409: {
    statusCode: 409,
    message: 'Booking conflicts with an existing reservation',
    error: 'Conflict',
    timestamp: '2026-03-11T12:00:00.000Z',
    path: '/api/v1/bookings',
  },
  429: {
    statusCode: 429,
    message: 'Too many requests',
    error: 'Too Many Requests',
    timestamp: '2026-03-11T12:00:00.000Z',
    path: '/api/v1/auth/login',
  },
};

export function ApiJwtAuth() {
  return ApiBearerAuth(SWAGGER_BEARER_AUTH_SCHEME);
}

export function ApiOptionalTenantHeader(description?: string) {
  return ApiHeader({
    name: 'x-tenant-id',
    required: false,
    description:
      description ??
      'Optional tenant hint for public auth and tenant-resolution flows when JWT context is not available.',
  });
}

export function ApiUuidParam(
  name: string,
  description: string,
  required = true
) {
  return ApiParam({
    name,
    required,
    description,
    schema: {
      type: 'string',
      format: 'uuid',
    },
  });
}

export function ApiStandardErrorResponses(...statuses: SwaggerErrorStatus[]) {
  const decorators = statuses.map((status) => {
    const options = {
      description: ERROR_DESCRIPTIONS[status],
      type: SwaggerErrorResponse,
      example: ERROR_EXAMPLES[status],
    };

    switch (status) {
      case 400:
        return ApiBadRequestResponse(options);
      case 401:
        return ApiUnauthorizedResponse(options);
      case 403:
        return ApiForbiddenResponse(options);
      case 404:
        return ApiNotFoundResponse(options);
      case 409:
        return ApiConflictResponse(options);
      case 429:
        return ApiTooManyRequestsResponse(options);
    }
  });

  return applyDecorators(...decorators);
}

function buildExampleSchema(model: Type<unknown>, example: unknown) {
  return {
    allOf: [{ $ref: getSchemaPath(model) }],
    example,
  };
}

export function ApiExampleRequestBody(
  model: Type<unknown>,
  description: string,
  example: unknown
) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiBody({
      description,
      required: true,
      schema: buildExampleSchema(model, example),
    })
  );
}

export function ApiExampleOkResponse(
  model: Type<unknown>,
  description: string,
  example: unknown
) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description,
      schema: buildExampleSchema(model, example),
    })
  );
}

export function ApiExampleCreatedResponse(
  model: Type<unknown>,
  description: string,
  example: unknown
) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiCreatedResponse({
      description,
      schema: buildExampleSchema(model, example),
    })
  );
}

export function ApiExampleArrayOkResponse(
  model: Type<unknown>,
  description: string,
  example: unknown[]
) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description,
      schema: {
        type: 'array',
        items: { $ref: getSchemaPath(model) },
        example,
      },
    })
  );
}
