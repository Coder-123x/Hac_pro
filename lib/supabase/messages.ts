type SupabaseErrorLike = { message?: string; code?: string } | null;

export function friendlyError(error: SupabaseErrorLike): string {
  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (message.includes("user already registered")) return "An account with this email already exists.";
  if (message.includes("email rate limit")) return "Too many attempts. Please wait and try again.";
  if (message.includes("expired")) return "This invitation has expired. Ask a parent for a new invitation.";
  if (message.includes("already been used") || message.includes("already associated")) {
    return "This invitation has already been used or your account is already in that family.";
  }
  if (message.includes("different email")) return "This invitation was issued to a different email address.";
  if (message.includes("only an active parent")) return "Only an active family parent can send invitations.";
  if (message.includes("load failed") || message.includes("failed to fetch") || message.includes("network")) {
    return "We could not reach the authentication service. Check your connection or Supabase configuration, then try again.";
  }
  if (message.includes("relation") && message.includes("does not exist")) {
    return "This feature is unavailable because its database migration has not been applied.";
  }
  if (error?.code === "42501" || message.includes("permission denied")) {
    return "You do not have permission to perform that action.";
  }
  return error?.message || "Something went wrong. Please try again.";
}
