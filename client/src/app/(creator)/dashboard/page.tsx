import { getMe } from "@/lib/auth/getMe";
import { redirect } from "next/navigation";

async function Dashboard() {
  const me = await getMe();
  if (!me.ok) redirect("/login");

  return <div>Dashboard</div>;
}

export default Dashboard;
