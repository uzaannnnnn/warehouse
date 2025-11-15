import "../index.css";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../features/auth/LoginPage";
import WarehouseLayout from "../features/warehouse/WarehouseLayout";
import WarehouseHomePage from "../features/warehouse/pages/WarehouseHomePage";
import ProductsPage from "../features/warehouse/pages/ProductsPage";
import ReturnPage from "../features/warehouse/pages/ReturnPage";
import InvoiceHistoryPage from "../features/warehouse/pages/InvoiceHistoryPage";
import RawMaterialsPage from "../features/warehouse/pages/RawMaterialsPage";
import RawMaterialsInvoiceHistoryPage from "../features/warehouse/pages/RawMaterialsInvoiceHistoryPage";
import ProductionPage from "../features/warehouse/pages/ProductionPage";
import SpeedshopPage from "../features/warehouse/pages/SpeedshopPage";
import SpeedshopProductsPage from "../features/warehouse/pages/SpeedshopProductsPage";
import SpeedshopInvoiceHistoryPage from "../features/warehouse/pages/SpeedshopInvoiceHistoryPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route path="/warehouse" element={<WarehouseLayout />}>
        <Route index element={<WarehouseHomePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="raw-materials" element={<RawMaterialsPage />} />
        <Route path="return" element={<ReturnPage />} />
        <Route path="invoices-history" element={<InvoiceHistoryPage />} />
        <Route
          path="raw-invoices-history"
          element={<RawMaterialsInvoiceHistoryPage />}
        />
        <Route path="productions" element={<ProductionPage />} />
        <Route path="speedshop" element={<SpeedshopPage />} />
        <Route
          path="speedshop-products"
          element={<SpeedshopProductsPage />}
        />
        <Route
          path="speedshop-invoices-history"
          element={<SpeedshopInvoiceHistoryPage />}
        />
      </Route>
    </Routes>
  );
}

export default App;



