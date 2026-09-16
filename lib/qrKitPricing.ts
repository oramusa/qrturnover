export const QR_KIT_FIRST_PROPERTY_CENTS = 3900;
export const QR_KIT_ADDITIONAL_PROPERTY_CENTS = 1500;
export const MAX_QR_KIT_PROPERTIES = 10;

export function calculateQrKitPrice(propertyCount: number) {
  if (!Number.isInteger(propertyCount) || propertyCount < 1 || propertyCount > MAX_QR_KIT_PROPERTIES) {
    throw new RangeError(`Property count must be between 1 and ${MAX_QR_KIT_PROPERTIES}.`);
  }

  return QR_KIT_FIRST_PROPERTY_CENTS
    + (propertyCount - 1) * QR_KIT_ADDITIONAL_PROPERTY_CENTS;
}
