import { NextResponse } from "next/server";
import { clearSession, getCurrentUser } from "@/lib/auth";
import { deleteUserAndTransferGroups } from "@/lib/account";
import { handleRouteError, jsonError } from "@/lib/http";
import { deleteAccountSchema } from "@/lib/validation";

export async function DELETE(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return jsonError("Unauthorized", 401);
    deleteAccountSchema.parse(await request.json());

    await deleteUserAndTransferGroups(currentUser.id);
    await clearSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
