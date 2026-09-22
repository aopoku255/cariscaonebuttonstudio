"use client";

import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { MobileRowCard, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/validation/common";
import { cn } from "@/lib/utils";

/**
 * A generic create/edit/enable/delete screen.
 *
 * Add-ons, equipment and FAQs are all "a list of rows with a form behind them", so
 * they share this component rather than three near-identical files. Anything with a
 * genuinely different shape (packages, discounts) has its own screen instead of
 * being forced through here.
 */

export type FieldType =
  | "text"
  | "textarea"
  | "money"
  | "number"
  | "select"
  | "checkbox"
  | "url";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  description?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Full-width in the two-column form grid. */
  wide?: boolean;
  rows?: number;
  /** Hide the field unless the current form state says otherwise. */
  showIf?: (values: Record<string, unknown>) => boolean;
}

export interface ColumnDef<T> {
  label: string;
  render: (row: T) => ReactNode;
  /** Shown in the mobile card as a label/value pair. */
  mobile?: boolean;
  align?: "left" | "right";
}

export interface ResourceManagerProps<T extends { id: string }> {
  rows: T[];
  columns: ColumnDef<T>[];
  fields: FieldDef[];
  /** Build the form values for an existing row. */
  toForm: (row: T) => Record<string, unknown>;
  emptyForm: Record<string, unknown>;
  save: (id: string | null, values: Record<string, unknown>) => Promise<ActionResult<unknown>>;
  remove?: (id: string) => Promise<ActionResult<unknown>>;
  toggle?: (id: string, active: boolean) => Promise<ActionResult<unknown>>;
  isActive?: (row: T) => boolean;
  titleOf: (row: T) => string;
  subtitleOf?: (row: T) => string | null;
  labels: {
    createButton: string;
    createTitle: string;
    editTitle: string;
    emptyTitle: string;
    emptyDescription: string;
    formDescription?: string;
    deleteWarning?: (row: T) => string;
  };
}

export function ResourceManager<T extends { id: string }>({
  rows,
  columns,
  fields,
  toForm,
  emptyForm,
  save,
  remove,
  toggle,
  isActive,
  titleOf,
  subtitleOf,
  labels,
}: ResourceManagerProps<T>) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [editing, setEditing] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<T | null>(null);

  const open = creating || editing !== null;

  function openCreate() {
    setValues(emptyForm);
    setErrors({});
    setCreating(true);
    setEditing(null);
  }

  function openEdit(row: T) {
    setValues(toForm(row));
    setErrors({});
    setEditing(row);
    setCreating(false);
  }

  function close() {
    setCreating(false);
    setEditing(null);
    setErrors({});
  }

  async function handleSave() {
    setSaving(true);
    setErrors({});
    const result = await save(editing?.id ?? null, values);
    setSaving(false);

    if (!result.ok) {
      setErrors(result.errors ?? {});
      toast.error("Could not save", result.message);
      return;
    }

    toast.success(result.message ?? "Saved");
    close();
    router.refresh();
  }

  function handleToggle(row: T) {
    if (!toggle || !isActive) return;
    startTransition(async () => {
      const result = await toggle(row.id, !isActive(row));
      if (result.ok) {
        toast.success(result.message ?? "Updated");
        router.refresh();
      } else {
        toast.error("Could not update", result.message);
      }
    });
  }

  function handleDelete() {
    if (!confirmDelete || !remove) return;
    const target = confirmDelete;
    setConfirmDelete(null);

    startTransition(async () => {
      const result = await remove(target.id);
      if (result.ok) {
        toast.success("Done", result.message);
        router.refresh();
      } else {
        toast.error("Could not delete", result.message);
      }
    });
  }

  const visibleFields = fields.filter((field) => !field.showIf || field.showIf(values));

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate} size="sm">
          <Plus className="size-4" aria-hidden />
          {labels.createButton}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={labels.emptyTitle}
          description={labels.emptyDescription}
          action={<Button onClick={openCreate}>{labels.createButton}</Button>}
        />
      ) : (
        <>
          <div className="hidden rounded-xl border border-line bg-surface md:block">
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <Th
                        key={column.label}
                        className={column.align === "right" ? "text-right" : undefined}
                      >
                        {column.label}
                      </Th>
                    ))}
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <Tr key={row.id}>
                      {columns.map((column) => (
                        <Td
                          key={column.label}
                          className={column.align === "right" ? "text-right" : undefined}
                        >
                          {column.render(row)}
                        </Td>
                      ))}
                      <Td>
                        <div className="flex justify-end gap-1">
                          <IconAction label="Edit" onClick={() => openEdit(row)}>
                            <Pencil className="size-4" aria-hidden />
                          </IconAction>
                          {toggle && isActive ? (
                            <IconAction
                              label={isActive(row) ? "Disable" : "Enable"}
                              onClick={() => handleToggle(row)}
                              disabled={pending}
                            >
                              <Power className="size-4" aria-hidden />
                            </IconAction>
                          ) : null}
                          {remove ? (
                            <IconAction
                              label="Delete"
                              danger
                              onClick={() => setConfirmDelete(row)}
                              disabled={pending}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </IconAction>
                          ) : null}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <MobileRowCard
                key={row.id}
                title={titleOf(row)}
                subtitle={subtitleOf?.(row) ?? undefined}
                badges={
                  isActive ? (
                    <Badge tone={isActive(row) ? "success" : "neutral"}>
                      {isActive(row) ? "Active" : "Disabled"}
                    </Badge>
                  ) : undefined
                }
                rows={columns
                  .filter((column) => column.mobile)
                  .map((column) => ({ label: column.label, value: column.render(row) }))}
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                      Edit
                    </Button>
                    {toggle && isActive ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggle(row)}
                        disabled={pending}
                      >
                        {isActive(row) ? "Disable" : "Enable"}
                      </Button>
                    ) : null}
                    {remove ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(row)}
                        disabled={pending}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                }
              />
            ))}
          </div>
        </>
      )}

      <Modal
        open={open}
        onClose={close}
        title={editing ? labels.editTitle : labels.createTitle}
        description={labels.formDescription}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? "Save changes" : "Create"}
            </Button>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {visibleFields.map((field) => (
            <FormField
              key={field.key}
              field={field}
              value={values[field.key]}
              error={errors[field.key]}
              onChange={(value) =>
                setValues((current) => ({ ...current, [field.key]: value }))
              }
            />
          ))}
        </div>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete ? `Delete "${titleOf(confirmDelete)}"?` : "Delete?"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-soft">
          {confirmDelete && labels.deleteWarning
            ? labels.deleteWarning(confirmDelete)
            : "This cannot be undone."}
        </p>
      </Modal>
    </>
  );
}

function FormField({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const wrapperClass = field.wide ? "sm:col-span-2" : undefined;

  if (field.type === "checkbox") {
    return (
      <div className={cn("sm:col-span-2", wrapperClass)}>
        <Checkbox
          label={field.label}
          description={field.description}
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        {error ? <p className="mt-1 text-[12.5px] text-danger-500">{error}</p> : null}
      </div>
    );
  }

  return (
    <Field
      label={field.label}
      required={field.required}
      description={field.description}
      error={error}
      className={wrapperClass}
    >
      {(props) => {
        if (field.type === "textarea") {
          return (
            <Textarea
              {...props}
              value={String(value ?? "")}
              onChange={(event) => onChange(event.target.value)}
              placeholder={field.placeholder}
              rows={field.rows ?? 3}
              invalid={Boolean(error)}
            />
          );
        }

        if (field.type === "select") {
          return (
            <Select
              {...props}
              value={String(value ?? "")}
              onChange={(event) => onChange(event.target.value)}
              invalid={Boolean(error)}
            >
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          );
        }

        return (
          <Input
            {...props}
            value={String(value ?? "")}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
            invalid={Boolean(error)}
            inputMode={
              field.type === "money" || field.type === "number" ? "decimal" : undefined
            }
            type={field.type === "url" ? "url" : "text"}
          />
        );
      }}
    </Field>
  );
}

function IconAction({
  label,
  onClick,
  children,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "rounded-lg p-1.5 transition-colors disabled:opacity-40",
        danger
          ? "text-muted hover:bg-danger-50 hover:text-danger-700"
          : "text-muted hover:bg-paper-deep hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
