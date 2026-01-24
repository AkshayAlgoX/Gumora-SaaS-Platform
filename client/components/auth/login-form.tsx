"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleOnSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      const loginRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
        credentials: "include",
      });

      const loginData = await loginRes.json();

      if (!loginData?.ok) {
        toast.error(loginData?.error || "Login failed");
        return;
      }

      const meRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`,
        {
          credentials: "include",
        }
      );

      const meData = await meRes.json();

      if (meData?.user) {
        toast.success("Login successful");
        console.log("Auth verified, redirecting to dashboard...", meData);
        // Wait a moment for everything to settle
        await new Promise(resolve => setTimeout(resolve, 1000));
        router.push("/dashboard/products");
        // Force hard refresh of layout
        setTimeout(() => {
          window.location.href = "/dashboard/products";
        }, 500);
      } else {
        console.error("Session verification failed", meData);
        toast.error("Session verification failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Login failed. Please try again.");
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
            className="h-11 border-zinc-300 text-[15px]"
          />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-900 mb-2">
            Password
          </legend>
          <Input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 border-zinc-300 text-[15px]"
          />
        </fieldset>

        <Button
          disabled={loading}
          className="h-11 w-full bg-zinc-900 text-white"
        >
          {loading ? "Logging in..." : "Log In"}
        </Button>
      </form>
    </Card>
  );
}

export default LoginForm;
