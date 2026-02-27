import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { InviteUserRequestDto, UserDto, UserRole } from '@khana/shared-dtos';
import { UiStatusBadgeComponent } from '../../shared/components';
import { ApiService } from '../../shared/services/api.service';
import { LocaleFormatService } from '../../shared/services/locale-format.service';
import { AuthStore } from '../../shared/state/auth.store';

const ASSIGNABLE_ROLES: ReadonlyArray<Exclude<UserRole, UserRole.OWNER>> = [
  UserRole.MANAGER,
  UserRole.STAFF,
  UserRole.VIEWER,
];

function sortUsersByName(users: UserDto[]): UserDto[] {
  return [...users].sort((left, right) => left.name.localeCompare(right.name));
}

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    UiStatusBadgeComponent,
  ],
  templateUrl: './team.component.html',
  styleUrl: './team.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamComponent {
  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly localeFormat = inject(LocaleFormatService);
  private readonly formBuilder = inject(FormBuilder);

  readonly users = signal<UserDto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly roleUpdatingUserId = signal<string | null>(null);
  readonly statusUpdatingUserId = signal<string | null>(null);
  readonly inviteLoading = signal(false);
  readonly inviteError = signal<string | null>(null);
  readonly inviteMessage = signal<string | null>(null);

  readonly currentUser = this.authStore.user;
  readonly isOwner = computed(
    () => this.currentUser()?.role === UserRole.OWNER
  );
  readonly assignableRoles = ASSIGNABLE_ROLES;

  readonly inviteForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: [
      UserRole.STAFF as Exclude<UserRole, UserRole.OWNER>,
      Validators.required,
    ],
  });

  constructor() {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .listUsers()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (users) => {
          this.users.set(sortUsersByName(users));
        },
        error: (err) => {
          this.error.set(
            this.resolveErrorMessage(err, 'Unable to load users.')
          );
        },
      });
  }

  retry(): void {
    this.loadUsers();
  }

  trackByUserId(_: number, item: UserDto): string {
    return item.id;
  }

  isOwnerUser(user: UserDto): boolean {
    return user.role === UserRole.OWNER;
  }

  isCurrentUser(user: UserDto): boolean {
    return this.currentUser()?.id === user.id;
  }

  canManageUser(user: UserDto): boolean {
    return (
      this.isOwner() && !this.isOwnerUser(user) && !this.isCurrentUser(user)
    );
  }

  isRoleUpdating(userId: string): boolean {
    return this.roleUpdatingUserId() === userId;
  }

  isStatusUpdating(userId: string): boolean {
    return this.statusUpdatingUserId() === userId;
  }

  onRoleChange(user: UserDto, nextRoleValue: string): void {
    if (!this.canManageUser(user) || this.isRoleUpdating(user.id)) {
      return;
    }

    if (
      !ASSIGNABLE_ROLES.includes(
        nextRoleValue as Exclude<UserRole, UserRole.OWNER>
      )
    ) {
      return;
    }

    const nextRole = nextRoleValue as Exclude<UserRole, UserRole.OWNER>;
    if (user.role === nextRole) {
      return;
    }

    this.actionError.set(null);
    this.roleUpdatingUserId.set(user.id);

    this.api
      .updateUserRole(user.id, { role: nextRole })
      .pipe(finalize(() => this.roleUpdatingUserId.set(null)))
      .subscribe({
        next: (updatedUser) => {
          this.replaceUser(updatedUser);
        },
        error: (err) => {
          this.actionError.set(
            this.resolveErrorMessage(err, 'Unable to update user role.')
          );
        },
      });
  }

  toggleUserStatus(user: UserDto): void {
    if (!this.canManageUser(user) || this.isStatusUpdating(user.id)) {
      return;
    }

    this.actionError.set(null);
    this.statusUpdatingUserId.set(user.id);

    this.api
      .updateUserStatus(user.id, { isActive: !user.isActive })
      .pipe(finalize(() => this.statusUpdatingUserId.set(null)))
      .subscribe({
        next: (updatedUser) => {
          this.replaceUser(updatedUser);
        },
        error: (err) => {
          this.actionError.set(
            this.resolveErrorMessage(err, 'Unable to update user status.')
          );
        },
      });
  }

  submitInvite(): void {
    if (!this.isOwner() || this.inviteLoading()) {
      return;
    }

    this.inviteForm.markAllAsTouched();
    if (this.inviteForm.invalid) {
      return;
    }

    const formValue = this.inviteForm.getRawValue();
    const request: InviteUserRequestDto = {
      email: formValue.email.trim().toLowerCase(),
      role: formValue.role,
    };

    this.inviteLoading.set(true);
    this.inviteError.set(null);
    this.inviteMessage.set(null);

    this.api
      .inviteUser(request)
      .pipe(finalize(() => this.inviteLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.inviteMessage.set(response.message);
          this.inviteForm.reset({
            email: '',
            role: UserRole.STAFF,
          });
          this.loadUsers();
        },
        error: (err) => {
          this.inviteError.set(
            this.resolveErrorMessage(err, 'Unable to send invitation.')
          );
        },
      });
  }

  roleBadgeTone(role: UserRole): 'success' | 'warning' | 'neutral' {
    if (role === UserRole.OWNER) return 'warning';
    if (role === UserRole.MANAGER) return 'success';
    return 'neutral';
  }

  formatDate(value?: Date | string | null): string {
    if (!value) {
      return '-';
    }

    return this.localeFormat.formatDate(value, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  private replaceUser(updatedUser: UserDto): void {
    const current = this.users();
    const index = current.findIndex((user) => user.id === updatedUser.id);

    if (index === -1) {
      this.users.set(sortUsersByName([...current, updatedUser]));
      return;
    }

    const next = [...current];
    next[index] = updatedUser;
    this.users.set(sortUsersByName(next));
  }

  private resolveErrorMessage(err: unknown, fallbackMessage: string): string {
    if (err instanceof HttpErrorResponse) {
      if (typeof err.error?.message === 'string') {
        return err.error.message;
      }

      if (Array.isArray(err.error?.message)) {
        return err.error.message.join(', ');
      }

      if (typeof err.message === 'string' && err.message.trim()) {
        return err.message;
      }
    }

    if (err instanceof Error && err.message.trim()) {
      return err.message;
    }

    return fallbackMessage;
  }
}
