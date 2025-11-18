import "../index.css";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../features/auth/LoginPage";
import WarehouseLayout from "../features/warehouse/WarehouseLayout";
import WarehouseHomePage from "../features/warehouse/pages/WarehouseHomePage";

import ProductsPage from "../features/warehouse/pages/ProductsPage";
import RawMaterialsPage from "../features/warehouse/pages/RawMaterialsPage";
import PackagingPage from "../features/warehouse/pages/PackagingPage";

import ReturnPage from "../features/warehouse/pages/ReturnPage";

import InvoiceHistoryPage from "../features/warehouse/pages/InvoiceHistoryPage";
import RawMaterialsInvoiceHistoryPage from "../features/warehouse/pages/RawMaterialsInvoiceHistoryPage";
import PackagingInvoiceHistoryPage from "../features/warehouse/pages/PackagingInvoiceHistoryPage";

import ProductionPage from "../features/warehouse/pages/ProductionPage";

import SpeedshopPage from "../features/warehouse/pages/SpeedshopPage";
import SpeedshopProductsPage from "../features/warehouse/pages/SpeedshopProductsPage";
import SpeedshopInvoiceHistoryPage from "../features/warehouse/pages/SpeedshopInvoiceHistoryPage";
import ProductionInvoiceHistoryPage from "../features/warehouse/pages/ProductionInvoiceHistoryPage";
import ProductionResultsPage from "../features/warehouse/pages/ProductionResultsPage";
import { PRODUCT_LOCATIONS } from "../constants/warehouseLocations";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route path="/warehouse" element={<WarehouseLayout />}>
        <Route index element={<WarehouseHomePage />} />

        <Route path="products" element={<ProductsPage />} />

        <Route path="raw-materials" element={<RawMaterialsPage />} />
        <Route path="raw-invoices-history" element={<RawMaterialsInvoiceHistoryPage />} />

        <Route path="packaging" element={<PackagingPage />} />
        <Route path="packaging-invoices-history" element={<PackagingInvoiceHistoryPage />} />

        <Route path="return" element={<ReturnPage />} />

        <Route
          path="invoices-history"
          element={
            <InvoiceHistoryPage locationOptionsOverride={PRODUCT_LOCATIONS} />
          }
        />

        <Route path="productions" element={<ProductionPage />} />

        <Route path="production-results" element={<ProductionResultsPage />} />

        <Route
          path="production-invoices-history"
          element={<ProductionInvoiceHistoryPage />}
        />

        <Route path="speedshop" element={<SpeedshopPage />} />
        <Route path="speedshop-products" element={<SpeedshopProductsPage />} />
        <Route
          path="speedshop-invoices-history"
          element={<SpeedshopInvoiceHistoryPage />}
        />
      </Route>
    </Routes>
  );
}

export default App;
