import { HttpErrorResponse } from '@angular/common/http';
import { WritableStateSource } from '@ngrx/signals';
import {
  CreatePromoCodeRequestDto,
  PromoCodeItemDto,
  PromoCodeListResponseDto,
  UpdatePromoCodeRequestDto,
} from '@khana/shared-dtos';

export type PromoErrorCode =
  | 'NETWORK'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export type PromoFilters = {
  facilityId: string | null;
  isActive: boolean | null;
  includeExpired: boolean;
  page: number;
  pageSize: number;
};

export type PromoModalMode = 'create' | 'edit';

export type PromoModalState = {
  isOpen: boolean;
  mode: PromoModalMode;
  editingPromoId: string | null;
};

export type PromoCodesState = {
  filters: PromoFilters;
  data: PromoCodeListResponseDto | null;
  loading: boolean;
  error: Error | null;
  errorCode: PromoErrorCode | null;
  actionLoadingByKey: Record<string, boolean>;
  actionErrorByKey: Record<string, string | null>;
  modal: PromoModalState;
};

export const PROMO_ERROR_MESSAGES: Record<PromoErrorCode, string> = {
  NETWORK: 'CLIENT_ERRORS.PROMO_CODES.NETWORK',
  VALIDATION: 'CLIENT_ERRORS.PROMO_CODES.VALIDATION',
  UNAUTHORIZED: 'API_ERRORS.UNAUTHORIZED',
  FORBIDDEN: 'CLIENT_ERRORS.PROMO_CODES.FORBIDDEN',
  NOT_FOUND: 'API_ERRORS.NOT_FOUND',
  CONFLICT: 'CLIENT_ERRORS.PROMO_CODES.CONFLICT',
  SERVER_ERROR: 'API_ERRORS.SERVER_ERROR',
  UNKNOWN: 'CLIENT_ERRORS.PROMO_CODES.UNKNOWN',
};

export const initialPromoCodesState: PromoCodesState = {
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

export type PromoCodesStoreSlice = {
  filters(): PromoFilters;
  data(): PromoCodeListResponseDto | null;
  loading(): boolean;
  error(): Error | null;
  errorCode(): PromoErrorCode | null;
  actionLoadingByKey(): Record<string, boolean>;
  actionErrorByKey(): Record<string, string | null>;
  modal(): PromoModalState;
};

export type PromoCodesStoreStateSource = WritableStateSource<PromoCodesState> &
  PromoCodesStoreSlice;

export type PromoCodesApiMethods = {
  createPromo: (request: CreatePromoCodeRequestDto) => Promise<boolean>;
  updatePromo: (
    promoId: string,
    request: UpdatePromoCodeRequestDto
  ) => Promise<boolean>;
  toggleActive: (
    item: PromoCodeItemDto,
    nextIsActive: boolean
  ) => Promise<boolean>;
};

export const toPromoError = (message: string): Error => new Error(message);

export const resolvePromoError = (
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

export const resolveRequestId = (err: unknown): string | undefined => {
  if (!(err instanceof HttpErrorResponse)) return undefined;
  return err.headers?.get('x-request-id') ?? undefined;
};

export const createActionKey = (): string => 'create';
export const updateActionKey = (promoId: string): string => `update:${promoId}`;
export const toggleActionKey = (promoId: string): string => `toggle:${promoId}`;
