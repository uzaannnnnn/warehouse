import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import {
  FiUsers,
  FiRefreshCw,
  FiPlus,
  FiMapPin,
  FiMail,
  FiLock,
  FiUser,
  FiDatabase,
  FiEdit2,
  FiX,
} from "react-icons/fi";
import EmptyState from "../../../components/common/EmptyState";
import { WarehousePageShell } from "../../../components/templates/WarehousePageShell";
import { useAuth } from "../../../context/AuthContext";
import {
  createManagementLocation,
  createManagementUser,
  fetchManagementLocations,
  fetchManagementUsers,
  updateManagementUser,
} from "../api/management";

const ROLE_OPTIONS = [
  { value: "bahanbaku", label: "Bahan Baku" },
  { value: "kemasan", label: "Kemasan" },
  { value: "produksi", label: "Produksi" },
  { value: "speedshop", label: "Speedshop" },
];

const DEFAULT_ROLE =
  ROLE_OPTIONS.find((role) => role.value !== "manager")?.value || ROLE_OPTIONS[0].value;

const ROLE_LOCATION_TYPE_MAP = {
  bahanbaku: "bahanbaku",
  kemasan: "kemasan",
  produksi: "produksi",
  speedshop: "speedshop",
};

const LOCATION_TYPE_LABELS = {
  bahanbaku: "Bahan Baku",
  kemasan: "Kemasan",
  produksi: "Produksi",
  speedshop: "Speedshop",
};

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

const defaultUserForm = {
  id: null,
  name: "",
  email: "",
  password: "",
  role: DEFAULT_ROLE,
  locationCode: "",
};

export default function AccountManagementPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState("create");
  const [userForm, setUserForm] = useState(defaultUserForm);
  const [savingUser, setSavingUser] = useState(false);
  const [editOriginalRole, setEditOriginalRole] = useState(null);
  const [editOriginalLocation, setEditOriginalLocation] = useState(null);

  const [showInlineLocation, setShowInlineLocation] = useState(false);
  const [locationForm, setLocationForm] = useState({ name: "", type: "bahanbaku" });
  const [savingLocation, setSavingLocation] = useState(false);

  const searchDebounce = useRef(null);

  const allowedToManage = user?.role === "manager" || user?.role === "admin";
  if (!allowedToManage) {
    return <Navigate to="/warehouse" replace />;
  }

  const locationOptionsForRole = useCallback(
    (roleValue) => {
      const expectedType = ROLE_LOCATION_TYPE_MAP[roleValue];
      if (!expectedType) return locations;
      return locations.filter((loc) => loc.type === expectedType);
    },
    [locations],
  );

  const getDefaultLocationForRole = useCallback(
    (roleValue) => {
      const options = locationOptionsForRole(roleValue);
      return options[0]?.code || "";
    },
    [locationOptionsForRole],
  );

  const nextLocationNumber = useMemo(() => {
    let maxNumber = 0;
    locations.forEach((loc) => {
      const parsed =
        Number(loc?.number) ||
        Number(String(loc?.label || loc?.code || "").split("-")[0]);
      if (!Number.isNaN(parsed)) {
        maxNumber = Math.max(maxNumber, parsed);
      }
    });
    return maxNumber + 1;
  }, [locations]);

  const loadLocations = useCallback(async () => {
    try {
      const data = await fetchManagementLocations();
      const sorted = Array.isArray(data)
        ? [...data].sort((a, b) => (a.number || 0) - (b.number || 0))
        : [];
      setLocations(sorted);
    } catch (error) {
      toast.error(error?.message || "Gagal memuat lokasi");
    }
  }, []);

  const loadUsers = useCallback(
    async (overrides = {}) => {
      const params = {
        search: overrides.search ?? search,
        role: overrides.role ?? roleFilter,
      };
      try {
        setLoadingUsers(true);
        const data = await fetchManagementUsers({
          search: params.search?.trim() || undefined,
          role: params.role || undefined,
        });
        setUsers(Array.isArray(data) ? data : []);
      } catch (error) {
        toast.error(error?.message || "Gagal memuat akun");
      } finally {
        setLoadingUsers(false);
      }
    },
    [roleFilter, search],
  );

  useEffect(() => {
    loadLocations();
    loadUsers();
  }, []);

  useEffect(() => {
    if (searchDebounce.current) {
      clearTimeout(searchDebounce.current);
    }
    searchDebounce.current = setTimeout(() => {
      loadUsers();
    }, 320);
    return () => clearTimeout(searchDebounce.current);
  }, [search, roleFilter, loadUsers]);

  useEffect(() => {
    const options = locationOptionsForRole(userForm.role);
    const hasSelected = options.some((loc) => loc.code === userForm.locationCode);
    if (!hasSelected) {
      setUserForm((prev) => ({
        ...prev,
        locationCode: options[0]?.code || getDefaultLocationForRole(prev.role),
      }));
    }
  }, [userForm.role, locations, locationOptionsForRole, getDefaultLocationForRole]);

  const openCreateUser = () => {
    setUserModalMode("create");
    setUserForm(defaultUserForm);
    setEditOriginalRole(null);
    setEditOriginalLocation(null);
    setUserModalOpen(true);
  };

  const openEditUser = (target) => {
    if (target.role === "manager") {
      toast.error("Akun manager tidak dapat diubah");
      return;
    }
    setUserModalMode("edit");
    const fallbackLocation = target.location || getDefaultLocationForRole(target.role);
    setUserForm({
      id: target.id,
      name: target.name || "",
      email: target.email || "",
      password: "",
      role: target.role === "manager" ? DEFAULT_ROLE : target.role || DEFAULT_ROLE,
      locationCode: fallbackLocation,
    });
    setEditOriginalRole(target.role || null);
    setEditOriginalLocation(target.location || null);
    setUserModalOpen(true);
  };

  async function handleSaveUser(event) {
    event.preventDefault();
    const trimmedName = userForm.name.trim();
    const trimmedEmail = userForm.email.trim();
    if (!trimmedName || !trimmedEmail) {
      toast.error("Nama dan email wajib diisi");
      return;
    }
    if (userModalMode === "create" && !userForm.password.trim()) {
      toast.error("Password wajib diisi untuk akun baru");
      return;
    }

    try {
      setSavingUser(true);
      const payload = {
        name: trimmedName,
        email: trimmedEmail,
      };

      if (userModalMode === "create") {
          if (!userForm.locationCode) {
            toast.error("Silakan pilih lokasi untuk role tersebut");
            setSavingUser(false);
            return;
          }
        await createManagementUser({
          ...userForm,
          name: trimmedName,
          email: trimmedEmail,
        });
        toast.success("Akun berhasil dibuat");
      } else {
        if (userForm.password.trim()) {
          payload.password = userForm.password;
        }

        const roleChanged = userForm.role && userForm.role !== editOriginalRole;
        const locationChanged =
          userForm.locationCode && userForm.locationCode !== editOriginalLocation;

        if (roleChanged) {
          payload.role = userForm.role;
          if (!userForm.locationCode) {
            toast.error("Silakan pilih lokasi untuk role tersebut");
            setSavingUser(false);
            return;
          }
          payload.locationCode = userForm.locationCode;
        } else if (locationChanged) {
          payload.locationCode = userForm.locationCode;
        }

        await updateManagementUser(userForm.id, payload);
        toast.success("Akun berhasil diperbarui");
      }
      setUserModalOpen(false);
      await loadUsers();
    } catch (error) {
      toast.error(error?.message || "Gagal menyimpan akun");
    } finally {
      setSavingUser(false);
    }
  }

  async function handleCreateLocation(event) {
    event.preventDefault();
    if (!locationForm.name.trim()) {
      toast.error("Nama lokasi wajib diisi");
      return;
    }
    try {
      setSavingLocation(true);
      const created = await createManagementLocation({
        ...locationForm,
        name: locationForm.name.trim().toUpperCase(),
      });
      toast.success(`Lokasi ${created?.label || created?.code} ditambahkan`);
      setLocationForm((prev) => ({ ...prev, name: "" }));
      await loadLocations();
      if (created?.code) {
        setUserForm((prev) => ({ ...prev, locationCode: created.code }));
      }
      setShowInlineLocation(false);
    } catch (error) {
      toast.error(error?.message || "Gagal menambah lokasi");
    } finally {
      setSavingLocation(false);
    }
  }

  return (
    <WarehousePageShell
      title="Kelola Akun"
      icon={FiUsers}
      headerRight={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              loadLocations();
              loadUsers();
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md"
          >
            <FiRefreshCw />
            Segarkan
          </button>
          <button
            type="button"
            onClick={openCreateUser}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600"
          >
            <FiPlus />
            Buat Akun
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="grid gap-3 md:grid-cols-3 md:items-center">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Cari akun
              </label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-red-200 focus-within:ring-2 focus-within:ring-red-100">
                <FiUser className="text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nama atau email"
                  className="w-full bg-transparent text-sm text-slate-800 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                Filter role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-red-200 focus:ring-2 focus:ring-red-100"
              >
                <option value="">Semua role</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Daftar Akun</p>
              <p className="text-xs text-slate-500">
                Kelola akses peran dan lokasi tim warehouse.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {users.length} akun
            </div>
          </div>
          <UserTable users={users} loading={loadingUsers} onEdit={openEditUser} />
        </div>
      </div>

      <Modal open={userModalOpen} onClose={() => setUserModalOpen(false)} title="Form Akun">
        <form onSubmit={handleSaveUser} className="space-y-3">
          <p className="text-sm text-slate-600">
            {userModalMode === "create"
              ? "Buat akun baru dengan role dan lokasi yang sesuai."
              : "Perbarui nama, role, lokasi, atau reset password."}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <LabeledInput
              label="Nama"
              icon={<FiUser />}
              value={userForm.name}
              onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nama lengkap"
              required
            />
            <LabeledInput
              label="Email"
              icon={<FiMail />}
              value={userForm.email}
              placeholder="Email"
              onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <LabeledInput
              label={userModalMode === "create" ? "Password" : "Password (opsional)"}
              icon={<FiLock />}
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder={userModalMode === "create" ? "Minimal 8 karakter" : "Biarkan kosong jika tidak diubah"}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Role</label>
              <select
                value={userForm.role}
                onChange={(e) =>
                  setUserForm((prev) => ({
                    ...prev,
                    role: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-red-200 focus:ring-2 focus:ring-red-100"
              >
                {ROLE_OPTIONS.filter((role) => role.value !== "manager").map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                Lokasi
              </label>
              <div className="mt-1 flex gap-2">
                <select
                  value={userForm.locationCode || ""}
                  onChange={(e) => {
                    if (e.target.value === "__add") {
                      setShowInlineLocation(true);
                      setLocationForm((prev) => ({
                        ...prev,
                        type: ROLE_LOCATION_TYPE_MAP[userForm.role] || prev.type,
                      }));
                      return;
                    }
                    setShowInlineLocation(false);
                    setUserForm((prev) => ({ ...prev, locationCode: e.target.value }));
                  }}
                  disabled={userForm.role === "manager"}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-red-200 focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  {userForm.role === "manager" ? (
                    <option value="">Tidak terikat lokasi</option>
                  ) : locationOptionsForRole(userForm.role).length ? (
                    <>
                      {locationOptionsForRole(userForm.role).map((loc) => (
                        <option key={loc.code} value={loc.code}>
                          {loc.label || loc.code}
                        </option>
                      ))}
                      <option value="__add">+ Tambah lokasi baru</option>
                    </>
                  ) : (
                    <option value="__add">Belum ada lokasi • Tambah baru</option>
                  )}
                </select>
              </div>
              {showInlineLocation && userForm.role !== "manager" ? (
                <div className="mt-3 space-y-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-semibold uppercase text-slate-500">
                        Jenis lokasi
                      </label>
                      <select
                        value={locationForm.type}
                        onChange={(e) =>
                          setLocationForm((prev) => ({ ...prev, type: e.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-red-200 focus:ring-2 focus:ring-red-100"
                      >
                        {Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <LabeledInput
                      label="Nama lokasi"
                      icon={<FiDatabase />}
                      value={locationForm.name}
                      onChange={(e) =>
                        setLocationForm((prev) => ({
                          ...prev,
                          name: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="Contoh: BKS, JKT, GUDANG TIMUR"
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Nomor berikutnya:{" "}
                      <strong className="text-slate-800">
                        {String(nextLocationNumber).padStart(2, "0")}
                      </strong>
                    </span>
                    <span>Tambahkan sesuai role yang dipilih</span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowInlineLocation(false);
                        setLocationForm((prev) => ({ ...prev, name: "" }));
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateLocation}
                      disabled={savingLocation}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    >
                      <FiMapPin />
                      {savingLocation ? "Menyimpan..." : "Tambah Lokasi"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setUserModalOpen(false)}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingUser}
              className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300"
            >
              <FiPlus />
              {savingUser ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </Modal>

    </WarehousePageShell>
  );
}

function UserTable({ users, loading, onEdit }) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-5 text-sm text-slate-600">
        <div className="h-3 w-3 animate-ping rounded-full bg-red-500" />
        Memuat data akun...
      </div>
    );
  }

  if (!users.length) {
    return (
      <EmptyState
        title="Belum ada akun"
        description="Tambahkan akun baru untuk tim sesuai kebutuhan dan lokasi."
        illustration="search"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nama
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Role
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Lokasi
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Login Terakhir
            </th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-800">
                <div className="flex flex-col">
                  <span>{user.name}</span>
                  <span className="text-[11px] font-medium text-slate-500">
                    Dibuat {formatDate(user.createdAt)}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-700">{user.email}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-700">
                  {user.role}
                </span>
              </td>
              <td className="px-4 py-3">
                {user.location ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {user.location}
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">-</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-slate-600">
                  {formatDate(user.lastLoginAt)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onEdit(user)}
                    disabled={user.role === "manager"}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FiEdit2 />
                    Edit
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LabeledInput({ label, icon, inputRef, ...props }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase text-slate-500">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-red-200 focus-within:ring-2 focus-within:ring-red-100">
        {icon ? <span className="text-slate-500">{icon}</span> : null}
        <input
          ref={inputRef}
          {...props}
          className="w-full bg-transparent text-sm text-slate-800 outline-none"
        />
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 animate-fadeIn">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-50"
          >
            <FiX />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
