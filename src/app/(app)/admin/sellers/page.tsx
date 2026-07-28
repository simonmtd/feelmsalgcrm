import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateSellerForm } from "@/components/admin/create-seller-form";
import { SellerActiveToggle } from "@/components/admin/seller-active-toggle";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";
import type { Profile } from "@/lib/types";

export default async function AdminSellersPage() {
  const supabase = await createClient();
  const { data: sellers } = await supabase
    .from("profiles")
    .select("*, active_niche:niches(*)")
    .order("created_at", { ascending: false });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Ny bruker</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateSellerForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alle brukere</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/25 text-left text-xs uppercase text-wood-700">
                <th className="py-2 pr-4">Navn</th>
                <th className="py-2 pr-4">E-post</th>
                <th className="py-2 pr-4">Rolle</th>
                <th className="py-2 pr-4">Aktiv niche</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {(sellers as Profile[] | null)?.map((seller) => (
                <tr key={seller.id} className="border-b border-ink/15">
                  <td className="py-2 pr-4">{seller.full_name ?? "–"}</td>
                  <td className="py-2 pr-4">{seller.email}</td>
                  <td className="py-2 pr-4 capitalize">{seller.role}</td>
                  <td className="py-2 pr-4">{seller.active_niche?.name ?? "–"}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={seller.is_active ? "green" : "red"}>
                      {seller.is_active ? "Aktiv" : "Deaktivert"}
                    </Badge>
                  </td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-1">
                      <ResetPasswordButton sellerId={seller.id} />
                      <SellerActiveToggle sellerId={seller.id} isActive={seller.is_active} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
