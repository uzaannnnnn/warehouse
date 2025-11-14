import { useState } from "react";
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";

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

  const filtered =
    query === ""
      ? items
      : items.filter((item) =>
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
        value={value}
        onChange={(val) => {
          if (val?.__isNew) {
            const newItem = { ...val, _id: `temp-${Date.now()}` };
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
            displayValue={(item) => item?.name || ""}
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
              !items.some(
                (item) => item.name.toLowerCase() === query.toLowerCase(),
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

