import InvoiceHistoryPage from "./InvoiceHistoryPage";
import { WAREHOUSE_STORAGE_KEYS } from "../../../constants/warehouseStorageKeys";

export default function SpeedshopInvoiceHistoryPage() {
  return (
    <InvoiceHistoryPage
      segment="finished"
      locationType="speedshop"
      locationStorageKeyOverride={WAREHOUSE_STORAGE_KEYS.speedshopLocation}
      pageTitle="History Invoice SpeedShop"
    />
  );
}

