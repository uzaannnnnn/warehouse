import ProductsPage from "./ProductsPage";
import { SPEEDSHOP_LOCATIONS } from "../../../constants/warehouseLocations";
import { WAREHOUSE_STORAGE_KEYS } from "../../../constants/warehouseStorageKeys";

export default function SpeedshopProductsPage() {
  return (
    <ProductsPage
      mode="finished"
      locationOptionsOverride={SPEEDSHOP_LOCATIONS}
      locationStorageKeyOverride={WAREHOUSE_STORAGE_KEYS.speedshopLocation}
      searchStorageKeyOverride="searchTerm_speedshop"
      pageTitle="Produk SpeedShop"
    />
  );
}

