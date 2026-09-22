"use client";

import { CalendarOff, Clock, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  addBlockedDate,
  addBlockedTime,
  removeBlockedDate,
  removeBlockedTime,
  saveOperatingHours,
} from "@/app/admin/(dashboard)/availability/actions";
import { formatLongDate, parseDateKey } from "@/lib/booking/time";

interface DayRow {
  dayOfWeek: number;
  name: string;
  isOpen: boolean;
  open: string;
  close: string;
}

interface BlockedDateRow {
  id: string;
  date: string;
  reason: string;
  type: string;
}

interface BlockedTimeRow {
  id: string;
  date: string;
  start: string;
  end: string;
  reason: string;
  type: string;
}

const BLOCK_TYPES = [
  { value: "HOLIDAY", label: "Holiday" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "INTERNAL_EVENT", label: "CARISCA internal event" },
  { value: "PRIVATE_EVENT", label: "Private event" },
  { value: "OTHER", label: "Other" },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  BLOCK_TYPES.map((type) => [type.value, type.label]),
);

export function AvailabilityManager({
  days,
  blockedDates,
  blockedTimes,
}: {
  days: DayRow[];
  blockedDates: BlockedDateRow[];
  blockedTimes: BlockedTimeRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [hours, setHours] = useState(days);
  const [savingHours, setSavingHours] = useState(false);

  const [dateModal, setDateModal] = useState(false);
  const [timeModal, setTimeModal] = useState(false);
  const [dateForm, setDateForm] = useState({ date: "", reason: "", type: "OTHER" });
  const [timeForm, setTimeForm] = useState({
    date: "",
    start: "14:00",
    end: "16:00",
    reason: "",
    type: "INTERNAL_EVENT",
  });
  const [saving, setSaving] = useState(false);

  const hoursChanged = JSON.stringify(hours) !== JSON.stringify(days);

  function updateDay(dayOfWeek: number, changes: Partial<DayRow>) {
    setHours((current) =>
      current.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...changes } : day)),
    );
  }

  async function handleSaveHours() {
    setSavingHours(true);
    const result = await saveOperatingHours({
      days: hours.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        isOpen: day.isOpen,
        open: day.open,
        close: day.close,
      })),
    });
    setSavingHours(false);

    if (result.ok) {
      toast.success("Saved", result.message);
      router.refresh();
    } else {
      toast.error("Could not save", result.message);
    }
  }

  async function handleAddDate() {
    setSaving(true);
    const result = await addBlockedDate(dateForm);
    setSaving(false);

    if (result.ok) {
      toast.success("Date blocked", result.message);
      setDateModal(false);
      setDateForm({ date: "", reason: "", type: "OTHER" });
      router.refresh();
    } else {
      toast.error("Could not block that date", result.message);
    }
  }

  async function handleAddTime() {
    setSaving(true);
    const result = await addBlockedTime(timeForm);
    setSaving(false);

    if (result.ok) {
      toast.success("Time blocked", result.message);
      setTimeModal(false);
      setTimeForm({ date: "", start: "14:00", end: "16:00", reason: "", type: "INTERNAL_EVENT" });
      router.refresh();
    } else {
      toast.error("Could not block that time", result.message);
    }
  }

  function handleRemove(kind: "date" | "time", id: string) {
    startTransition(async () => {
      const result = kind === "date" ? await removeBlockedDate(id) : await removeBlockedTime(id);
      if (result.ok) {
        toast.success("Removed", result.message);
        router.refresh();
      } else {
        toast.error("Could not remove", result.message);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Operating hours */}
      <Card>
        <CardHeader
          title="Operating hours"
          description="The window the booking calendar offers slots within, for each day of the week."
        />
        <CardBody className="space-y-3">
          {hours.map((day) => (
            <div
              key={day.dayOfWeek}
              className="flex flex-col gap-3 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="sm:w-36">
                <Checkbox
                  label={day.name}
                  checked={day.isOpen}
                  onChange={(event) => updateDay(day.dayOfWeek, { isOpen: event.target.checked })}
                />
              </div>

              {day.isOpen ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    type="time"
                    step={1800}
                    value={day.open}
                    onChange={(event) => updateDay(day.dayOfWeek, { open: event.target.value })}
                    className="w-32"
                    aria-label={`${day.name} opening time`}
                  />
                  <span className="text-[13px] text-muted">to</span>
                  <Input
                    type="time"
                    step={1800}
                    value={day.close}
                    onChange={(event) => updateDay(day.dayOfWeek, { close: event.target.value })}
                    className="w-32"
                    aria-label={`${day.name} closing time`}
                  />
                </div>
              ) : (
                <p className="flex-1 text-[13.5px] text-muted">Closed</p>
              )}
            </div>
          ))}
        </CardBody>
        <CardFooter>
          <Button onClick={handleSaveHours} loading={savingHours} disabled={!hoursChanged}>
            Save opening hours
          </Button>
        </CardFooter>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Blocked dates */}
        <Card>
          <CardHeader
            title="Blocked dates"
            description="Whole days the studio is unavailable."
            action={
              <Button size="sm" variant="outline" onClick={() => setDateModal(true)}>
                <Plus className="size-4" aria-hidden />
                Block a date
              </Button>
            }
          />
          <CardBody className="p-0">
            {blockedDates.length === 0 ? (
              <EmptyState
                className="m-4 border-0 bg-transparent py-8"
                icon={<CalendarOff className="size-5" aria-hidden />}
                title="No blocked dates"
                description="Holidays, maintenance days and internal events go here."
              />
            ) : (
              <ul className="divide-y divide-line">
                {blockedDates.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-ink">
                        {formatLongDate(parseDateKey(entry.date)!)}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-muted">{entry.reason}</p>
                      <Badge tone="neutral" className="mt-1.5">
                        {TYPE_LABELS[entry.type] ?? entry.type}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove("date", entry.id)}
                      disabled={pending}
                      className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-danger-50 hover:text-danger-700 disabled:opacity-40"
                      aria-label={`Unblock ${entry.date}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Blocked times */}
        <Card>
          <CardHeader
            title="Blocked times"
            description="Specific hours within a day."
            action={
              <Button size="sm" variant="outline" onClick={() => setTimeModal(true)}>
                <Plus className="size-4" aria-hidden />
                Block a time
              </Button>
            }
          />
          <CardBody className="p-0">
            {blockedTimes.length === 0 ? (
              <EmptyState
                className="m-4 border-0 bg-transparent py-8"
                icon={<Clock className="size-5" aria-hidden />}
                title="No blocked times"
                description="Use this for a meeting or event that takes part of a day."
              />
            ) : (
              <ul className="divide-y divide-line">
                {blockedTimes.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-ink">
                        {formatLongDate(parseDateKey(entry.date)!)}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-ink-soft">
                        {entry.start} – {entry.end}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-muted">{entry.reason}</p>
                      <Badge tone="neutral" className="mt-1.5">
                        {TYPE_LABELS[entry.type] ?? entry.type}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove("time", entry.id)}
                      disabled={pending}
                      className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-danger-50 hover:text-danger-700 disabled:opacity-40"
                      aria-label={`Unblock ${entry.date} ${entry.start}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Block a date */}
      <Modal
        open={dateModal}
        onClose={() => setDateModal(false)}
        title="Block a date"
        description="The studio will show as unavailable for the whole day."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDateModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAddDate} loading={saving}>
              Block date
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Date" required>
            {(props) => (
              <Input
                {...props}
                type="date"
                value={dateForm.date}
                onChange={(event) => setDateForm({ ...dateForm, date: event.target.value })}
              />
            )}
          </Field>
          <Field label="Reason" required description="Shown to customers on the calendar.">
            {(props) => (
              <Input
                {...props}
                value={dateForm.reason}
                onChange={(event) => setDateForm({ ...dateForm, reason: event.target.value })}
                placeholder="CARISCA Internal Event"
              />
            )}
          </Field>
          <Field label="Type">
            {(props) => (
              <Select
                {...props}
                value={dateForm.type}
                onChange={(event) => setDateForm({ ...dateForm, type: event.target.value })}
              >
                {BLOCK_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Modal>

      {/* Block a time */}
      <Modal
        open={timeModal}
        onClose={() => setTimeModal(false)}
        title="Block a time"
        description="Only the hours you choose become unavailable."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTimeModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAddTime} loading={saving}>
              Block time
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Date" required>
            {(props) => (
              <Input
                {...props}
                type="date"
                value={timeForm.date}
                onChange={(event) => setTimeForm({ ...timeForm, date: event.target.value })}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" required>
              {(props) => (
                <Input
                  {...props}
                  type="time"
                  step={1800}
                  value={timeForm.start}
                  onChange={(event) => setTimeForm({ ...timeForm, start: event.target.value })}
                />
              )}
            </Field>
            <Field label="To" required>
              {(props) => (
                <Input
                  {...props}
                  type="time"
                  step={1800}
                  value={timeForm.end}
                  onChange={(event) => setTimeForm({ ...timeForm, end: event.target.value })}
                />
              )}
            </Field>
          </div>
          <Field label="Reason" required>
            {(props) => (
              <Input
                {...props}
                value={timeForm.reason}
                onChange={(event) => setTimeForm({ ...timeForm, reason: event.target.value })}
                placeholder="CARISCA Internal Event"
              />
            )}
          </Field>
          <Field label="Type">
            {(props) => (
              <Select
                {...props}
                value={timeForm.type}
                onChange={(event) => setTimeForm({ ...timeForm, type: event.target.value })}
              >
                {BLOCK_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Modal>
    </div>
  );
}
