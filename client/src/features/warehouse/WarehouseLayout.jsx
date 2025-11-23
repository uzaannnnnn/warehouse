import { Navigate, Outlet, useLocation } from "react-router-dom";
import Sidebar from "../../components/layout/Sidebar";
import Header from "../../components/organisms/Header";
import { useAuth } from "../../context/AuthContext";

export default function WarehouseLayout() {
  const { logout, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Batasi akses untuk role warehouse hanya ke halaman produk/online packing
  if (user?.role === "warehouse") {
    const allowed = ["/warehouse/products", "/warehouse/invoices-history"];
    const current = location.pathname.toLowerCase();
    const isAllowed = allowed.some((path) => current.startsWith(path));
    if (!isAllowed) {
      return <Navigate to="/warehouse/products" replace />;
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 px-6">
        <Header onLogout={logout} />
        <Outlet />
      </main>
    </div>
  );
}
