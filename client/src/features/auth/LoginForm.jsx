import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import FormField from "../../components/molecules/FormField";
import { AuthButton } from "../../components/atoms/AuthButton";
import Card from "../../components/atoms/Card";
import { toast } from "sonner";
import { playSuccessSound } from "../../utils/sound";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (value) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value.trim()) return "Email wajib diisi";
    if (!regex.test(value)) return "Format email tidak valid";
    return "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) {
      setEmailError(err);
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Di sini nanti bisa diganti dengan logika auth asli
      toast.success("Login dummy untuk kebutuhan UI saja");
      playSuccessSound();
    }, 800);
  };

  const isDisabled = !email.trim() || !password.trim();

  return (
    <Card className="mx-auto">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 font-body"
      >
        <FormField
          label="Email"
          type="text"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError("");
          }}
          error={emailError}
          placeholder="nama@contoh.com"
        />

        <div className="relative">
          <FormField
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className={`absolute right-3 top-[35px] text-gray-500 hover:text-gray-700 ${
              password.length > 0 ? "block" : "hidden"
            }`}
          >
            {showPassword ? <FiEyeOff /> : <FiEye />}
          </button>
        </div>

        <div className="mb-4 flex justify-center">
          <div className="flex h-20 w-full max-w-xs items-center justify-center rounded border border-slate-300 bg-slate-50 text-[11px] text-slate-500">
            reCAPTCHA placeholder (UI saja)
          </div>
        </div>

        <AuthButton
          isDisabled={isDisabled}
          isLoading={loading}
        >
          LOGIN
        </AuthButton>
      </form>
    </Card>
  );
}
