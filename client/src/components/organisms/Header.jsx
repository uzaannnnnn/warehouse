import { LogoutButton } from "../atoms/Button";

export default function Header({ onLogout }) {
  return (
    <header className="w-full h-16 flex justify-end">
      <div className="pt-3">
        <LogoutButton onClick={onLogout} />
      </div>
    </header>
  );
}

