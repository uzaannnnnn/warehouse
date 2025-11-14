import "../index.css";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../features/auth/LoginPage";
import WarehouseLayout from "../features/warehouse/WarehouseLayout";
import WarehouseHomePage from "../features/warehouse/pages/WarehouseHomePage";
import ProductsPage from "../features/warehouse/pages/ProductsPage";
import ReturnPage from "../features/warehouse/pages/ReturnPage";
import InvoiceHistoryPage from "../features/warehouse/pages/InvoiceHistoryPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route path="/warehouse" element={<WarehouseLayout />}>
        <Route index element={<WarehouseHomePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="return" element={<ReturnPage />} />
        <Route path="invoices-history" element={<InvoiceHistoryPage />} />
      </Route>
    </Routes>
  );
}

export default App;



