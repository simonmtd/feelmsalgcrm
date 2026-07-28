import { requireProfile } from "@/lib/dal";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export default async function AccountPage() {
  await requireProfile();
  return <ChangePasswordForm />;
}
