---
name: database-architect
description: >
  Database architecture for Khana: design TypeORM entities, generate migrations,
  enforce multi-tenancy at the data layer, and manage schema evolution. Use when
  adding new entities, modifying existing ones, or designing data relationships.
# Claude Code extension:
disable-model-invocation: true
---

# Database Architect — Entity & Migration Design

Design and implement the Khana data layer.

## Key References

- Architecture rules: `CLAUDE.md`
- Entity files: `libs/data-access/src/lib/entities/`
- Migrations: `libs/data-access/src/lib/migrations/`
- Data source config: `apps/api/src/typeorm/data-source.ts`
- Migration commands: `docs/current/scripts.md`
- Entity design rules and patterns: `.claude/skills/project-guardrails/SKILL.md §8`

---

## Entity Pattern

```ts
// libs/data-access/src/lib/entities/resource.entity.ts

@Entity({ name: 'resources' }) // explicit table name
@Index('resources_tenant_name_unique', ['tenantId', 'name'], { unique: true })
@Check('resources_capacity_positive_chk', `"capacity" > 0`)
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'uuid' })
  tenantId!: string; // FK column, no @JoinColumn

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @OneToMany(() => ChildEntity, (child) => child.resource)
  children!: ChildEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

### Column Type Guide

| Data                | TypeORM type                                            |
| ------------------- | ------------------------------------------------------- |
| UUID foreign key    | `{ type: 'uuid' }`                                      |
| Short string (≤ 50) | `{ type: 'varchar', length: 50 }`                       |
| Long text           | `{ type: 'text' }`                                      |
| Money               | `{ type: 'decimal', precision: 10, scale: 2 }`          |
| Boolean             | `{ type: 'boolean', default: false }`                   |
| Enum                | `{ type: 'enum', enum: MyEnum, default: MyEnum.VALUE }` |
| Nullable            | add `nullable: true`                                    |

---

## Multi-Tenancy Data Rules

- Every entity that belongs to a tenant **must** have a `tenantId: string` column
- Never query without scoping by `tenantId`
- Tenant scope is enforced in service layer (not at DB level in current implementation)
- For cross-tenant admin queries: explicit justification required in code comments

---

## After Adding/Modifying an Entity

**Always** run these steps in order:

```bash
# 1. Export the entity from the data-access barrel
#    libs/data-access/src/index.ts

# 2. Register entity in the TypeORM feature module where it's used
#    TypeOrmModule.forFeature([NewEntity])

# 3. Generate migration
npm run migration:generate -- libs/data-access/src/lib/migrations/<DescriptiveName>

# 4. Review the generated migration file — verify up() and down() are correct

# 5. Run migration locally
npm run migration:run

# 6. Verify schema with psql
npm run db:connect
```

---

## Migration Rules

- Always generate with the CLI — never write raw SQL migrations by hand
- Every migration must have a working `down()` (rollback) method
- Test rollback before committing: `npm run migration:revert`
- Naming convention: `<timestamp>-<DescriptivePascalCase>.ts`
- Data migrations (backfills) go in separate migration files from schema changes

---

## Common Relationship Patterns

```ts
// ManyToOne (child side) — most common for tenancy:
@Column({ type: 'uuid' })
tenantId!: string;

@ManyToOne(() => Tenant)
tenant!: Tenant;

// OneToMany (parent side):
@OneToMany(() => Booking, (booking) => booking.facility)
bookings!: Booking[];

// ManyToMany with explicit join table:
@ManyToMany(() => Tag)
@JoinTable({
  name: 'resource_tags',
  joinColumn: { name: 'resourceId' },
  inverseJoinColumn: { name: 'tagId' },
})
tags!: Tag[];
```

---

## Checklist: New Entity

- [ ] Entity file in `libs/data-access/src/lib/entities/<name>.entity.ts`
- [ ] Exported from `libs/data-access/src/index.ts`
- [ ] Registered in relevant `TypeOrmModule.forFeature([])`
- [ ] Includes `tenantId` if tenant-scoped
- [ ] `@PrimaryGeneratedColumn('uuid')` for PK
- [ ] `@CreateDateColumn()` and `@UpdateDateColumn()` present
- [ ] `@Check()` constraints for any invariants
- [ ] Migration generated and reviewed
- [ ] Rollback tested locally

---

## Start

Tell me what entity or migration to design (e.g., "customer entity with tags", "add monthly revenue target to tenant", "waitlist entry relationship to booking").
