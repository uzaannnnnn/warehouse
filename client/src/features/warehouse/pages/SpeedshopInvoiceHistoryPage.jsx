import InvoiceHistoryPage from "./InvoiceHistoryPage";
import { SPEEDSHOP_LOCATIONS } from "../../../constants/warehouseLocations";

export default function SpeedshopInvoiceHistoryPage() {
  return (
    <InvoiceHistoryPage
      segment="finished"
      locationOptionsOverride={SPEEDSHOP_LOCATIONS}
      locationStorageKeyOverride="warehouseCode_speedshop"
      pageTitle="History Invoice SpeedShop"
    />
  );
}

