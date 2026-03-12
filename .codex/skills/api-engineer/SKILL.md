---
name: api-engineer
description: >
  NestJS API development for Khana: design and implement RESTful endpoints with
  standardized error handling, shared DTOs, and multi-tenancy enforcement.
  Use when creating or modifying API modules, controllers, or services.
---

# API Engineer - NestJS Endpoint Development

Design and implement RESTful APIs for the Khana platform.

## Key References

- Architecture rules and patterns: `CLAUDE.md`
- Current API modules: `docs/current/api-modules.md`
- Shared DTOs: `libs/shared-dtos/src/lib/dtos/`
- Multi-tenancy and side-effect rules: `.codex/skills/project-guardrails/SKILL.md`

---

## API Structure

```txt
/api/v1/{resource}          -> Collection
/api/v1/{resource}/{id}     -> Single resource
```

API versioning is handled via the `version: '1'` option in `@Controller()`.

---

## Module Pattern

```ts
@Module({
  imports: [
    AuthModule, // always for guards
    TypeOrmModule.forFeature([Entity]), // register entities
  ],
  controllers: [ResourceController],
  providers: [ResourceService],
  exports: [ResourceService], // only if consumed by other modules
})
export class ResourceModule {}
```

Register the module in `apps/api/src/app/app.module.ts`.

---

## Controller Pattern

```ts
@ApiTags('Resource')
@ApiJwtAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'resource', version: '1' })
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Get()
  @ApiOperation({ summary: 'List resources' })
  findAll(@TenantId() tenantId: string, @CurrentUser() user: User) {
    return this.resourceService.findAll(tenantId, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateResourceDto, @TenantId() tenantId: string) {
    return this.resourceService.create(dto, tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateResourceDto, @TenantId() tenantId: string) {
    return this.resourceService.update(id, dto, tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.resourceService.remove(id, tenantId);
  }
}
```

Add `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.OWNER)` for role-restricted endpoints.

For mixed public/protected controllers such as `auth`, keep `@ApiTags(...)` on the
controller and apply `@ApiJwtAuth()` only to the protected methods.

---

## Service Pattern

```ts
@Injectable()
export class ResourceService {
  constructor(
    @InjectRepository(Resource)
    private readonly repo: Repository<Resource>
  ) {}

  async findAll(tenantId: string): Promise<ResourceListItemDto[]> {
    const tid = this.requireTenantId(tenantId);
    return this.repo.find({ where: { tenantId: tid } });
  }

  async create(dto: CreateResourceDto, tenantId: string): Promise<Resource> {
    const tid = this.requireTenantId(tenantId);
    const entity = this.repo.create({ ...dto, tenantId: tid });
    return this.repo.save(entity);
  }

  private requireTenantId(tenantId?: string): string {
    if (!tenantId?.trim()) {
      throw new ForbiddenException('Tenant context required');
    }
    return tenantId;
  }
}
```

---

## DTO Rules

- Shared contracts live in `libs/shared-dtos/src/lib/dtos/`
- Export shared contracts from `libs/shared-dtos/src/lib/dtos/index.ts`
- Re-export shared contracts from `libs/shared-dtos/src/index.ts`
- Use `interface` for frontend/backend shared contracts
- Keep API-only request validation DTO classes in `apps/api/src/app/**/dto`
- Dates as ISO strings; amounts as `number`
- After adding: run `npm run migration:generate -- libs/data-access/src/lib/migrations/<Name>` if schema changed

---

## Swagger / OpenAPI

- Swagger bootstrap lives in `apps/api/src/app/swagger/`
- Keep `@nestjs/swagger` decorators in the API app only
- Shared DTO interfaces in `libs/shared-dtos` must stay framework-agnostic
- Swagger request-body decorators belong on API-local DTO classes when a Swagger phase needs them
- Swagger-only response models also stay API-local; do not move Nest-specific doc classes into shared libs
- Reuse the shared helpers in `apps/api/src/app/swagger/swagger.decorators.ts` for bearer auth, UUID params, tenant headers, and standard error responses
- Keep operation IDs deterministic through the bootstrap `operationIdFactory`; do not hand-roll per-controller IDs
- The committed OpenAPI artifact lives at `apps/api/openapi/khana.v1.json`; export and lint it before client-generation work
- The Angular OpenAPI transport client is generated from that artifact via `orval.config.cjs` into `apps/manager-dashboard/src/app/shared/services/api/generated/`
- Treat the generated client as transport-only. Keep handwritten frontend domain services as the stable adapter layer until a later rollout explicitly replaces them
- The Nest Swagger CLI plugin remains deferred in this repo because the current Nx + webpack path and interface-heavy responses make explicit API-local docs safer

---

## Error Format (Standard)

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2024-01-10T12:00:00.000Z",
  "path": "/api/v1/bookings"
}
```

Throw NestJS built-ins: `NotFoundException`, `ForbiddenException`, `ConflictException`, `BadRequestException`.

---

## Endpoint Checklist

For every new endpoint:

- [ ] Correct HTTP method and `/api/v1/` prefix
- [ ] `@UseGuards(JwtAuthGuard)` on controller class
- [ ] `@TenantId()` and `@CurrentUser()` parameters used
- [ ] `requireTenantId()` called as first line in service method
- [ ] Request DTO validated; shared response contract in `libs/shared-dtos/` or API-local Swagger doc model when needed
- [ ] Raw SQL numbers cast with `Number()`
- [ ] Side effects are fire-and-forget (never `await` emails/notifications)
- [ ] Module registered in `app.module.ts`
- [ ] Service unit test updated

---

## Start

Tell me what endpoint to create (e.g., "customer CRUD", "analytics summary endpoint", "promo code validation").
