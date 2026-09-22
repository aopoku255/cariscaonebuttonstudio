"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { MobileRowCard, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { AdminRole } from "@/generated/prisma/enums";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import {
  deleteAdminUser,
  saveAdminUser,
} from "@/app/admin/(dashboard)/team/actions";
import { formatDateTime } from "@/lib/booking/time";

interface AdminRow {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  isSelf: boolean;
}

export function TeamManager({ users }: { users: AdminRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [editing, setEditing] = useState<AdminRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: AdminRole.STAFF as string,
    password: "",
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminRow | null>(null);

  const open = creating || editing !== null;

  function openCreate() {
    setForm({ name: "", email: "", role: AdminRole.STAFF, password: "", isActive: true });
    setErrors({});
    setCreating(true);
    setEditing(null);
  }

  function openEdit(user: AdminRow) {
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      password: "",
      isActive: user.isActive,
    });
    setErrors({});
    setEditing(user);
    setCreating(false);
  }

  async function handleSave() {
    setSaving(true);
    setErrors({});
    const result = await saveAdminUser(editing?.id ?? null, form);
    setSaving(false);

    if (result.ok) {
      toast.success(result.message ?? "Saved");
      setCreating(false);
      setEditing(null);
      router.refresh();
    } else {
      setErrors(result.errors ?? {});
      toast.error("Could not save", result.message);
    }
  }

  function handleDelete() {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    startTransition(async () => {
      const result = await deleteAdminUser(target.id);
      if (result.ok) {
        toast.success("Removed", result.message);
        router.refresh();
      } else {
        toast.error("Could not remove", result.message);
      }
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          New admin
        </Button>
      </div>

      <div className="hidden rounded-xl border border-line bg-surface md:block">
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Last signed in</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <Tr key={user.id}>
                  <Td>
                    <span className="font-semibold text-ink">{user.name}</span>
                    {user.isSelf ? (
                      <Badge tone="brand" className="ml-2">
                        You
                      </Badge>
                    ) : null}
                  </Td>
                  <Td>{user.email}</Td>
                  <Td>{ROLE_LABELS[user.role]}</Td>
                  <Td>
                    {user.lastLoginAt ? (
                      formatDateTime(new Date(user.lastLoginAt))
                    ) : (
                      <span className="text-muted">Never</span>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={user.isActive ? "success" : "neutral"}>
                      {user.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-paper-deep hover:text-ink"
                        aria-label={`Edit ${user.name}`}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      {!user.isSelf ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(user)}
                          disabled={pending}
                          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger-50 hover:text-danger-700 disabled:opacity-40"
                          aria-label={`Remove ${user.name}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
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
        {users.map((user) => (
          <MobileRowCard
            key={user.id}
            title={user.name}
            subtitle={user.email}
            badges={
              <Badge tone={user.isActive ? "success" : "neutral"}>
                {user.isActive ? "Active" : "Disabled"}
              </Badge>
            }
            rows={[
              { label: "Role", value: ROLE_LABELS[user.role] },
              {
                label: "Last signed in",
                value: user.lastLoginAt ? formatDateTime(new Date(user.lastLoginAt)) : "Never",
              },
            ]}
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(user)}>
                  Edit
                </Button>
                {!user.isSelf ? (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(user)}>
                    Remove
                  </Button>
                ) : null}
              </div>
            }
          />
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : "New admin"}
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? "Save changes" : "Create admin"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full name" required error={errors.name}>
            {(props) => (
              <Input
                {...props}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                invalid={Boolean(errors.name)}
              />
            )}
          </Field>

          <Field label="Email address" required error={errors.email}>
            {(props) => (
              <Input
                {...props}
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                invalid={Boolean(errors.email)}
                autoComplete="off"
              />
            )}
          </Field>

          <Field label="Role" required error={errors.role}>
            {(props) => (
              <Select
                {...props}
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
              >
                {Object.values(AdminRole).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label={editing ? "New password" : "Password"}
            required={!editing}
            error={errors.password}
            description={
              editing
                ? "Leave blank to keep the current password. Changing it signs them out everywhere."
                : "At least 10 characters, with upper and lower case letters and a number."
            }
          >
            {(props) => (
              <Input
                {...props}
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                invalid={Boolean(errors.password)}
                autoComplete="new-password"
              />
            )}
          </Field>

          <Checkbox
            label="Active"
            description="Disabled accounts cannot sign in and are signed out immediately."
            checked={form.isActive}
            onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
          />
        </div>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={`Remove ${confirmDelete?.name}?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Remove admin
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-soft">
          They will lose access immediately. Bookings they created keep their history, and
          the audit log keeps a record of what they did.
        </p>
      </Modal>
    </>
  );
}
