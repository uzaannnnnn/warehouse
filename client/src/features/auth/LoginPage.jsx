import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-[85vh] items-center justify-center md:min-h-screen">
      <div className="flex w-96 flex-col items-center space-y-6">
        <img
          src="/logo-modifikasiori.webp"
          alt="Modifikasi Ori"
          className="h-12 md:h-16"
        />

        <LoginForm />

        <p className="font-body text-sm text-slate-500">
          Masuk ke akun Anda untuk melanjutkan
        </p>
      </div>
    </div>
  );
}
