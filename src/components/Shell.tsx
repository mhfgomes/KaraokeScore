import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";

export function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
          <Link href="/">
            <ArrowLeft /> Início
          </Link>
        </Button>
        <Brand />
      </header>
      <h1 className="mb-5 text-3xl font-extrabold">{title}</h1>
      {children}
    </main>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card p-5 text-muted-foreground">{children}</div>;
}
