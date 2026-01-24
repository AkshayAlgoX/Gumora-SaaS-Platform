import Link from "next/link";
import RegisterForm from "../../../../components/auth/register-form";
import { getMe } from "@/lib/auth/getMe";
import { redirect } from "next/navigation";
export default async function RegisterPage() {

    const me = await getMe();
        if(me?.ok) redirect("/dashboard");
  return (

    <>
      <header className="flex flex-col gap-4 border-b border-zinc-200 p-8 sm:p-16 md:p-8">
        <div className="flex items-center justify-between gap-2">
          <h1 className="hidden sm:block text-3xl">
            <Link href="/" className="font-semibold tracking-tight">
              Gumora
            </Link>
          </h1>
          <div className="flex items-center gap-4 text-md">
  <Link className="font-medium underline" href={"/login"}>
    Login
  </Link>
</div>

        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Sign Up</h2> 
      </header>
      <div className="p-8 sm:p-16">
  <div className="max-w-md">
    <RegisterForm />
  </div>
</div>

    </>
  );
}
