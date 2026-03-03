import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  CreatePromoCodeRequestDto,
  PromoCodeItemDto,
  PromoCodeListResponseDto,
  UpdatePromoCodeRequestDto,
} from '@khana/shared-dtos';
import { ApiService } from '../../shared/services/api.service';
import { LoggerService } from '../../shared/services/logger.service';

type PromoErrorCode =
  | 'NETWORK'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

type PromoFilters = {
  facilityId: string | null;
  isActive: boolean | null;
  includeExpired: boolean;
  page: number;
  pageSize: number;
};

type PromoModalMode = 'create' | 'edit';

type PromoModalState = {
  isOpen: boolean;
  mode: PromoModalMode;
  editingPromoId: string | null;
};

type PromoCodesState = {
  filters: PromoFilters;
  data: PromoCodeListResponseDto | null;
  loading: boolean;
  error: Error | null;
  errorCode: PromoErrorCode | null;
  actionLoadingByKey: Record<string, boolean>;
  actionErrorByKey: Record<string, string | null>;
  modal: PromoModalState;
};

const PROMO_ERROR_MESSAGES: Record<PromoErrorCode, string> = {
  NETWORK: 'CLIENT_ERRORS.PROMO_CODES.NETWORK',
  VALIDATION: 'CLIENT_ERRORS.PROMO_CODES.VALIDATION',
  UNAUTHORIZED: 'API_ERRORS.UNAUTHORIZED',
  FORBIDDEN: 'CLIENT_ERRORS.PROMO_CODES.FORBIDDEN',
  NOT_FOUND: 'API_ERRORS.NOT_FOUND',
  CONFLICT: 'CLIENT_ERRORS.PROMO_CODES.CONFLICT',
  SERVER_ERROR: 'API_ERRORS.SERVER_ERROR',
  UNKNOWN: 'CLIENT_ERRORS.PROMO_CODES.UNKNOWN',
};

const initialState: PromoCodesState = {
  filters: {
    facilityId: null,
    isActive: null,
    includeExpired: false,
    page: 1,
    pageSize: 20,
  },
  data: null,
  loading: false,
  error: null,
  errorCode: null,
  actionLoadingByKey: {},
  actionErrorByKey: {},
  modal: {
    isOpen: false,
    mode: 'create',
    editingPromoId: null,
  },
};

const toError = (message: string): Error => new Error(message);

const resolvePromoError = (
  err: unknown
): { code: PromoErrorCode; message: string } => {
  if (err instanceof HttpErrorResponse) {
    const statusMap: Record<number, PromoErrorCode> = {
      0: 'NETWORK',
      400: 'VALIDATION',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      500: 'SERVER_ERROR',
    };
    const fallbackCode = statusMap[err.status] ?? 'UNKNOWN';
    const serverMessage =
      typeof err.error?.message === 'string' ? err.error.message : undefined;
    return {
      code: fallbackCode,
      message: serverMessage ?? PROMO_ERROR_MESSAGES[fallbackCode],
    };
  }

  return {
    code: 'UNKNOWN',
    message: PROMO_ERROR_MESSAGES.UNKNOWN,
  };
};

const resolveRequestId = (err: unknown): string | undefined => {
  if (!(err instanceof HttpErrorResponse)) return undefined;
  return err.headers?.get('x-request-id') ?? undefined;
};

const createActionKey = (): string => 'create';
const updateActionKey = (promoId: string): string => `update:${promoId}`;
const toggleActionKey = (promoId: string): string => `toggle:${promoId}`;

export const PromoCodesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (store, api = inject(ApiService), logger = inject(LoggerService)) => {
      let inFlightLoad: Promise<void> | null = null;
      const inFlightActions = new Map<string, Promise<boolean>>();

      const load = async (): Promise<void> => {
        if (inFlightLoad) {
          return inFlightLoad;
        }

        const promise = (async () => {
          patchState(store, { loading: true, error: null, errorCode: null });
          const filters = store.filters();

          try {
            const data = await firstValueFrom(
              api.listPromoCodes({
                facilityId: filters.facilityId ?? undefined,
                isActive: filters.isActive ?? undefined,
                includeExpired: filters.includeExpired,
                page: filters.page,
                pageSize: filters.pageSize,
              })
            );
            patchState(store, { data, loading: false });
          } catch (err) {
            const resolved = resolvePromoError(err);
            const requestId = resolveRequestId(err);
            const context: Record<string, unknown> = {
              filters,
            };
            if (requestId) {
              context['requestId'] = requestId;
            }

            logger.error(
              'client.promo_codes.load.failed',
              'Failed to load promo codes list',
              context,
              err
            );

            patchState(store, {
              loading: false,
              error: toError(resolved.message),
              errorCode: resolved.code,
            });
          }
        })();

        inFlightLoad = promise;
        promise.finally(() => {
          inFlightLoad = null;
        });
        return promise;
      };

      const runAction = async (
        key: string,
        operation: () => Promise<void>,
        onErrorLog: (err: unknown) => void
      ): Promise<boolean> => {
        const existing = inFlightActions.get(key);
        if (existing) {
          return existing;
        }

        const actionPromise = (async (): Promise<boolean> => {
          patchState(store, (state) => ({
            actionLoadingByKey: { ...state.actionLoadingByKey, [key]: true },
            actionErrorByKey: { ...state.actionErrorByKey, [key]: null },
          }));

          try {
            await operation();
            return true;
          } catch (err) {
            onErrorLog(err);
            const resolved = resolvePromoError(err);
            patchState(store, (state) => ({
              error: toError(resolved.message),
              errorCode: resolved.code,
              actionErrorByKey: {
                ...state.actionErrorByKey,
                [key]: resolved.message,
              },
            }));
            return false;
          } finally {
            patchState(store, (state) => ({
              actionLoadingByKey: { ...state.actionLoadingByKey, [key]: false },
            }));
          }
        })();

        inFlightActions.set(key, actionPromise);
        actionPromise.finally(() => inFlightActions.delete(key));
        return actionPromise;
      };

      return {
        load: async (): Promise<void> => {
          await load();
        },
        setFilters: (patch: Partial<PromoFilters>): void => {
          patchState(store, (state) => {
            const shouldResetPage =
              patch.facilityId !== undefined ||
              patch.isActive !== undefined ||
              patch.includeExpired !== undefined ||
              patch.pageSize !== undefined;

            return {
              filters: {
                ...state.filters,
                ...patch,
                page: patch.page ?? (shouldResetPage ? 1 : state.filters.page),
              },
            };
          });
        },
        setPage: (page: number): void => {
          patchState(store, (state) => ({
            filters: {
              ...state.filters,
              page,
            },
          }));
        },
        openCreateModal: (): void => {
          patchState(store, {
            modal: {
              isOpen: true,
              mode: 'create',
              editingPromoId: null,
            },
          });
        },
        openEditModal: (item: PromoCodeItemDto): void => {
          patchState(store, {
            modal: {
              isOpen: true,
              mode: 'edit',
              editingPromoId: item.id,
            },
          });
        },
        closeModal: (): void => {
          patchState(store, {
            modal: {
              isOpen: false,
              mode: 'create',
              editingPromoId: null,
            },
          });
        },
        clearError: (): void => {
          patchState(store, {
            error: null,
            errorCode: null,
          });
        },
        createPromo: async (
          request: CreatePromoCodeRequestDto
        ): Promise<boolean> => {
          const key = createActionKey();
          const success = await runAction(
            key,
            async () => {
              await firstValueFrom(api.createPromoCode(request));
              patchState(store, {
                modal: {
                  isOpen: false,
                  mode: 'create',
                  editingPromoId: null,
                },
              });
              await load();
            },
            (err) => {
              const requestId = resolveRequestId(err);
              const context: Record<string, unknown> = {};
              if (requestId) {
                context['requestId'] = requestId;
              }
              logger.error(
                'client.promo_codes.create.failed',
                'Failed to create promo code',
                context,
                err
              );
            }
          );
          return success;
        },
        updatePromo: async (
          promoId: string,
          request: UpdatePromoCodeRequestDto
        ): Promise<boolean> => {
          const key = updateActionKey(promoId);
          const success = await runAction(
            key,
            async () => {
              await firstValueFrom(api.updatePromoCode(promoId, request));
              patchState(store, {
                modal: {
                  isOpen: false,
                  mode: 'create',
                  editingPromoId: null,
                },
              });
              await load();
            },
            (err) => {
              const requestId = resolveRequestId(err);
              const context: Record<string, unknown> = { promoId };
              if (requestId) {
                context['requestId'] = requestId;
              }
              logger.error(
                'client.promo_codes.update.failed',
                'Failed to update promo code',
                context,
                err
              );
            }
          );
          return success;
        },
        toggleActive: async (
          item: PromoCodeItemDto,
          nextIsActive: boolean
        ): Promise<boolean> => {
          const key = toggleActionKey(item.id);
          const success = await runAction(
            key,
            async () => {
              await firstValueFrom(
                api.updatePromoCode(item.id, { isActive: nextIsActive })
              );
              await load();
            },
            (err) => {
              const requestId = resolveRequestId(err);
              const context: Record<string, unknown> = {
                promoId: item.id,
                nextIsActive,
              };
              if (requestId) {
                context['requestId'] = requestId;
              }
              logger.error(
                'client.promo_codes.toggle_active.failed',
                'Failed to toggle promo code active state',
                context,
                err
              );
            }
          );
          return success;
        },
        actionKeyForCreate: createActionKey,
        actionKeyForUpdate: updateActionKey,
        actionKeyForToggle: toggleActionKey,
      };
    }
  )
);
