import { redirect } from "next/navigation";

import { validateRequest } from "@/lib/auth";

export default async function AdminPage() {
  const { user } = await validateRequest();

  if (!user) return redirect("/sign-in");
  if (user.role !== "admin") return redirect("/");

  return (
    <div>
      <h1>Admin Page</h1>
      <p>This is the admin page</p>
    </div>
  );
}
