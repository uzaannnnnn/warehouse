import InvoiceHistoryPage from "./InvoiceHistoryPage";

export default function PackagingInvoiceHistoryPage() {
  return (
    <InvoiceHistoryPage
      segment="raw"
      pageTitle="History Invoice Kemasan"
      locationType="kemasan"
      locationStorageKeyOverride="warehouseCode_packaging"
    />
  );
}
