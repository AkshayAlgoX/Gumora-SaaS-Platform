"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { apiClient } from "@/lib/api/client";



function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleOnSubmit(event: React.FormEvent) {
  event.preventDefault();
  setLoading(true);

  try {
    const res = await apiClient.post("/api/auth/login",{
        email,password
    });
    if (res?.data?.ok) {
  toast.success(
    res?.data?.message || "Log in successfull..."
  );
  router.push("/");
  router.refresh();
} else {
  toast.error(res?.data?.error || "Login failed");
}

  } catch (e: any) {
    console.log(e);
    toast.error(e?.response?.data?.error || "Login failed. Please try again.");
  } finally {
    setLoading(false);
  }
}



  return (
    <Card className="border-0 bg-transparent shadow-none">
  <form onSubmit={handleOnSubmit} className="space-y-4">
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-zinc-900 mb-2">
        Email
      </legend>

      <Input
        required
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11 border-zinc-300 text-[15px] placeholder:text-zinc-400"
      />
    </fieldset>
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-zinc-900 mb-2">
        Password
      </legend>

      <Input
        required
        type="password"
        autoComplete="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-11 border-zinc-300 text-[15px] placeholder:text-zinc-400"
      />
    </fieldset>

    
     <Button
  disabled={loading}
  className="h-11 w-full bg-zinc-900 text-white shadow-sm"
>
  {loading ? "Logging in..." : "Log In"}
</Button>

  </form>
</Card>

  );
}

export default LoginForm;
