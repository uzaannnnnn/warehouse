import { FiLoader } from "react-icons/fi";
import { HiOutlineLogout as FiLogOut } from "react-icons/hi";

export function BaseButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`font-body inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function AuthButton({ children, isDisabled, isLoading, className = "", ...props }) {
  const disabled = isDisabled || isLoading;

  return (
    <BaseButton
      {...props}
      type="submit"
      disabled={disabled}
      className={`flex h-11 w-full items-center justify-center gap-2 font-heading text-lg tracking-wider transition-all duration-300 ease-in-out transform ${
        disabled
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-brand-red hover:bg-brand-dark cursor-pointer hover:scale-[1.02] text-white"
      } ${className}`}
    >
      {isLoading && <FiLoader className="animate-spin" />}
      {children}
    </BaseButton>
  );
}

export function LogoutButton({
  children = "Logout",
  isLoading = false,
  className = "",
  ...props
}) {
  const label =
    typeof children === "string" && children.trim().length > 0 ? children : "Logout";

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
      <span className="hidden md:inline font-medium tracking-wide">{label}</span>
      <span className="sr-only">{label}</span>
    </BaseButton>
  );
}
