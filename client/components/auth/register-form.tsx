"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleOnSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (data?.ok) {
        toast.success("Account created. Please log in...");
        router.push("/login");
      } else {
        toast.error(data?.error || "Registration failed");
      }
    } catch (e) {
      console.error(e);
      toast.error("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }



  return (
    <Card className="border-0 bg-transparent shadow-none">
  <form onSubmit={handleOnSubmit} className="space-y-4">
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-zinc-900 mb-2">
        Name
      </legend>

      <Input
        required
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-11 border-zinc-300 text-[15px] placeholder:text-zinc-400"
      />
    </fieldset>
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
  {loading ? "Creating..." : "Create Account"}
</Button>

  </form>
</Card>

  );
}

export default RegisterForm;
