import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  FiHome,
  FiCreditCard,
  FiRotateCcw,
  FiBox,
  FiFileText,
  FiUsers,
  FiCheckSquare,
  FiList,
  FiImage,
} from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";

export default function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => JSON.parse(localStorage.getItem("sidebarCollapsed")) || false
  );

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(collapsed));
  }, [collapsed]);

  const menu = [
    {
      label: "Dashboard",
      path: "/manager",
      icon: <FiHome />,
      roles: ["manager"],
    },
    {
      label: "Users",
      path: "/manager/account",
      icon: <FiUsers />,
      roles: ["manager"],
    },
    {
      label: "Homepage Banners",
      path: "/manager/banners",
      icon: <FiImage />,
      roles: ["manager"],
    },
    {
      label: "Rekap Order",
      path: "/manager/orders-recap",
      icon: <FiList />,
      roles: ["manager"],
    },
    {
      label: "Accounting",
      roles: ["manager", "accounting"],
      children: [
        {
          label: "Payment Data",
          path: "/accounting/payment",
          icon: <FiCreditCard />,
        },
        {
          label: "Complaints",
          path: "/accounting/complaints",
          icon: <FiFileText />,
        },
      ],
    },
    {
      label: "Warehouse Team",
      roles: ["manager", "warehouse"],
      children: [
        { label: "Products", path: "/warehouse/products", icon: <FiBox /> },
        {
          label: "History Invoice",
          path: "/warehouse/invoices-history",
          icon: <FiFileText />,
        },
      ],
    },
    {
      label: "Resi Team",
      roles: ["manager", "resi"],
      children: [
        { label: "Resi Data", path: "/resi/data", icon: <FiFileText /> },
      ],
    },
    {
      label: "QC Team",
      roles: ["manager", "qc"],
      children: [
        { label: "QC Data", path: "/qc/data", icon: <FiCheckSquare /> },
      ],
    },
  ];

  const allowedMenu = menu.filter((item) => {
    if (!user) return false;
    if (user.role === "manager") return true;
    return Array.isArray(item.roles) && item.roles.includes(user.role);
  });

  return (
    <aside
      className={`flex flex-col bg-white shadow-md 
        transition-[width,margin] duration-300 ease-in-out
        ${
          collapsed
            ? "ml-[-2px] mt-4 w-[72px] rounded-r-full"
            : "my-4 ml-3 w-[256px] rounded-2xl"
        }`}
    >
      <div
        onClick={() => setCollapsed(!collapsed)}
        className="flex cursor-pointer items-center justify-center pb-2 pt-10"
      >
        {!collapsed ? (
          <img
            src="/logo-modifikasiori.webp"
            alt="Modifikasi Ori"
            className="h-8"
          />
        ) : (
          <img
            src="/logo-mini.webp"
            alt="Modifikasi Ori Mini"
            className="h-8"
          />
        )}
      </div>

      <nav className="flex-1 space-y-2 p-4">
        {allowedMenu.map((item) => (
          <div key={item.label}>
            {item.children ? (
              <div className="space-y-1">
                {!collapsed && (
                  <div className="px-3 py-1 text-xs font-semibold uppercase text-gray-500">
                    {item.label}
                  </div>
                )}
                {item.children.map(({ label, path, icon }) => {
                  const alsoActive =
                    path === "/packing/data" &&
                    location.pathname.startsWith("/packing/scan");
                  return (
                    <TooltipWrapper
                      key={label}
                      label={label}
                      collapsed={collapsed}
                    >
                      <NavLink
                        to={path}
                        className={({ isActive }) => {
                          const active = isActive || alsoActive;
                          return `flex w-full cursor-pointer items-center rounded-md px-3 py-2 transition-colors ${
                            active
                              ? "bg-red-500 text-white"
                              : "text-gray-700 hover:bg-gray-100"
                          }`;
                        }}
                      >
                        <span className="mr-2 flex h-5 w-5 items-center justify-center">
                          {icon}
                        </span>
                        {!collapsed && <span>{label}</span>}
                      </NavLink>
                    </TooltipWrapper>
                  );
                })}
              </div>
            ) : (
              <TooltipWrapper label={item.label} collapsed={collapsed}>
                <NavLink
                  to={item.path}
                  end={item.path === "/manager"}
                  className={({ isActive }) =>
                    `flex w-full cursor-pointer items-center rounded-md px-3 py-2 transition-colors ${
                      isActive
                        ? "bg-red-500 text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`
                  }
                >
                  <span className="mr-2 flex h-5 w-5 items-center justify-center">
                    {item.icon}
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </TooltipWrapper>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function TooltipWrapper({ children, label, collapsed }) {
  return (
    <div className="group relative">
      {children}
      {collapsed && (
        <span className="absolute left-full top-1/2 z-10 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition delay-100 group-hover:translate-x-1 group-hover:opacity-100">
          {label}
        </span>
      )}
    </div>
  );
}
