"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { PageTransition } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiMutate, FetchError } from "@/lib/fetcher";
import { useCompanyStore } from "@/store/company-store";
import type { SafeAccount } from "@/types";

function CompanySettingsForm({ company }: { company: SafeAccount }) {
  const [name, setName] = useState(company.name ?? "");
  const [avatar, setAvatar] = useState(company.avatar ?? "");
  const [gmail, setGmail] = useState(company.gmail ?? "");
  const [phone, setPhone] = useState(company.phone ?? "");
  const [address, setAddress] = useState(company.address ?? "");
  const [website, setWebsite] = useState(company.website ?? "");

  const setCompany = useCompanyStore((s) => s.setCompany);

  const save = useMutation({
    mutationFn: () =>
      apiMutate<SafeAccount>("PATCH", "/api/company", {
        body: { name, avatar, gmail, phone, address, website },
      }),
    onSuccess: (updated) => {
      setCompany(updated);
      toast.success("Company info saved");
    },
    onError: (error) => {
      toast.error(error instanceof FetchError ? error.message : "Could not save company info");
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <Card>
      <CardContent className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
            </Field>
            <Field label="Logo URL" description="Optional — a direct image link.">
              <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} maxLength={500} />
            </Field>
            <Field label="Contact email">
              <Input
                type="email"
                value={gmail}
                onChange={(e) => setGmail(e.target.value)}
                maxLength={255}
              />
            </Field>
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} />
            </Field>
            <Field label="Website">
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                maxLength={255}
                placeholder="https://…"
              />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function CompanySettingsPage() {
  const company = useCompanyStore((s) => s.company);

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Company"
        title="Company Settings"
        description="Your company's own profile — name, logo and contact details."
      />
      {company ? (
        <CompanySettingsForm company={company} />
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Loading your company…
          </CardContent>
        </Card>
      )}
    </PageTransition>
  );
}
