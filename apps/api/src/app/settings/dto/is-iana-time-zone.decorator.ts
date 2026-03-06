import { isValidIanaTimeZone } from '@khana/shared-dtos';
import { registerDecorator, ValidationOptions } from 'class-validator';

export const IsIanaTimeZone = (validationOptions?: ValidationOptions) => {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'isIanaTimeZone',
      target: target.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return isValidIanaTimeZone(value);
        },
      },
    });
  };
};
