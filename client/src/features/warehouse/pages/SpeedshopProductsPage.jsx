import { useEffect, useState } from "react";
import ProductsPage from "./ProductsPage";
import { SPEEDSHOP_LOCATIONS } from "../../../constants/warehouseLocations";
import { WAREHOUSE_STORAGE_KEYS } from "../../../constants/warehouseStorageKeys";
import { fetchManagementLocationsByType } from "../api/management";

export default function SpeedshopProductsPage() {
  const [locationOptions, setLocationOptions] = useState(SPEEDSHOP_LOCATIONS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchManagementLocationsByType("speedshop");
        if (cancelled) return;
        const labels = remote.map((loc) => loc.label || loc.code).filter(Boolean);
        if (labels.length) setLocationOptions(labels);
      } catch (error) {
        console.error("Gagal memuat lokasi speedshop:", error.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ProductsPage
      mode="finished"
      locationOptionsOverride={locationOptions}
      locationStorageKeyOverride={WAREHOUSE_STORAGE_KEYS.speedshopLocation}
      searchStorageKeyOverride="searchTerm_speedshop"
      pageTitle="Produk SpeedShop"
    />
  );
}

