"use client";

import { useEffect, useState } from "react";
import { Notice, Shell } from "@/components/Shell";
import { useLiveState } from "@/components/useLiveState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import type { Menu } from "@/lib/menu";
import { cn } from "@/lib/utils";

export default function MenuPage() {
  const { state } = useLiveState();
  const [menu, setMenu] = useState<Menu | null>(null);

  // Volta a carregar sempre que chega uma atualização em tempo real
  useEffect(() => {
    fetch("/api/menu", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMenu(d.menu));
  }, [state]);

  const enabled = state?.brand.menuEnabled ?? true;
  const categories = enabled ? (menu?.filter((c) => c.items.length > 0) ?? []) : [];

  return (
    <Shell title="Menu">
      {(!enabled || (menu && categories.length === 0)) && <Notice>O menu não está disponível de momento.</Notice>}
      <div className="space-y-4">
        {categories.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="text-xl font-extrabold">{c.name}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {c.items.map((item) => (
                <div key={item.id} className={cn("flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0", !item.available && "opacity-50")}>
                  <div>
                    <p className="font-semibold">
                      {item.name}
                      {!item.available && (
                        <Badge variant="secondary" className="ml-2 align-middle">
                          Esgotado
                        </Badge>
                      )}
                    </p>
                    {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                  </div>
                  <span className="font-bold whitespace-nowrap text-gold">{formatPrice(item.priceCents)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </Shell>
  );
}
