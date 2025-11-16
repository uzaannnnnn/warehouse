import InvoiceHistoryPage from "./InvoiceHistoryPage";
import { PACKAGING_LOCATIONS } from "../../../constants/warehouseLocations";

export default function PackagingInvoiceHistoryPage() {
  return (
    <InvoiceHistoryPage
      segment="raw"
      pageTitle="History Invoice Kemasan"
      locationOptionsOverride={PACKAGING_LOCATIONS}
      locationStorageKeyOverride="warehouseCode_packaging"
    />
  );
}
