const LOCATION_TYPES = {
  BAHAN_BAKU: "bahanbaku",
  KEMASAN: "kemasan",
  PRODUKSI: "produksi",
  SPEEDSHOP: "speedshop",
  WAREHOUSE: "warehouse", // Online Packing
};

const LOCATION_TYPE_LABELS = {
  [LOCATION_TYPES.BAHAN_BAKU]: "BAHAN BAKU",
  [LOCATION_TYPES.KEMASAN]: "KEMASAN",
  [LOCATION_TYPES.PRODUKSI]: "PRODUKSI",
  [LOCATION_TYPES.SPEEDSHOP]: "SPEEDSHOP",
  [LOCATION_TYPES.WAREHOUSE]: "ONLINE PACKING",
};

const DEFAULT_LOCATIONS = [
  { number: 1, type: LOCATION_TYPES.BAHAN_BAKU, name: "KTP" },
  { number: 2, type: LOCATION_TYPES.BAHAN_BAKU, name: "DPK" },
  { number: 3, type: LOCATION_TYPES.BAHAN_BAKU, name: "BGR" },
  { number: 4, type: LOCATION_TYPES.PRODUKSI, name: "KTP" },
  { number: 5, type: LOCATION_TYPES.PRODUKSI, name: "DPK" },
  { number: 6, type: LOCATION_TYPES.PRODUKSI, name: "BGR" },
  { number: 7, type: LOCATION_TYPES.SPEEDSHOP, name: "KTP" },
  { number: 8, type: LOCATION_TYPES.SPEEDSHOP, name: "DPK" },
  { number: 9, type: LOCATION_TYPES.SPEEDSHOP, name: "BGR" },
  { number: 10, type: LOCATION_TYPES.KEMASAN, name: "KTP" },
  { number: 11, type: LOCATION_TYPES.KEMASAN, name: "DPK" },
  { number: 12, type: LOCATION_TYPES.KEMASAN, name: "BGR" },
  { number: 13, type: LOCATION_TYPES.WAREHOUSE, name: "KTP" },
  { number: 14, type: LOCATION_TYPES.WAREHOUSE, name: "DPK" },
  { number: 15, type: LOCATION_TYPES.WAREHOUSE, name: "BGR" },
];

function formatLocationLabel({ number, type, name }) {
  const paddedNumber = String(number || 0).padStart(2, "0");
  const typeLabel = LOCATION_TYPE_LABELS[type] || String(type || "").toUpperCase();
  const suffix = String(name || "").trim().toUpperCase();
  return `${paddedNumber}-${typeLabel}-${suffix}`;
}

module.exports = {
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
  DEFAULT_LOCATIONS,
  formatLocationLabel,
};
