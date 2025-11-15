function normalizeLocation(location) {
  if (typeof location !== "string") {
    return null;
  }
  const trimmed = location.trim();
  return trimmed.length ? trimmed : null;
}

function sanitizeQuantity(quantity) {
  const parsed = Number(quantity);
  if (Number.isFinite(parsed)) {
    return Math.max(0, parsed);
  }
  return 0;
}

function sanitizePrice(value) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return undefined;
}

function cloneStocks(stocks = []) {
  if (!Array.isArray(stocks)) {
    return [];
  }
  return stocks.map((entry) => {
    const quantity =
      typeof entry.quantity === "number" && Number.isFinite(entry.quantity)
        ? entry.quantity
        : 0;
    const clone = {
      location: typeof entry.location === "string" ? entry.location : undefined,
      quantity,
    };
    if (entry._id) {
      clone._id = entry._id;
    }
    return clone;
  });
}

function clonePrices(prices = []) {
  if (!Array.isArray(prices)) {
    return [];
  }
  return prices.map((entry) => {
    const clone = {
      location: typeof entry.location === "string" ? entry.location : undefined,
    };
    if (typeof entry.purchasePrice === "number" && Number.isFinite(entry.purchasePrice)) {
      clone.purchasePrice = entry.purchasePrice;
    }
    if (typeof entry.sellingPrice === "number" && Number.isFinite(entry.sellingPrice)) {
      clone.sellingPrice = entry.sellingPrice;
    }
    if (entry._id) {
      clone._id = entry._id;
    }
    return clone;
  });
}

function cloneNames(names = []) {
  if (!Array.isArray(names)) {
    return [];
  }
  return names.map((entry) => {
    const clone = {
      location: typeof entry.location === "string" ? entry.location : undefined,
    };
    if (typeof entry.value === "string" && entry.value.trim().length) {
      clone.value = entry.value.trim();
    }
    if (entry._id) {
      clone._id = entry._id;
    }
    return clone;
  });
}

function sumStocks(stocks = []) {
  return stocks.reduce(
    (total, entry) =>
      total +
      (typeof entry.quantity === "number" && Number.isFinite(entry.quantity)
        ? entry.quantity
        : 0),
    0,
  );
}

function setLocationStock(target, location, quantity) {
  if (!target) {
    return target;
  }
  const normalizedLocation = normalizeLocation(location);
  if (!normalizedLocation) {
    return target;
  }

  const safeQuantity = sanitizeQuantity(quantity);
  const stocksArray = cloneStocks(target.stocks);
  const entryIndex = stocksArray.findIndex(
    (entry) => entry.location === normalizedLocation,
  );

  if (entryIndex >= 0) {
    stocksArray[entryIndex].quantity = safeQuantity;
  } else {
    stocksArray.push({
      location: normalizedLocation,
      quantity: safeQuantity,
    });
  }

  target.stocks = stocksArray;
  target.stock = sumStocks(stocksArray);
  return target;
}

function setLocationPricing(target, location, pricing = {}) {
  if (!target) {
    return target;
  }
  const normalizedLocation = normalizeLocation(location);
  if (!normalizedLocation) {
    return target;
  }

  const purchasePrice = sanitizePrice(pricing.purchasePrice);
  const sellingPrice = sanitizePrice(pricing.sellingPrice);
  const hasPurchase = purchasePrice !== undefined;
  const hasSelling = sellingPrice !== undefined;

  if (!hasPurchase && !hasSelling) {
    return target;
  }

  const pricesArray = clonePrices(target.prices);
  const entryIndex = pricesArray.findIndex((entry) => entry.location === normalizedLocation);
  const payload = { location: normalizedLocation };
  if (hasPurchase) {
    payload.purchasePrice = purchasePrice;
  }
  if (hasSelling) {
    payload.sellingPrice = sellingPrice;
  }

  if (entryIndex >= 0) {
    pricesArray[entryIndex] = {
      ...pricesArray[entryIndex],
      ...payload,
    };
  } else {
    pricesArray.push(payload);
  }

  target.prices = pricesArray;
  return target;
}

function getPricingForLocation(target, location) {
  const normalizedLocation = normalizeLocation(location);
  if (!normalizedLocation) {
    return {};
  }
  const pricesArray = Array.isArray(target?.prices) ? target.prices : [];
  const entry = pricesArray.find((item) => item.location === normalizedLocation);
  if (!entry) {
    return {};
  }
  const result = {};
  if (typeof entry.purchasePrice === "number" && Number.isFinite(entry.purchasePrice)) {
    result.purchasePrice = entry.purchasePrice;
  }
  if (typeof entry.sellingPrice === "number" && Number.isFinite(entry.sellingPrice)) {
    result.sellingPrice = entry.sellingPrice;
  }
  return result;
}

function setLocationName(target, location, name) {
  if (!target) {
    return target;
  }
  const normalizedLocation = normalizeLocation(location);
  const value = typeof name === "string" ? name.trim() : "";
  if (!normalizedLocation || !value.length) {
    return target;
  }

  const namesArray = cloneNames(target.names);
  const entryIndex = namesArray.findIndex((entry) => entry.location === normalizedLocation);
  const payload = { location: normalizedLocation, value };

  if (entryIndex >= 0) {
    namesArray[entryIndex] = payload;
  } else {
    namesArray.push(payload);
  }

  target.names = namesArray;
  return target;
}

function getNameForLocation(target, location) {
  const normalizedLocation = normalizeLocation(location);
  if (!normalizedLocation) {
    return null;
  }
  const namesArray = Array.isArray(target?.names) ? target.names : [];
  const entry = namesArray.find((item) => item.location === normalizedLocation);
  if (entry && typeof entry.value === "string" && entry.value.trim().length) {
    return entry.value;
  }
  return null;
}

module.exports = {
  normalizeLocation,
  setLocationStock,
  setLocationPricing,
  setLocationName,
  cloneStocks,
  clonePrices,
  cloneNames,
  sumStocks,
  getPricingForLocation,
  getNameForLocation,
};
