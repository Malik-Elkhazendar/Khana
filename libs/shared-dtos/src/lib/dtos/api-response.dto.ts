/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  /** Whether the request was successful */
  success: boolean;

  /** Response data (on success) */
  data?: T;

  /** Error message (on failure) */
  error?: string;

  /** Error code (for client handling) */
  errorCode?: string;

  /** Validation errors (for form submissions) */
  validationErrors?: ValidationError[];

  /** Additional metadata */
  meta?: ResponseMeta;
}

/**
 * Validation error detail
 */
export interface ValidationError {
  /** Field name */
  field: string;

  /** Error message */
  message: string;

  /** Error code */
  code?: string;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  /** Request timestamp */
  timestamp: Date;

  /** Request ID (for tracing) */
  requestId?: string;

  /** Response time in ms */
  responseTime?: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  /** Pagination info */
  pagination: PaginationInfo;
}

/**
 * Pagination information
 */
export interface PaginationInfo {
  /** Current page (1-indexed) */
  page: number;

  /** Items per page */
  limit: number;

  /** Total items */
  total: number;

  /** Total pages */
  totalPages: number;

  /** Has next page */
  hasNext: boolean;

  /** Has previous page */
  hasPrevious: boolean;
}

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;

  /** Items per page (default: 20, max: 100) */
  limit?: number;

  /** Sort field */
  sortBy?: string;

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * List query with filters
 */
export interface ListQueryDto extends PaginationParams {
  /** Search query */
  search?: string;

  /** Filter by status */
  status?: string;

  /** Filter by date range start */
  fromDate?: Date;

  /** Filter by date range end */
  toDate?: Date;
}
