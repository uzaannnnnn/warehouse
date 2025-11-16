import {
  RAW_LOCATIONS,
  PRODUCT_LOCATIONS,
  PRODUCTION_LOCATIONS,
  PACKAGING_LOCATIONS,
} from "../constants/warehouseLocations";

export function getRawLocationForProductionLocation(productionLocation) {
  const index = PRODUCTION_LOCATIONS.indexOf(productionLocation);
  if (index >= 0 && RAW_LOCATIONS[index]) {
    return RAW_LOCATIONS[index];
  }
  if (productionLocation?.endsWith("-KTP")) return RAW_LOCATIONS[0];
  if (productionLocation?.endsWith("-DPK")) return RAW_LOCATIONS[1];
  if (productionLocation?.endsWith("-BGR")) return RAW_LOCATIONS[2];
  return RAW_LOCATIONS[0];
}

export function getProductLocationForProductionLocation(productionLocation) {
  const index = PRODUCTION_LOCATIONS.indexOf(productionLocation);
  if (index >= 0 && PRODUCT_LOCATIONS[index]) {
    return PRODUCT_LOCATIONS[index];
  }
  if (productionLocation?.endsWith("-KTP")) return PRODUCT_LOCATIONS[0];
  if (productionLocation?.endsWith("-DPK")) return PRODUCT_LOCATIONS[1];
  if (productionLocation?.endsWith("-BGR")) return PRODUCT_LOCATIONS[2];
  return PRODUCT_LOCATIONS[0];
}

export function getPackagingLocationForProductionLocation(productionLocation) {
  const index = PRODUCTION_LOCATIONS.indexOf(productionLocation);
  if (index >= 0 && PACKAGING_LOCATIONS[index]) {
    return PACKAGING_LOCATIONS[index];
  }
  if (productionLocation?.endsWith("-KTP")) return PACKAGING_LOCATIONS[0];
  if (productionLocation?.endsWith("-DPK")) return PACKAGING_LOCATIONS[1];
  if (productionLocation?.endsWith("-BGR")) return PACKAGING_LOCATIONS[2];
  return PACKAGING_LOCATIONS[0];
}

