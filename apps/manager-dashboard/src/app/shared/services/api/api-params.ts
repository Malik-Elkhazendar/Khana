import {
  AnalyticsBaseQueryDto,
  AnalyticsGroupBy,
  PromoCodeListQueryDto,
  WaitlistListQueryDto,
} from '@khana/shared-dtos';

export const buildAnalyticsParams = (
  query: AnalyticsBaseQueryDto & Partial<{ groupBy: AnalyticsGroupBy }>
): Record<string, string> => {
  const params: Record<string, string> = {
    from: query.from,
    to: query.to,
  };

  if (query.facilityId) {
    params['facilityId'] = query.facilityId;
  }
  if (query.timeZone) {
    params['timeZone'] = query.timeZone;
  }
  if (query.groupBy) {
    params['groupBy'] = query.groupBy;
  }

  return params;
};

export const buildWaitlistListParams = (
  query: WaitlistListQueryDto
): Record<string, string> => {
  const params: Record<string, string> = {
    from: query.from,
    to: query.to,
  };
  if (query.facilityId) {
    params['facilityId'] = query.facilityId;
  }
  if (query.status) {
    params['status'] = query.status;
  }
  if (query.page) {
    params['page'] = String(query.page);
  }
  if (query.pageSize) {
    params['pageSize'] = String(query.pageSize);
  }
  return params;
};

export const buildPromoCodeListParams = (
  query: PromoCodeListQueryDto
): Record<string, string> => {
  const params: Record<string, string> = {};

  if (query.facilityId) {
    params['facilityId'] = query.facilityId;
  }
  if (typeof query.isActive === 'boolean') {
    params['isActive'] = String(query.isActive);
  }
  if (typeof query.includeExpired === 'boolean') {
    params['includeExpired'] = String(query.includeExpired);
  }
  if (query.page) {
    params['page'] = String(query.page);
  }
  if (query.pageSize) {
    params['pageSize'] = String(query.pageSize);
  }
  return params;
};
