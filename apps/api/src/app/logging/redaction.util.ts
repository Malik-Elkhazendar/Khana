import { maskEmail, maskPhone } from '@khana/shared-utils';
import { REDACTED_FIELDS, MASKED_FIELDS } from './logging.constants';

const REDACTED_VALUE = '[REDACTED]';
const FUNCTION_PLACEHOLDER = '[Function]';
const UNSERIALIZABLE_PLACEHOLDER = '[Unserializable]';

/**
 * Deep-clone and redact sensitive fields from a value.
 * - REDACTED_FIELDS -> '[REDACTED]'
 * - MASKED_FIELDS (email/phone) -> masked versions
 * - Handles circular references and non-JSON values safely
 */
export function redact<T>(obj: T): T {
  try {
    return redactValue(obj, new WeakMap<object, unknown>()) as T;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { redactionError: true, reason } as T;
  }
}

function redactValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value == null) return value;

  const valueType = typeof value;
  if (valueType === 'bigint') return value.toString();
  if (valueType === 'function') return FUNCTION_PLACEHOLDER;
  if (valueType === 'symbol') return String(value);
  if (valueType !== 'object') return value;
  const objectValue = value as object;

  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (value instanceof Error) return serializeError(value);
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return `[Buffer:${value.length}]`;
  }

  if (seen.has(objectValue)) {
    return seen.get(objectValue);
  }

  if (Array.isArray(value)) {
    const clonedArray: unknown[] = [];
    seen.set(objectValue, clonedArray);
    for (const item of value) {
      clonedArray.push(redactValue(item, seen));
    }
    return clonedArray;
  }

  if (value instanceof Map) {
    const clonedMap = new Map<unknown, unknown>();
    seen.set(value, clonedMap);
    for (const [mapKey, mapValue] of value.entries()) {
      clonedMap.set(redactValue(mapKey, seen), redactValue(mapValue, seen));
    }
    return clonedMap;
  }

  if (value instanceof Set) {
    const clonedSet = new Set<unknown>();
    seen.set(value, clonedSet);
    for (const setValue of value.values()) {
      clonedSet.add(redactValue(setValue, seen));
    }
    return clonedSet;
  }

  const source = value as Record<string, unknown>;
  const clonedRecord: Record<string, unknown> = {};
  seen.set(objectValue, clonedRecord);

  for (const key of Object.keys(source)) {
    const lowerKey = key.toLowerCase();
    let currentValue: unknown;
    try {
      currentValue = source[key];
    } catch {
      clonedRecord[key] = UNSERIALIZABLE_PLACEHOLDER;
      continue;
    }

    if (REDACTED_FIELDS.includes(lowerKey)) {
      clonedRecord[key] = REDACTED_VALUE;
      continue;
    }

    if (MASKED_FIELDS.includes(lowerKey) && typeof currentValue === 'string') {
      if (lowerKey === 'email') {
        clonedRecord[key] = maskEmail(currentValue);
      } else if (lowerKey === 'phone') {
        clonedRecord[key] = maskPhone(currentValue);
      } else {
        clonedRecord[key] = currentValue;
      }
      continue;
    }

    clonedRecord[key] = redactValue(currentValue, seen);
  }

  return clonedRecord;
}

function serializeError(error: Error): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    name: error.name,
    message: error.message,
  };
  if (error.stack) {
    serialized['stack'] = error.stack;
  }
  return serialized;
}
