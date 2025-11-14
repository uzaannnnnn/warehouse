export function PageHeader({ title, description }) {
  return (
    <div className="mb-6 flex flex-col gap-2 border-b border-slate-200 pb-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h1>
      {description ? (
        <p className="max-w-2xl text-sm text-slate-600">{description}</p>
      ) : null}
    </div>
  )
}

