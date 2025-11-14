import { Outlet } from "react-router-dom";
import Sidebar from "../../components/layout/Sidebar";
import Header from "../../components/organisms/Header";
import { useAuth } from "../../context/AuthContext";

export default function WarehouseLayout() {
  const { logout } = useAuth();

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
