import { LoginForm } from "@/features/auth";

export function AuthPage() {
  return (
    <div className="bg-background flex h-[calc(100%_-_34px)] flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
