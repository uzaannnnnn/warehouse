import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";

const normalizeOption = (item) => {
  if (!item) return null;
  if (typeof item === "string") {
    return { _id: item, name: item };
  }
  if (item._id) return item;
  if (item.name) return { ...item, _id: item.name };
  return null;
};

export default function ComboBoxWithCreate({
  label,
  items,
  value,
  onChange,
  onAddNew,
  placeholder = "Pilih atau ketik...",
}) {
  const [query, setQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const normalizedItems = useMemo(
    () => (items || []).map((item) => normalizeOption(item)).filter(Boolean),
    [items],
  );

  const filtered =
    query === ""
      ? normalizedItems
      : normalizedItems.filter((item) =>
          item.name.toLowerCase().includes(query.toLowerCase()),
        );

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <Combobox
        value={normalizeOption(value)}
        onChange={(val) => {
          if (val?.__isNew) {
            const trimmed = val.name.trim();
            if (!trimmed) {
              setIsDropdownOpen(false);
              return;
            }
            const newItem = { _id: trimmed, name: trimmed };
            onAddNew?.(newItem);
            onChange(newItem);
          } else {
            onChange(val);
          }
          setIsDropdownOpen(false);
        }}
      >
        <div className="relative mt-1">
          <ComboboxInput
            className="w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            onFocus={() => {
              setQuery("");
              setIsDropdownOpen(true);
            }}
            onBlur={() => setTimeout(() => setIsDropdownOpen(false), 100)}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsDropdownOpen(true);
            }}
            displayValue={(item) =>
              typeof item === "string" ? item : item?.name || ""
            }
            placeholder={placeholder}
          />

          <ComboboxOptions
            static
            className={`absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border bg-white text-sm shadow-lg ${
              isDropdownOpen ? "" : "hidden"
            }`}
          >
            {filtered.map((item) => (
              <ComboboxOption
                key={item._id}
                value={item}
                className={({ active }) =>
                  `cursor-pointer px-2 py-1 ${
                    active ? "bg-blue-100" : "hover:bg-gray-100"
                  }`
                }
              >
                {item.name}
              </ComboboxOption>
            ))}

            {query !== "" &&
              !normalizedItems.some(
                (item) => item.name.toLowerCase() === query.toLowerCase().trim(),
              ) && (
                <ComboboxOption
                  value={{ __isNew: true, name: query.trim() }}
                  className="cursor-pointer px-2 py-1 font-medium text-blue-600"
                >
                  + Tambah "{query}"
                </ComboboxOption>
              )}
          </ComboboxOptions>
        </div>
      </Combobox>
    </div>
  );
}

