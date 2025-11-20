import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  FiZap,
  FiPlus,
  FiSearch,
  FiArrowRight,
  FiCheckCircle,
  FiRefreshCcw,
  FiChevronDown,
  FiChevronUp,
  FiX,
  FiEdit2,
  FiCreditCard,
  FiLayers,
  FiClock,
} from "react-icons/fi";
import { toast } from "sonner";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { WarehousePageShell } from "../../../components/templates/WarehousePageShell";
import EmptyState from "../../../components/common/EmptyState";
import Pagination from "../../../components/common/Pagination";
import ComboBoxWithCreate from "../components/ComboBoxWithCreate";
import {
  SPEEDSHOP_LOCATIONS,
  PRODUCT_LOCATIONS,
} from "../../../constants/warehouseLocations";
import { WAREHOUSE_STORAGE_KEYS } from "../../../constants/warehouseStorageKeys";
import {
  fetchSpeedshopOrders,
  createSpeedshopOrder,
  updateSpeedshopOrder,
  updateSpeedshopOrderStatus,
  fetchSpeedshopServices,
} from "../api/speedshop";
import { fetchProductsPaged, formatRupiah } from "../api/mockData";

const SPEEDSHOP_LOCATION_STORAGE_KEY =
  WAREHOUSE_STORAGE_KEYS.speedshopLocation || "warehouseCode_speedshop";

const ORDER_TYPES = [
  { value: "parts-only", label: "Hanya Beli Parts" },
  { value: "service", label: "Servis & Penggantian Parts" },
];

const STATUS_META = {
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
  },
  pending_payment: {
    label: "Menunggu Pembayaran",
    className: "bg-amber-100 text-amber-800 border border-amber-200",
  },
  completed: {
    label: "Selesai",
    className: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  },
};

const STATUS_FILTERS = [
  {
    value: "all",
    label: "Semua Order",
    description: "Tampilkan seluruh status",
    icon: FiLayers,
  },
  {
    value: "draft",
    label: "Draft",
    description: "Belum lengkap, lanjutkan isian",
    icon: FiEdit2,
  },
  {
    value: "pending_payment",
    label: "Menunggu Pembayaran",
    description: "Butuh konfirmasi pembayaran",
    icon: FiClock,
  },
  {
    value: "completed",
    label: "Selesai",
    description: "Order telah tuntas",
    icon: FiCheckCircle,
  },
];

const PAYMENT_OPTIONS = ["Cash", "Transfer"];

const fallbackSpeedshopLocation =
  SPEEDSHOP_LOCATIONS[0] || PRODUCT_LOCATIONS[0] || "";

function resolveInitialSpeedshopLocation() {
  if (typeof window === "undefined") {
    return fallbackSpeedshopLocation;
  }
  const saved = window.localStorage.getItem(SPEEDSHOP_LOCATION_STORAGE_KEY);
  if (saved && SPEEDSHOP_LOCATIONS.includes(saved)) {
    return saved;
  }
  return fallbackSpeedshopLocation;
}

function buildDefaultForm(locationOverride) {
  return {
    orderType: "parts-only",
    orderDate: new Date().toISOString().slice(0, 10),
    location: locationOverride || fallbackSpeedshopLocation,
    invoiceNumber: "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerNote: "",
    vehiclePlate: "",
    vehicleType: "",
    vehicleKm: "",
    vehicleYear: "",
    mechanicName: "",
    paymentMethod: "",
  };
}

export default function SpeedshopPage() {
  const initialLocationValue = resolveInitialSpeedshopLocation();
  const [formState, setFormState] = useState(() =>
    buildDefaultForm(initialLocationValue),
  );
  const [parts, setParts] = useState([]);
  const [services, setServices] = useState([]);
  const [serviceCatalog, setServiceCatalog] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState(initialLocationValue);
  const [page, setPage] = useState(1);
  const limit = 8;
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [reloadingOrders, setReloadingOrders] = useState(false);
  const [resumeStep, setResumeStep] = useState(1);

  const totals = useMemo(() => {
    const partsTotal = parts.reduce(
      (sum, part) => sum + Number(part.quantity || 0) * Number(part.unitPrice || 0),
      0,
    );
    const servicesTotal = services.reduce(
      (sum, service) => sum + Number(service.cost || 0),
      0,
    );
    return {
      parts: partsTotal,
      services: servicesTotal,
      grand: partsTotal + servicesTotal,
    };
  }, [parts, services]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!locationFilter) return;
    window.localStorage.setItem(
      SPEEDSHOP_LOCATION_STORAGE_KEY,
      locationFilter,
    );
    window.dispatchEvent(
      new CustomEvent("warehouse:location-storage-change", {
        detail: {
          storageKey: SPEEDSHOP_LOCATION_STORAGE_KEY,
          value: locationFilter,
        },
      }),
    );
  }, [locationFilter]);

  useEffect(() => {
    const handleExternalLocation = (value) => {
      if (typeof value !== "string") return;
      if (!SPEEDSHOP_LOCATIONS.includes(value)) return;
      setLocationFilter((prev) => (prev === value ? prev : value));
    };

    const storageListener = (event) => {
      if (event.key === SPEEDSHOP_LOCATION_STORAGE_KEY) {
        handleExternalLocation(event.newValue);
      }
    };

    const broadcastListener = (event) => {
      const detail = event?.detail || {};
      if (detail.storageKey === SPEEDSHOP_LOCATION_STORAGE_KEY) {
        handleExternalLocation(detail.value);
      }
    };

    window.addEventListener("storage", storageListener);
    window.addEventListener(
      "warehouse:location-storage-change",
      broadcastListener,
    );
    return () => {
      window.removeEventListener("storage", storageListener);
      window.removeEventListener(
        "warehouse:location-storage-change",
        broadcastListener,
      );
    };
  }, []);

  useEffect(() => {
    if (!SPEEDSHOP_LOCATIONS.includes(locationFilter)) {
      setLocationFilter(fallbackSpeedshopLocation);
    }
  }, [locationFilter]);

  useEffect(() => {
    if (!locationFilter) return;
    if (editingOrder) return;
    setFormState((prev) => {
      if (prev.location === locationFilter) return prev;
      return { ...prev, location: locationFilter };
    });
    if (parts.length) {
      toast.info("Daftar parts dikosongkan karena lokasi diganti");
      setParts([]);
    }
  }, [locationFilter, editingOrder, parts.length]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, locationFilter]);

  useEffect(() => {
    let active = true;
    async function loadOrders() {
      setOrdersLoading(true);
      try {
        const data = await fetchSpeedshopOrders({
          page,
          limit,
          search: debouncedSearch || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          location: locationFilter,
        });
        if (!active) return;
        setOrders(Array.isArray(data?.items) ? data.items : []);
        setTotalItems(Number(data?.total || 0));
        setTotalPages(Number(data?.pages || 1));
      } catch (err) {
        if (!active) return;
        console.error("Gagal memuat speedshop:", err.message);
        toast.error(err.message || "Gagal memuat data Speedshop");
      } finally {
        if (active) setOrdersLoading(false);
      }
    }
    loadOrders();
    return () => {
      active = false;
    };
  }, [page, limit, debouncedSearch, statusFilter, locationFilter]);

  useEffect(() => {
    let active = true;
    async function loadServices() {
      try {
        const items = await fetchSpeedshopServices();
        if (!active) return;
        setServiceCatalog(Array.isArray(items) ? items : []);
      } catch (err) {
        console.error("Gagal memuat katalog jasa:", err.message);
      }
    }
    loadServices();
    return () => {
      active = false;
    };
  }, []);

  const currentStatus = editingOrder?.status || "draft";

  const determineResumeStep = (order) => {
    if (!order) return 1;
    if (!order.customerName?.trim()) return 2;
    const hasParts = Array.isArray(order.parts) && order.parts.length > 0;
    if (!hasParts) return 3;
    if (order.orderType === "service") {
      return 4;
    }
    return 3;
  };

  const handleFormChange = (field, value) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (field === "location" && parts.length) {
      toast.info("Daftar parts dikosongkan karena lokasi diganti");
      setParts([]);
    }

    // Kalau ganti ke "Hanya Beli Parts", kosongkan jasa servis
    if (field === "orderType" && value === "parts-only" && services.length) {
      setServices([]);
    }
  };

  const handleAddPart = (product, availableStock) => {
    if (!product?._id) return;
    if (parts.some((part) => part.productId === product._id)) {
      toast.info("Produk sudah ada di daftar parts");
      return;
    }
    if (availableStock <= 0) {
      toast.warning("Stok produk ini habis di lokasi yang dipilih");
      return;
    }
    setParts((prev) => [
      ...prev,
      {
        tempId: `${product._id}-${Date.now()}`,
        productId: product._id,
        productCode: product.code,
        productName: product.name,
        available: availableStock,
        quantity: 1,
        unitPrice: Number(product.sellingPrice || product.purchasePrice || 0),
      },
    ]);
  };

  const handleUpdatePartQuantity = (tempId, qty) => {
    setParts((prev) =>
      prev.map((part) => {
        if (part.tempId !== tempId) return part;
        const maxQty = Number(part.available || 0);
        const nextQty = Math.min(
          maxQty || Number.MAX_SAFE_INTEGER,
          Math.max(1, Number(qty) || 1),
        );
        return { ...part, quantity: nextQty };
      }),
    );
  };

  const handleRemovePart = (tempId) => {
    setParts((prev) => prev.filter((part) => part.tempId !== tempId));
  };

  const handleAddService = (service) => {
    if (!service?.name?.trim()) return;
    const normalized = service.name.trim();
    if (services.some((item) => item.name.toLowerCase() === normalized.toLowerCase())) {
      toast.info("Jasa servis sudah ada di daftar");
      return;
    }
    setServices((prev) => [
      ...prev,
      {
        tempId: `${normalized}-${Date.now()}`,
        name: normalized,
        cost: Number(service.cost || 0),
      },
    ]);
  };

  const handleRemoveService = (tempId) => {
    setServices((prev) => prev.filter((service) => service.tempId !== tempId));
  };

  const resetForm = () => {
    setFormState(buildDefaultForm(locationFilter));
    setParts([]);
    setServices([]);
    setEditingOrder(null);
  };

  const hydrateFormFromOrder = (order) => {
    if (!order) return;
    setEditingOrder(order);
    setFormState({
      orderType: order.orderType || "parts-only",
      orderDate: order.orderDate
        ? new Date(order.orderDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      location: order.location || fallbackSpeedshopLocation,
      invoiceNumber: order.invoiceNumber || "",
      customerName: order.customerName || "",
      customerPhone: order.customerPhone || "",
      customerAddress: order.customerAddress || "",
      customerNote: order.customerNote || "",
      vehiclePlate: order.vehiclePlate || "",
      vehicleType: order.vehicleType || "",
      vehicleKm:
        order.vehicleKm !== undefined && order.vehicleKm !== null
          ? String(order.vehicleKm)
          : "",
      vehicleYear:
        order.vehicleYear !== undefined && order.vehicleYear !== null
          ? String(order.vehicleYear)
          : "",
      mechanicName: order.mechanicName || "",
      paymentMethod: order.paymentMethod || "",
    });
    setParts(
      (order.parts || []).map((part) => ({
        tempId: `${part.product || part.productCode}-${Date.now()}-${Math.random()}`,
        productId: part.product,
        productCode: part.productCode,
        productName: part.productName,
        available: part.maxQuantity || part.quantity,
        quantity: part.quantity,
        unitPrice: part.unitPrice,
      })),
    );
    setServices(
      (order.services || []).map((service) => ({
        tempId: `${service.name}-${Date.now()}-${Math.random()}`,
        name: service.name,
        cost: service.cost,
      })),
    );
  };

  const validateForm = (targetStatus) => {
    if (!formState.customerName.trim()) {
      toast.error("Nama customer wajib diisi");
      return false;
    }
    if (!formState.location) {
      toast.error("Lokasi Speedshop wajib dipilih");
      return false;
    }

    // Untuk draft: boleh belum ada parts/jasa
    if (targetStatus !== "draft") {
      if (!parts.length && !services.length) {
        toast.error("Minimal tambahkan satu parts atau jasa servis");
        return false;
      }
    }

    if (formState.orderType === "service" && targetStatus !== "draft") {
      const requiredFields = [
        ["invoiceNumber", "No. Invoice wajib diisi untuk servis"],
        ["vehiclePlate", "No. Polisi wajib diisi untuk servis"],
        ["vehicleType", "Jenis kendaraan wajib diisi untuk servis"],
        ["vehicleKm", "KM kendaraan wajib diisi untuk servis"],
        ["vehicleYear", "Tahun kendaraan wajib diisi untuk servis"],
        ["mechanicName", "Nama mekanik wajib diisi untuk servis"],
        ["paymentMethod", "Metode pembayaran wajib diisi untuk servis"],
      ];
      for (const [field, message] of requiredFields) {
        if (!String(formState[field] || "").trim()) {
          toast.error(message);
          return false;
        }
      }
    }
    if (
      parts.some(
        (part) => part.quantity <= 0 || (part.available && part.quantity > part.available),
      )
    ) {
      toast.error("Periksa kembali jumlah parts yang dimasukkan");
      return false;
    }
    if (targetStatus === "completed" && currentStatus === "draft") {
      toast.error("Order perlu menunggu pembayaran sebelum ditandai selesai");
      return false;
    }
    return true;
  };

  const serializePayload = (targetStatus) => ({
    orderType: formState.orderType,
    orderDate: formState.orderDate,
    location: formState.location,
    invoiceNumber: formState.invoiceNumber?.trim() || undefined,
    customerName: formState.customerName?.trim(),
    customerPhone: formState.customerPhone?.trim() || undefined,
    customerAddress: formState.customerAddress?.trim() || undefined,
    customerNote: formState.customerNote?.trim() || undefined,
    vehiclePlate: formState.vehiclePlate?.trim() || undefined,
    vehicleType: formState.vehicleType?.trim() || undefined,
    vehicleKm: formState.vehicleKm ? Number(formState.vehicleKm) : undefined,
    vehicleYear: formState.vehicleYear ? Number(formState.vehicleYear) : undefined,
    mechanicName: formState.mechanicName?.trim() || undefined,
    paymentMethod: formState.paymentMethod?.trim() || undefined,
    parts: parts.map((part) => ({
      productId: part.productId,
      productCode: part.productCode,
      productName: part.productName,
      quantity: Number(part.quantity),
      unitPrice: Number(part.unitPrice),
    })),
    services: services.map((service) => ({
      name: service.name,
      cost: Number(service.cost),
    })),
    status: targetStatus,
  });

  const handleSubmit = async (targetStatus) => {
    if (saving) return false;
    if (!validateForm(targetStatus)) return false;
    const payload = serializePayload(targetStatus);
    setSaving(true);
    try {
      if (editingOrder?._id) {
        await updateSpeedshopOrder(editingOrder._id, payload);
      } else {
        await createSpeedshopOrder(payload);
      }
      if (targetStatus === "draft") {
        toast.warning("Draft Speedshop disimpan");
      } else if (editingOrder?._id) {
        toast.success("Order Speedshop diperbarui");
      } else {
        toast.success("Order Speedshop dibuat");
      }
      if (targetStatus === "draft") {
        setStatusFilter("draft");
        setPage(1);
        setIsFormModalOpen(false);
      }
      resetForm();
      setReloadingOrders(true);
      await reloadOrdersDebounced(
        targetStatus === "draft" ? { status: "draft", page: 1 } : undefined,
      );
      return true;
    } catch (err) {
      console.error("Gagal menyimpan order:", err.message);
      toast.error(err.message || "Gagal menyimpan order");
      return false;
    } finally {
      setSaving(false);
      setReloadingOrders(false);
    }
  };

  const reloadOrdersDebounced = async (overrides = {}) => {
    try {
      const effectivePage =
        overrides.page !== undefined ? overrides.page : page;
      const effectiveStatus =
        overrides.status !== undefined ? overrides.status : statusFilter;
      const effectiveLocation =
        overrides.location !== undefined ? overrides.location : locationFilter;
      const effectiveSearch =
        overrides.search !== undefined ? overrides.search : debouncedSearch;

      const data = await fetchSpeedshopOrders({
        page: effectivePage,
        limit,
        search: (effectiveSearch || undefined) ?? undefined,
        status: effectiveStatus === "all" ? undefined : effectiveStatus,
        location: effectiveLocation,
      });
      setOrders(Array.isArray(data?.items) ? data.items : []);
      setTotalItems(Number(data?.total || 0));
      setTotalPages(Number(data?.pages || 0) || 1);
    } catch (err) {
      console.error("Reload orders error:", err.message);
    }
  };

  const handleStatusAction = async (order, nextStatus) => {
    if (!order?._id) return;
    try {
      await updateSpeedshopOrderStatus(order._id, { status: nextStatus });
      toast.success("Status order diperbarui");
      setReloadingOrders(true);
      await reloadOrdersDebounced();
      if (editingOrder?._id === order._id) {
        setEditingOrder({ ...order, status: nextStatus });
      }
    } catch (err) {
      toast.error(err.message || "Gagal mengubah status");
    } finally {
      setReloadingOrders(false);
    }
  };

  const handleResumeDraft = (order) => {
    hydrateFormFromOrder(order);
    setResumeStep(determineResumeStep(order));
    setIsFormModalOpen(true);
  };

  const handleExpandRow = (orderId) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  const handleOpenNewOrder = () => {
    setEditingOrder(null);
    setParts([]);
    setServices([]);
    setFormState(buildDefaultForm(locationFilter));
    setResumeStep(1);
    setIsFormModalOpen(true);
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter((prev) => (prev === value ? "all" : value));
  };

  const headerRight = (
    <button
      type="button"
      onClick={handleOpenNewOrder}
      className="inline-flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-600 transition"
    >
      <FiPlus /> Order Speedshop
    </button>
  );

  const headerBelow = (
    <div className="flex flex-col gap-3 text-sm text-gray-600">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
        <span className="font-medium">Lokasi:</span>
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="rounded-lg border px-3 py-1 text-xs outline-none focus:ring-2 focus:ring-red-500/60"
        >
          {SPEEDSHOP_LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-semibold text-gray-700">Filter Status</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {STATUS_FILTERS.map((filter) => {
            const isActive = statusFilter === filter.value;
            const Icon = filter.icon;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => handleStatusFilterChange(filter.value)}
                className={`group flex items-start gap-3 rounded-2xl border p-3 text-left transition-all ${
                  isActive
                    ? "border-red-500 bg-red-50 shadow-lg shadow-red-100 ring-1 ring-red-200"
                    : "border-gray-200 bg-white hover:border-red-200 hover:bg-red-50/60"
                }`}
                aria-pressed={isActive}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                    isActive ? "bg-red-500 text-white" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <Icon />
                </span>
                <span className="flex flex-col">
                  <span
                    className={`text-sm font-semibold ${
                      isActive ? "text-red-600" : "text-gray-700"
                    }`}
                  >
                    {filter.label}
                  </span>
                  <span className="text-xs text-gray-500">{filter.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-full border pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
            placeholder="Cari Order ID, Customer, Polisi..."
          />
        </div>
        <button
          type="button"
          onClick={reloadOrdersDebounced}
          className="inline-flex items-center justify-center gap-1 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:text-red-500 hover:border-red-200 transition"
        >
          <FiRefreshCcw className={reloadingOrders ? "animate-spin" : ""} />
          Muat Ulang
        </button>
      </div>
    </div>
  );

  return (
    <>
      <WarehousePageShell
        title="SpeedShop"
        icon={FiZap}
        headerBelow={headerBelow}
        headerRight={headerRight}
      >
        <OrderListSection
          orders={orders}
          loading={ordersLoading}
          expandedOrderId={expandedOrderId}
          onExpand={handleExpandRow}
          totalItems={totalItems}
          page={page}
          limit={limit}
          totalPages={totalPages}
          onPageChange={setPage}
          onResumeDraft={handleResumeDraft}
          onStatusAction={handleStatusAction}
        />
      </WarehousePageShell>
      <OrderFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        formState={formState}
        onFormChange={handleFormChange}
        parts={parts}
        services={services}
        onAddPart={handleAddPart}
        onUpdatePartQuantity={handleUpdatePartQuantity}
        onRemovePart={handleRemovePart}
        onAddService={handleAddService}
        onRemoveService={handleRemoveService}
        serviceCatalog={serviceCatalog}
        setServiceCatalog={setServiceCatalog}
        totals={totals}
        onSubmit={handleSubmit}
        editingOrder={editingOrder}
        currentStatus={currentStatus}
        saving={saving}
        locationFilter={locationFilter}
        initialStep={resumeStep}
      />
    </>
  );
}

function OrderFormModal({
  isOpen,
  onClose,
  formState,
  onFormChange,
  parts,
  services,
  onAddPart,
  onUpdatePartQuantity,
  onRemovePart,
  onAddService,
  onRemoveService,
  serviceCatalog,
  setServiceCatalog,
  totals,
  onSubmit,
  editingOrder,
  currentStatus,
  saving,
  locationFilter,
  initialStep = 1,
}) {
  const [selectedService, setSelectedService] = useState(null);
  const [serviceCost, setServiceCost] = useState("");
  const [isOrderIdModalOpen, setIsOrderIdModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const customerNameRef = useRef(null);

  const statusMeta = STATUS_META[currentStatus] || STATUS_META.draft;

  const steps = useMemo(() => {
    const base = [
      { id: 1, label: "Jenis Order" },
      { id: 2, label: "Detail Order" },
      { id: 3, label: "Parts" },
    ];
    if (formState.orderType === "service") {
      base.push({ id: 4, label: "Jasa & Catatan" });
    }
    return base;
  }, [formState.orderType]);

  const maxStep = steps.length;

  useEffect(() => {
    if (isOpen) {
      const normalizedStep = Number(initialStep) || 1;
      setStep(normalizedStep < 1 ? 1 : normalizedStep);
    }
  }, [isOpen, editingOrder?._id, initialStep]);

  useEffect(() => {
    setStep((prev) => (prev > maxStep ? maxStep : prev));
  }, [maxStep]);

  // Auto focus Nama Customer ketika masuk step 2
  useEffect(() => {
    if (step === 2 && customerNameRef.current) {
      customerNameRef.current.focus();
    }
  }, [step]);

  const handleAddServiceClick = () => {
    if (!selectedService?.name && !selectedService?._id) {
      toast.error("Isi nama jasa terlebih dahulu");
      return;
    }
    if (!serviceCost || Number(serviceCost) < 0) {
      toast.error("Isi biaya jasa dengan benar");
      return;
    }

    const name = selectedService.name || selectedService._id;
    const costNum = Number(serviceCost) || 0;

    // Update / tambahkan ke katalog master jasa (nama + biaya)
    setServiceCatalog((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          (item._id && selectedService._id && item._id === selectedService._id) ||
          (item.name &&
            item.name.toLowerCase() === String(name).toLowerCase()),
      );
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = { ...copy[existingIndex], cost: costNum };
        return copy;
      }
      return [
        ...prev,
        {
          ...(selectedService._id ? { _id: selectedService._id } : {}),
          name,
          cost: costNum,
        },
      ];
    });

    // Tambahkan ke daftar jasa order saat ini
    onAddService({ name, cost: costNum });

    setServiceCost("");
    setSelectedService(null);
  };

  const handleSelectService = (value) => {
    setSelectedService(value);
    if (value?.cost != null) {
      setServiceCost(String(value.cost));
    } else {
      setServiceCost("");
    }
  };

  const handleCloseModal = () => {
    setIsOrderIdModalOpen(false);
    onClose?.();
  };

  const goNext = () => {
    if (step < maxStep) setStep((prev) => prev + 1);
  };

  const goPrev = () => {
    if (step > 1) setStep((prev) => prev - 1);
  };

  if (!isOpen) {
    return null;
  }

  const orderDateDisplay = formState.orderDate
    ? new Date(formState.orderDate).toLocaleDateString("id-ID")
    : new Date().toLocaleDateString("id-ID");

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-8 overflow-y-auto">
        <section className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-5 md:p-8 space-y-5">
          {/* HEADER */}
          <header className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase text-gray-500 tracking-wide">
                  Order ID
                </p>
                <button
                  type="button"
                  onClick={() => setIsOrderIdModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-sm font-medium text-gray-700 hover:border-red-200 hover:text-red-600 transition"
                >
                  {editingOrder?.orderId ? editingOrder.orderId : "Lihat informasi"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${statusMeta.className}`}
                >
                  {statusMeta.label}
                </span>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-full border border-gray-200 p-2 text-gray-500 hover:text-red-500 hover:border-red-200 transition"
                  aria-label="Tutup form"
                >
                  <FiX />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Isi form per step: pilih jenis order, isi detail, tambahkan parts dan jasa (kalau
              ada), lalu ajukan pembayaran.
            </p>
          </header>

          {/* STEP INDICATOR (indikator saja, tidak bisa klik lompat) */}
          <div className="flex items-center gap-3 text-xs">
            {steps.map((s, idx) => {
              const isActive = step === s.id;
              const isDone = step > s.id;
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-2 rounded-full px-3 py-1 border transition ${
                      isActive
                        ? "border-red-500 bg-red-50 text-red-600"
                        : isDone
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-gray-50 text-gray-500"
                    }`}
                  >
                    <span className="h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-bold border border-current">
                      {s.id}
                    </span>
                    <span className="font-semibold">{s.label}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <span className="h-px w-6 bg-gray-200 hidden sm:block" />
                  )}
                </div>
              );
            })}
          </div>

          {/* STEP CONTENT */}
          <div className="space-y-5">
            {/* STEP 1 - JENIS ORDER */}
            {step === 1 && (
              <div className="grid grid-cols-1 gap-3">
                <label className="text-xs font-semibold uppercase text-gray-500 tracking-wide">
                  Step 1 - Jenis Order
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ORDER_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => onFormChange("orderType", type.value)}
                      className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition flex items-center justify-between ${
                        formState.orderType === type.value
                          ? "border-red-500 bg-red-50 text-red-600"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {type.label}
                      {formState.orderType === type.value ? (
                        <FiCheckCircle />
                      ) : (
                        <FiArrowRight />
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-2 rounded-2xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  <p>
                    Lokasi order mengikuti pilihan di halaman utama:{" "}
                    <span className="font-semibold text-gray-700">
                      {locationFilter || formState.location}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* STEP 2 - DETAIL ORDER */}
            {step === 2 && (
              <div className="grid grid-cols-1 gap-4">
                <label className="text-xs font-semibold uppercase text-gray-500 tracking-wide">
                  Step 2 - Detail Order
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {/* Lokasi & Tanggal (read-only) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Lokasi Speedshop</p>
                      <div className="w-full rounded-xl border px-3 py-2 text-sm bg-gray-50 text-gray-700">
                        {locationFilter || formState.location}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Tanggal Order</p>
                      <div className="w-full rounded-xl border px-3 py-2 text-sm bg-gray-50 text-gray-700">
                        {orderDateDisplay}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">Nama Customer</p>
                    <input
                      ref={customerNameRef}
                      value={formState.customerName}
                      onChange={(e) => onFormChange("customerName", e.target.value)}
                      className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
                      placeholder="Masukkan nama customer"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">No. HP</p>
                      <input
                        value={formState.customerPhone}
                        onChange={(e) => onFormChange("customerPhone", e.target.value)}
                        className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
                        placeholder="08xxxx"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">No. Invoice</p>
                      <input
                        value={formState.invoiceNumber}
                        onChange={(e) => onFormChange("invoiceNumber", e.target.value)}
                        disabled={formState.orderType !== "service"}
                        className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:bg-gray-100"
                        placeholder="Wajib untuk servis"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Alamat</p>
                    <textarea
                      value={formState.customerAddress}
                      onChange={(e) => onFormChange("customerAddress", e.target.value)}
                      rows={2}
                      className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
                      placeholder="Alamat pengantaran / customer"
                    />
                  </div>

                  {/* Detail kendaraan hanya aktif kalau service */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">No. Polisi</p>
                      <input
                        value={formState.vehiclePlate}
                        onChange={(e) =>
                          onFormChange("vehiclePlate", e.target.value.toUpperCase())
                        }
                        disabled={formState.orderType !== "service"}
                        className="w-full rounded-xl border px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:bg-gray-100"
                        placeholder="B 1234 XX"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Jenis Kendaraan</p>
                      <input
                        value={formState.vehicleType}
                        onChange={(e) => onFormChange("vehicleType", e.target.value)}
                        disabled={formState.orderType !== "service"}
                        className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:bg-gray-100"
                        placeholder="Contoh: NMAX"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">KM Kendaraan</p>
                      <input
                        type="number"
                        value={formState.vehicleKm}
                        onChange={(e) => onFormChange("vehicleKm", e.target.value)}
                        disabled={formState.orderType !== "service"}
                        className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Tahun Kendaraan</p>
                      <input
                        type="number"
                        value={formState.vehicleYear}
                        onChange={(e) => onFormChange("vehicleYear", e.target.value)}
                        disabled={formState.orderType !== "service"}
                        className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Nama Mekanik</p>
                      <input
                        value={formState.mechanicName}
                        onChange={(e) => onFormChange("mechanicName", e.target.value)}
                        disabled={formState.orderType !== "service"}
                        className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Metode Pembayaran</p>
                    <select
                      value={formState.paymentMethod}
                      onChange={(e) => onFormChange("paymentMethod", e.target.value)}
                      className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 bg-white"
                    >
                      <option value="">Pilih metode...</option>
                      {PAYMENT_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 - PARTS */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Step 3 - Daftar Parts
                  </h3>
                  <span className="text-xs text-gray-500">
                    Stok mengikuti lokasi {locationFilter || formState.location}
                  </span>
                </div>
                <PartsPicker
                  location={locationFilter || formState.location}
                  onAddPart={onAddPart}
                  existingPartIds={parts.map((part) => part.productId)}
                />
                <PartsTable
                  parts={parts}
                  onQuantityChange={onUpdatePartQuantity}
                  onRemovePart={onRemovePart}
                />
                {formState.orderType === "parts-only" && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Catatan</p>
                    <textarea
                      value={formState.customerNote}
                      onChange={(e) => onFormChange("customerNote", e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
                      placeholder="Catatan tambahan"
                    />
                  </div>
                )}
              </div>
            )}

            {/* STEP 4 - JASA & CATATAN (HANYA UNTUK SERVICE) */}
            {step === 4 && formState.orderType === "service" && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Step 4 - Tambah Jasa Servis
                  </h3>
                  <div className="space-y-3">
                    <ComboBoxWithCreate
                      label="Nama Jasa Servis"
                      items={serviceCatalog}
                      value={selectedService}
                      onChange={handleSelectService}
                      onAddNew={(item) => setServiceCatalog((prev) => [...prev, item])}
                      placeholder="Cari atau ketik nama jasa servis..."
                    />
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Biaya Jasa (Rp)</p>
                      <input
                        type="number"
                        value={serviceCost}
                        onChange={(e) => setServiceCost(e.target.value)}
                        className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
                        placeholder="Contoh: 50000"
                      />
                      {selectedService?.cost != null && (
                        <p className="mt-1 text-[11px] text-gray-500">
                          Biaya terisi otomatis dari master jasa:{" "}
                          <span className="font-semibold">
                            {formatRupiah(selectedService.cost)}
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddServiceClick}
                        className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-100"
                      >
                        <FiPlus /> Tambah Jasa ke Daftar
                      </button>
                    </div>
                  </div>
                  <ServicesTable
                    services={services}
                    onRemoveService={onRemoveService}
                  />
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1">Catatan</p>
                  <textarea
                    value={formState.customerNote}
                    onChange={(e) => onFormChange("customerNote", e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    placeholder="Catatan tambahan"
                  />
                </div>
              </div>
            )}

            {/* RINGKASAN TOTAL */}
            <div className="rounded-2xl bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Total Parts</span>
                <span className="font-semibold">{formatRupiah(totals.parts)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Total Jasa</span>
                <span className="font-semibold">{formatRupiah(totals.services)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-gray-800">
                <span>Grand Total</span>
                <span>{formatRupiah(totals.grand)}</span>
              </div>
            </div>
          </div>

          {/* NAVIGASI STEP + ACTION BUTTONS */}
          <div className="flex flex-wrap gap-3 justify_between items-center">
            <div className="flex gap-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={goPrev}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Kembali
                </button>
              )}
              {step < maxStep && (
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
                >
                  Lanjut
                </button>
              )}
            </div>

            <div className="flex gap-2 items-center">
              {/* Simpan draft tersedia di step >= 2 */}
              {step >= 2 && (
                <button
                  type="button"
                  onClick={async () => {
                    await onSubmit("draft");
                  }}
                  disabled={saving}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Simpan Draft
                </button>
              )}

              {/* Tombol status final hanya di step terakhir */}
              {step === maxStep && (
                <>
                  {editingOrder?._id && currentStatus === "pending_payment" && (
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await onSubmit("completed");
                        if (ok) onClose();
                      }}
                      className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      Tandai Selesai
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await onSubmit("pending_payment");
                      if (ok) onClose(); // tutup modal setelah ajukan pembayaran berhasil
                    }}
                    disabled={saving}
                    className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    Ajukan Pembayaran
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* MODAL INFO ORDER ID */}
      {isOrderIdModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-700">Informasi Order ID</p>
                <p className="text-xs text-gray-500">
                  Order ID akan ditentukan secara otomatis untuk menjaga konsistensi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOrderIdModalOpen(false)}
                className="text-gray-500 hover:text-red-500"
              >
                <FiX />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              {editingOrder?.orderId ? (
                <>
                  <p>
                    Order ini telah memiliki ID:
                    <span className="ml-2 font-mono text-base text-gray-900">
                      {editingOrder.orderId}
                    </span>
                  </p>
                  <p>
                    Order ID tidak bisa diubah dan akan tetap sama setelah status diperbarui.
                  </p>
                </>
              ) : (
                <p>
                  Order ID akan dihasilkan otomatis saat Anda menyimpan draft atau mengajukan
                  pembayaran pertama kali.
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOrderIdModalOpen(false)}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function OrderListSection({
  orders,
  loading,
  expandedOrderId,
  onExpand,
  totalItems,
  page,
  limit,
  totalPages,
  onPageChange,
  onResumeDraft,
  onStatusAction,
}) {
  if (loading) {
    return (
      <section className="bg-white rounded-2xl shadow p-6">
        <p className="text-sm text-gray-500">Memuat data Speedshop...</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl shadow p-0 overflow-hidden">
      <div className="px-6 py-4 border-b">
        <h3 className="text-lg font-semibold text-gray-800">List Order Speedshop</h3>
        <p className="text-sm text-gray-500">
          Klik baris untuk melihat detail order dan aksi lanjutan.
        </p>
      </div>
      {orders.length === 0 ? (
        <EmptyState
          title="Belum ada order"
          message="Buat order baru dari panel sebelah kiri untuk mulai mengisi data Speedshop."
        />
      ) : (
        <div className="divide-y">
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order._id;
            const meta = STATUS_META[order.status] || STATUS_META.draft;
            return (
              <Fragment key={order._id}>
                <button
                  type="button"
                  onClick={() => onExpand(order._id)}
                  className={`w-full text-left px-6 py-4 flex items-center justify-between gap-4 transition ${
                    isExpanded ? "bg-red-50/60" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${
                          order.orderType === "service"
                            ? "border-red-400 text-red-500"
                            : "border-blue-400 text-blue-500"
                        }`}
                      >
                        {order.orderType === "service" ? "SV" : "PR"}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {order.customerName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {order.orderId} -{" "}
                          {new Date(order.orderDate).toLocaleDateString("id-ID")}
                        </p>
                      </div>
                    </div>
                    <div className="hidden lg:flex flex-col text-sm text-gray-600">
                      <span>Lokasi</span>
                      <span className="font-semibold">{order.location}</span>
                    </div>
                    <div className="hidden lg:flex flex-col text-sm text-gray-600">
                      <span>Total</span>
                      <span className="font-semibold">
                        {formatRupiah(order?.totals?.grand || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                    {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <Motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-6 pb-6"
                    >
                      <OrderDetail
                        order={order}
                        onResumeDraft={onResumeDraft}
                        onStatusAction={onStatusAction}
                      />
                    </Motion.div>
                  )}
                </AnimatePresence>
              </Fragment>
            );
          })}
        </div>
      )}
      <div className="border-t px-6 py-4">
        <Pagination
          totalItems={totalItems}
          page={page}
          limit={limit}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </div>
    </section>
  );
}

function OrderDetail({ order, onResumeDraft, onStatusAction }) {
  const parts = order.parts || [];
  const services = order.services || [];
  const meta = STATUS_META[order.status] || STATUS_META.draft;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4">
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <DetailItem label="Status" value={meta.label} badgeClass={meta.className} />
        <DetailItem label="Metode Pembayaran" value={order.paymentMethod || "-"} />
        <DetailItem label="Nama Mekanik" value={order.mechanicName || "-"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
        <DetailItem label="No. HP" value={order.customerPhone || "-"} />
        <DetailItem label="No. Invoice" value={order.invoiceNumber || "-"} />
        <DetailItem label="No. Polisi" value={order.vehiclePlate || "-"} />
        <DetailItem label="Jenis Kendaraan" value={order.vehicleType || "-"} />
        <DetailItem label="KM Kendaraan" value={order.vehicleKm || "-"} />
        <DetailItem label="Tahun Kendaraan" value={order.vehicleYear || "-"} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700">Alamat & Catatan</p>
        <p className="text-sm text-gray-600">{order.customerAddress || "-"}</p>
        {order.customerNote ? (
          <p className="text-sm text-gray-500">Catatan: {order.customerNote}</p>
        ) : null}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">Parts ({parts.length})</p>
        {parts.length === 0 ? (
          <p className="text-sm text-gray-500">Tidak ada parts</p>
        ) : (
          <div className="space-y-2">
            {parts.map((part) => (
              <div
                key={`${part.productCode}-${part.productName}`}
                className="rounded-xl border border-gray-100 px-3 py-2 flex items-center justify-between text-sm"
              >
                <div>
                  <p className="font-semibold text-gray-800">
                    {part.productName} ({part.productCode})
                  </p>
                  <p className="text-gray-500 text-xs">
                    Qty {part.quantity} x {formatRupiah(part.unitPrice)}
                  </p>
                </div>
                <p className="font-semibold text-gray-800">
                  {formatRupiah(part.unitPrice * part.quantity)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">
          Jasa Servis ({services.length})
        </p>
        {services.length === 0 ? (
          <p className="text-sm text-gray-500">Tidak ada jasa servis</p>
        ) : (
          <div className="space-y-2">
            {services.map((service) => (
              <div
                key={`${service.name}-${service.cost}`}
                className="rounded-xl border border-gray-100 px-3 py-2 flex items-center justify-between text-sm"
              >
                <p className="font-semibold text-gray-800">{service.name}</p>
                <p className="font-semibold text-gray-800">
                  {formatRupiah(service.cost)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {order.status === "draft" && (
          <button
            type="button"
            onClick={() => onResumeDraft(order)}
            className="inline-flex items-center gap-2 rounded-full border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
          >
            <FiEdit2 /> Lanjutkan Draft
          </button>
        )}
        {order.status === "pending_payment" && (
          <button
            type="button"
            onClick={() => onStatusAction(order, "completed")}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50"
          >
            <FiCreditCard /> Konfirmasi Pembayaran
          </button>
        )}
      </div>
    </div>
  );
}

function DetailItem({ label, value, badgeClass }) {
  if (badgeClass) {
    return (
      <div>
        <p className="text-xs text_gray-500">{label}</p>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}
        >
          {value}
        </span>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold text-gray-800">{value}</p>
    </div>
  );
}

function PartsPicker({ location, onAddPart, existingPartIds }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    let active = true;
    async function loadProducts() {
      if (!location) return;
      setLoading(true);
      try {
        const data = await fetchProductsPaged({
          page: 1,
          limit: 6,
          search: debouncedSearch || undefined,
          location,
        });
        if (!active) return;
        setResults(Array.isArray(data?.items) ? data.items : []);
      } catch (err) {
        if (!active) return;
        console.error("Gagal mencari produk:", err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadProducts();
    return () => {
      active = false;
    };
  }, [location, debouncedSearch]);

  return (
    <div className="rounded-2xl border border-dashed border-gray-200 p-4 space-y-3">
      <div className="relative">
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-full border px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
          placeholder="Cari produk berdasarkan nama atau kode"
        />
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Memuat produk...</p>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {results.length === 0 ? (
            <p className="text-sm text-gray-500">Produk tidak ditemukan</p>
          ) : (
            results.map((product) => {
              const available = getStockForLocation(product, location);
              const disabled = existingPartIds.includes(product._id);
              return (
                <div
                  key={product._id}
                  className="rounded-2xl border border-gray-100 px-3 py-2 flex items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-gray-800">
                      {product.name} ({product.code})
                    </p>
                    <p className="text-xs text-gray-500">
                      Stok {available} - Harga {formatRupiah(product.sellingPrice || 0)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddPart(product, available)}
                    disabled={available <= 0 || disabled}
                    className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiPlus /> {disabled ? "Ditambahkan" : "Tambah"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function PartsTable({ parts, onQuantityChange, onRemovePart }) {
  if (!parts.length) {
    return (
      <div className="rounded-2xl border border-gray-100 px-4 py-3 text-sm text-gray-500">
        Belum ada parts yang ditambahkan
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {parts.map((part) => (
        <div
          key={part.tempId}
          className="rounded-2xl border border-gray-100 px-4 py-3 flex flex-wrap gap-4 items-end"
        >
          <div className="flex-1 min-w-[180px]">
            <p className="text-sm font-semibold text-gray-800">
              {part.productName} ({part.productCode})
            </p>
            <p className="text-xs text-gray-500">Stok lokasi: {part.available ?? "?"}</p>
          </div>
          <div className="w-24">
            <p className="text-xs text-gray-500 mb-1">Jumlah</p>
            <input
              type="number"
              min={1}
              max={part.available || undefined}
              value={part.quantity}
              onChange={(e) => onQuantityChange(part.tempId, e.target.value)}
              className="w-full rounded-xl border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-red-500/40"
            />
          </div>
          <div className="w-32">
            <p className="text-xs text-gray-500 mb-1">Harga Satuan</p>
            <p className="text-sm font-semibold text-gray-800">
              {formatRupiah(part.unitPrice)}
            </p>
          </div>
          <div className="flex-1 min-w-[120px]">
            <p className="text-xs text-gray-500 mb-1">Subtotal</p>
            <p className="text-sm font-semibold text-gray-800">
              {formatRupiah(part.unitPrice * part.quantity)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemovePart(part.tempId)}
            className="text-red-500 hover:text-red-600 text-sm"
          >
            <FiX />
          </button>
        </div>
      ))}
    </div>
  );
}

function ServicesTable({ services, onRemoveService }) {
  if (!services.length) {
    return (
      <div className="rounded-2xl border border-gray-100 px-4 py-3 text-sm text-gray-500">
        Belum ada jasa servis
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {services.map((service) => (
        <div
          key={service.tempId}
          className="rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-4"
        >
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">{service.name}</p>
          </div>
          <div className="w-32">
            <p className="text-xs text-gray-500 mb-1">Biaya</p>
            <p className="text-sm font-semibold text-gray-800">
              {formatRupiah(service.cost)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemoveService(service.tempId)}
            className="text-red-500 hover:text-red-600 text-sm"
          >
            <FiX />
          </button>
        </div>
      ))}
    </div>
  );
}

function getStockForLocation(product, location) {
  const stocks = Array.isArray(product?.stocks) ? product.stocks : [];
  const entry = stocks.find((stock) => stock.location === location);
  if (!entry) return 0;
  return Number(entry.quantity || 0);
}
