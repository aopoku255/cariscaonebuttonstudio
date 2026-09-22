"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { CustomerType } from "@/generated/prisma/enums";
import { updateCustomer } from "@/app/admin/(dashboard)/customers/actions";
import { CUSTOMER_TYPE_OPTIONS } from "@/lib/customer-types";

export function CustomerEditor({
  customerId,
  name,
  phone,
  organisation,
  userType,
  isVerified,
  notes,
}: {
  customerId: string;
  name: string;
  phone: string;
  organisation: string;
  userType: CustomerType;
  isVerified: boolean;
  notes: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState({ name, phone, organisation, userType, isVerified, notes });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function handleSave() {
    setSaving(true);
    setErrors({});
    const result = await updateCustomer({ customerId, ...form });
    setSaving(false);

    if (result.ok) {
      toast.success("Saved", result.message);
      router.refresh();
    } else {
      setErrors(result.errors ?? {});
      toast.error("Could not save", result.message);
    }
  }

  return (
    <Card>
      <CardHeader title="Edit customer" />
      <CardBody className="space-y-4">
        <Field label="Full name" required error={errors.name}>
          {(props) => (
            <Input
              {...props}
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              invalid={Boolean(errors.name)}
            />
          )}
        </Field>

        <Field label="Phone" required error={errors.phone}>
          {(props) => (
            <Input
              {...props}
              value={form.phone}
              onChange={(event) => set("phone", event.target.value)}
              invalid={Boolean(errors.phone)}
            />
          )}
        </Field>

        <Field label="Organisation" error={errors.organisation}>
          {(props) => (
            <Input
              {...props}
              value={form.organisation}
              onChange={(event) => set("organisation", event.target.value)}
            />
          )}
        </Field>

        <Field label="Customer type" error={errors.userType}>
          {(props) => (
            <Select
              {...props}
              value={form.userType}
              onChange={(event) => set("userType", event.target.value as CustomerType)}
            >
              {CUSTOMER_TYPE_OPTIONS.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Checkbox
          label="Verified"
          description="Unlocks discounts and Student Studio pricing that require proof of status (KNUST email, student ID or research affiliation)."
          checked={form.isVerified}
          onChange={(event) => set("isVerified", event.target.checked)}
        />

        <Field label="Internal notes" error={errors.notes}>
          {(props) => (
            <Textarea
              {...props}
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              rows={4}
              placeholder="Anything the team should know about this customer."
            />
          )}
        </Field>
      </CardBody>
      <CardFooter>
        <Button onClick={handleSave} loading={saving}>
          Save changes
        </Button>
      </CardFooter>
    </Card>
  );
}
