import InvoiceHistoryPage from "./InvoiceHistoryPage";
import { WAREHOUSE_STORAGE_KEYS } from "../../../constants/warehouseStorageKeys";
import { PRODUCTION_LOCATIONS } from "../../../constants/warehouseLocations";
import {
  getRawLocationForProductionLocation,
  getProductionLocationForRawLocation,
} from "../../../utils/warehouseLocationMap";

export default function ProductionInvoiceHistoryPage() {
  return (
    <InvoiceHistoryPage
      segment="raw"
      pageTitle="History Invoice Produksi"
      locationType="produksi"
      locationOptionsOverride={PRODUCTION_LOCATIONS}
      locationStorageKeyOverride={WAREHOUSE_STORAGE_KEYS.productionLocation}
      locationToApiMapper={getRawLocationForProductionLocation}
      displayLocationMapper={getProductionLocationForRawLocation}
      productionClaimedOnly={true}
    />
  );
}
