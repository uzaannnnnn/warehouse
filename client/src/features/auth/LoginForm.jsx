import { useRef, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import FormField from "../../components/molecules/FormField";
import { AuthButton } from "../../components/atoms/AuthButton";
import Card from "../../components/atoms/Card";
import { toast } from "sonner";
import { playSuccessSound } from "../../utils/sound";
import { useAuth } from "../../context/AuthContext";

const isCaptchaBypassed = String(import.meta.env.VITE_BYPASS_CAPTCHA).toLowerCase() === "true";
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const captchaRef = useRef(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const validateEmail = (value) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value.trim()) return "Email wajib diisi";
    if (!regex.test(value)) return "Format email tidak valid";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) {
      setEmailError(err);
      return;
    }

    if (!isCaptchaBypassed && !captchaToken) {
      toast.error("Silakan selesaikan captcha terlebih dahulu");
      return;
    }

    try {
      setLoading(true);
      await login({
        email: email.trim(),
        password,
        captchaToken: isCaptchaBypassed ? "bypass-token" : captchaToken,
      });
      playSuccessSound();
      toast.success("Login berhasil");
      navigate("/warehouse", { replace: true });
    } catch (error) {
      const message = error?.message ?? "Gagal login, periksa kembali email dan password Anda";
      toast.error(message);
      if (!isCaptchaBypassed && captchaRef.current) {
        captchaRef.current.reset();
        setCaptchaToken("");
      }
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = !email.trim() || !password.trim() || loading;

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
            placeholder="********"
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

        {!isCaptchaBypassed && recaptchaSiteKey ? (
          <div className="mb-4 flex justify-center">
            <ReCAPTCHA
              ref={captchaRef}
              sitekey={recaptchaSiteKey}
              onChange={(token) => setCaptchaToken(token ?? "")}
            />
          </div>
        ) : (
          <div className="mb-4 rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs text-slate-600">
            reCAPTCHA dinonaktifkan melalui konfigurasi lingkungan
          </div>
        )}

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
