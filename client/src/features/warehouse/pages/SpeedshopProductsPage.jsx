import ProductsPage from "./ProductsPage";
import { SPEEDSHOP_LOCATIONS } from "../../../constants/warehouseLocations";

export default function SpeedshopProductsPage() {
  return (
    <ProductsPage
      mode="finished"
      locationOptionsOverride={SPEEDSHOP_LOCATIONS}
      locationStorageKeyOverride="warehouseCode_speedshop"
      searchStorageKeyOverride="searchTerm_speedshop"
      pageTitle="Produk SpeedShop"
    />
  );
}

