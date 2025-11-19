import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { FiBox, FiFileText } from "react-icons/fi";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(
    () => JSON.parse(localStorage.getItem("sidebarCollapsed")) || false
  );

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(collapsed));
  }, [collapsed]);

  const sections = [
    {
      title: "Bahan Baku",
      items: [
        {
          label: "Bahan Baku",
          path: "/warehouse/raw-materials",
          icon: <FiBox />,
        },
        {
          label: "History Invoice",
          path: "/warehouse/raw-invoices-history",
          icon: <FiFileText />,
        },
      ],
    },
    {
      title: "Kemasan",
      items: [
        {
          label: "Kemasan",
          path: "/warehouse/packaging",
          icon: <FiBox />,
        },
        {
          label: "History Invoice",
          path: "/warehouse/packaging-invoices-history",
          icon: <FiFileText />,
        },
      ],
    },
    {
      title: "Produksi",
      items: [
        {
          label: "Produksi",
          path: "/warehouse/production-results",
          icon: <FiBox />,
        },
        {
          label: "Hasil Produksi",
          path: "/warehouse/productions",
          icon: <FiFileText />,
        },
        {
          label: "History Invoice",
          path: "/warehouse/production-invoices-history",
          icon: <FiFileText />,
        },
      ],
    },
    {
      title: "Produk",
      items: [
        {
          label: "Produk",
          path: "/warehouse/products",
          icon: <FiBox />,
        },
        {
          label: "History Invoice",
          path: "/warehouse/invoices-history",
          icon: <FiFileText />,
        },
      ],
    },
    {
      title: "SpeedShop",
      items: [
        {
          label: "SpeedShop",
          path: "/warehouse/speedshop",
          icon: <FiBox />,
        },
        {
          label: "Produk",
          path: "/warehouse/speedshop-products",
          icon: <FiBox />,
        },
        {
          label: "History Invoice",
          path: "/warehouse/speedshop-invoices-history",
          icon: <FiFileText />,
        },
      ],
    },
  ];

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
            alt="Warehouse Modifikasi Ori"
            className="h-8"
          />
        ) : (
          <img
            src="/logo-mini.webp"
            alt="Warehouse Modifikasi Ori Mini"
            className="h-8"
          />
        )}
      </div>

      <nav className="flex-1 space-y-2 p-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-3">
            {!collapsed && (
              <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {section.title}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <TooltipWrapper
                  key={item.label}
                  label={item.label}
                  collapsed={collapsed}
                >
                  <NavLink
                    to={item.path}
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
              ))}
            </div>
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
