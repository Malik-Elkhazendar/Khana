import { patchState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { PromoCodeItemDto } from '@khana/shared-dtos';
import { ApiService } from '../../../shared/services/api.service';
import { LoggerService } from '../../../shared/services/logger.service';
import {
  createActionKey,
  PromoCodesStoreStateSource,
  resolvePromoError,
  resolveRequestId,
  toPromoError,
  toggleActionKey,
  updateActionKey,
} from './promo-codes.store.models';

export const createPromoCodesMutationMethods = (
  store: PromoCodesStoreStateSource,
  api: ApiService,
  logger: LoggerService
) => {
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
        patchState(store, {
          loading: false,
          error: toPromoError(resolved.message),
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
          error: toPromoError(resolved.message),
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
    createPromo: async (
      request: Parameters<ApiService['createPromoCode']>[0]
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
      request: Parameters<ApiService['updatePromoCode']>[1]
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
};
