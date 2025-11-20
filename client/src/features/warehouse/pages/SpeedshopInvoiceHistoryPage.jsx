import InvoiceHistoryPage from "./InvoiceHistoryPage";
import { SPEEDSHOP_LOCATIONS } from "../../../constants/warehouseLocations";
import { WAREHOUSE_STORAGE_KEYS } from "../../../constants/warehouseStorageKeys";

export default function SpeedshopInvoiceHistoryPage() {
  return (
    <InvoiceHistoryPage
      segment="finished"
      locationOptionsOverride={SPEEDSHOP_LOCATIONS}
      locationStorageKeyOverride={WAREHOUSE_STORAGE_KEYS.speedshopLocation}
      pageTitle="History Invoice SpeedShop"
    />
  );
}

