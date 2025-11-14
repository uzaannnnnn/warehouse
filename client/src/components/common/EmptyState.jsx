export default function EmptyState({
  title,
  description,
  buttonText,
  onButtonClick,
  illustration,
}) {
  const Illustrations = {
    box: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="mb-4 h-28 w-28 text-red-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.25 7.5l-8.25-4.5-8.25 4.5M3 7.5v9l9 4.5 9-4.5v-9"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 12l9-4.5M12 12L3 7.5"
        />
      </svg>
    ),
    search: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="mb-4 h-28 w-28 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
        />
      </svg>
    ),
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fadeIn">
      {Illustrations[illustration]}
      <h2 className="mb-1 text-xl font-semibold text-gray-700">{title}</h2>
      <p className="mb-5 text-sm text-gray-500">{description}</p>
      {buttonText && onButtonClick && (
        <button
          type="button"
          onClick={onButtonClick}
          className="rounded-lg bg-red-500 px-5 py-2 text-sm text-white shadow-md transition-all hover:bg-red-600"
        >
          {buttonText}
        </button>
      )}
    </div>
  );
}

