export default function FormField({
  label,
  type = "text",
  value,
  onChange,
  error,
  placeholder,
}) {
  return (
    <div className="space-y-1">
      {label ? (
        <label className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      ) : null}
      <input
        type={type}
        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      {error ? (
        <p className="text-xs text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}

