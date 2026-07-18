import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ChatShell } from "@/components/chat-shell";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  return <ChatShell currentUser={user} />;
}
