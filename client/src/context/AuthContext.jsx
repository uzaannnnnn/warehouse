import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user] = useState({
    name: "Warehouse User",
    role: "warehouse",
    avatarUrl: "",
  });

  const logout = () => {
    // Placeholder logout: nanti bisa diarahkan ke /login dan clear state
    // eslint-disable-next-line no-alert
    alert("Logout belum diimplementasikan");
  };

  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
