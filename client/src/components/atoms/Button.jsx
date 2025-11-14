import { FiLoader, FiLogOut } from "react-icons/fi";

export function Button({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function BaseButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`font-body text-sm px-4 py-2 rounded-md transition-all duration-200 ${className}`}
    >
      {children}
    </button>
  );
}

export function LogoutButton({
  children = "Logout",
  isLoading = false,
  className = "",
  ...props
}) {
  const label =
    typeof children === "string" && children.trim().length > 0
      ? children
      : "Logout";

  return (
    <BaseButton
      type="button"
      aria-label={label}
      aria-busy={isLoading}
      {...props}
      className={`flex items-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/30 ${className}`}
    >
      {isLoading ? (
        <FiLoader className="h-4 w-4 animate-spin" />
      ) : (
        <FiLogOut className="h-4 w-4" />
      )}
      <span className="hidden md:inline font-medium tracking-wide">
        {label}
      </span>
      <span className="sr-only">{label}</span>
    </BaseButton>
  );
}
