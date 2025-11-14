const categories = [
  { _id: "cat1", name: "Body" },
  { _id: "cat2", name: "Lampu" },
];

const brands = [
  { _id: "brand1", name: "Yamaha" },
  { _id: "brand2", name: "Honda" },
];

const kodeMotors = [
  { _id: "km1", name: "MX-KING" },
  { _id: "km2", name: "CBR 150" },
];

const variants = [
  { _id: "var1", name: "Merah" },
  { _id: "var2", name: "Hitam" },
];

let products = [
  {
    _id: "p1",
    name: "Sparepart Body MX",
    brand: "brand1",
    category: "cat1",
    description: "Sparepart body untuk MX-KING, kualitas premium.",
    image: "/placeholder.png",
    prices: [
      {
        kodeMotor: "km1",
        items: [
          {
            sku: "MX-BOD-RED",
            variant: "var1",
            hpp: 85000,
            price_reseller: 120000,
            price_speedshop: 130000,
            price_umum: 150000,
          },
          {
            sku: "MX-BOD-BLK",
            variant: "var2",
            hpp: 85000,
            price_reseller: 120000,
            price_speedshop: 130000,
            price_umum: 150000,
          },
        ],
      },
    ],
  },
  {
    _id: "p2",
    name: "Lampu Depan CBR",
    brand: "brand2",
    category: "cat2",
    description: "Lampu depan LED khusus CBR.",
    image: "/placeholder.png",
    prices: [
      {
        kodeMotor: "km2",
        items: [
          {
            sku: "CBR-LMP-WHT",
            variant: "var1",
            hpp: 150000,
            price_reseller: 200000,
            price_speedshop: 215000,
            price_umum: 230000,
          },
        ],
      },
    ],
  },
];

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

export const formatRupiah = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  if (value === 0) return "Rp 0";
  return `Rp ${Number(value).toLocaleString("id-ID")}`;
};

export async function fetchCategories() {
  await delay(120);
  return categories;
}

export async function fetchBrands() {
  await delay(120);
  return brands;
}

export async function fetchKodeMotors() {
  await delay(120);
  return kodeMotors;
}

export async function fetchVariants() {
  await delay(120);
  return variants;
}

export async function fetchProductsPaged({ page = 1, limit = 10, search }) {
  await delay(200);
  const q = (search || "").trim().toLowerCase();

  const nameById = (arr, id) =>
    arr.find((x) => x._id === id)?.name.toLowerCase() || "";

  let filtered = [...products];
  if (q) {
    filtered = filtered.filter((p) => {
      const brandName = nameById(brands, p.brand);
      const catName = nameById(categories, p.category);
      return (
        p.name.toLowerCase().includes(q) ||
        brandName.includes(q) ||
        catName.includes(q)
      );
    });
  }

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  return { items, total, pages };
}

export async function fetchProductById(id) {
  await delay(100);
  const found = products.find((p) => p._id === id);
  if (!found) throw new Error("Product not found");
  return found;
}

export async function deleteProductById(id) {
  await delay(120);
  products = products.filter((p) => p._id !== id);
}

export async function upsertProduct(product) {
  await delay(120);
  if (product._id) {
    products = products.map((p) =>
      p._id === product._id ? { ...p, ...product } : p,
    );
  } else {
    const _id = `p${Date.now()}`;
    products = [
      {
        _id,
        description: "",
        image: "/placeholder.png",
        prices: [],
        ...product,
      },
      ...products,
    ];
  }
}

export { brands, categories, kodeMotors, variants };

