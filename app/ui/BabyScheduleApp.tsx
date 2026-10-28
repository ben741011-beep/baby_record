"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BabyRecordView } from "@/models/BabyRecord";
import type { RecordKind, RecordTypeView } from "@/models/RecordType";

type Modal =
  | { name: "settings" }
  | { name: "manage" }
  | { name: "record"; type: RecordTypeView }
  | { name: "finish"; record: BabyRecordView }
  | null;

const TYPE_ACCENTS: Record<RecordKind, string> = {
  milk: "bg-[#fff0e8] text-[#a44d20]",
  sleep: "bg-[#eef0ff] text-[#5556a8]",
  diaper: "bg-[#e9f8f2] text-[#28745b]",
  pump: "bg-[#fff0f5] text-[#a44468]",
  temperature: "bg-[#fff5dd] text-[#9a6815]",
  customTime: "bg-[#eff7ff] text-[#34658d]",
  customRange: "bg-[#eff7ff] text-[#34658d]",
  customInteger: "bg-[#eff7ff] text-[#34658d]",
  customDecimal: "bg-[#eff7ff] text-[#34658d]",
};

const CUSTOM_TEMPLATES: Array<{
  kind: RecordKind;
  title: string;
  detail: string;
}> = [
  { kind: "customTime", title: "只記時間", detail: "適合洗澡、吃藥" },
  { kind: "customRange", title: "開始／結束", detail: "適合活動或療程" },
  { kind: "customInteger", title: "時間＋整數", detail: "適合次數或顆數" },
  { kind: "customDecimal", title: "時間＋小數", detail: "適合體重或容量" },
];

const EMOJIS = [
  "🛁",
  "💊",
  "🧴",
  "👶",
  "🍎",
  "🥣",
  "💉",
  "🏥",
  "📝",
  "🎵",
  "🌙",
  "🧸",
];

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function todayKey() {
  return dateKey(new Date());
}

function earliestDateKey() {
  const date = new Date();
  date.setMonth(date.getMonth() - 11, 1);
  return dateKey(date);
}

function nowTime() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function displayDate(value: string) {
  const date = parseDateKey(value);
  return {
    eyebrow:
      value === todayKey()
        ? "今天"
        : `${date.getMonth() + 1} 月 ${date.getDate()} 日`,
    title: new Intl.DateTimeFormat("zh-TW", {
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(date),
  };
}

function timeFromIso(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "操作失敗，請稍後再試");
  return data;
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid size-10 place-items-center rounded-full bg-[#f6f3ef] text-xl text-[#6d665e] transition hover:bg-[#ece7e0]"
      aria-label="關閉"
    >
      ×
    </button>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#302a25]/35 p-0 backdrop-blur-[3px] sm:items-center sm:p-6">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[32px] bg-[#fffdf9] shadow-2xl sm:max-w-lg sm:rounded-[32px]">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#eee8e1] bg-[#fffdf9]/95 px-6 py-5 backdrop-blur">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-[#2f2924]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-sm text-[#8d847b]">{subtitle}</p>
            )}
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function BabyScheduleApp() {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [profileName, setProfileName] = useState("");
  const [recordTypes, setRecordTypes] = useState<RecordTypeView[]>([]);
  const [records, setRecords] = useState<BabyRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const loadBaseData = useCallback(async () => {
    const [profileResponse, typesResponse] = await Promise.all([
      fetch("/api/profile", { cache: "no-store" }),
      fetch("/api/record-types", { cache: "no-store" }),
    ]);
    const [{ profile }, { recordTypes: types }] = await Promise.all([
      readJson<{ profile: { name: string } | null }>(profileResponse),
      readJson<{ recordTypes: RecordTypeView[] }>(typesResponse),
    ]);
    setProfileName(profile?.name ?? "");
    setRecordTypes(types);
  }, []);

  const loadRecords = useCallback(async (date: string) => {
    const response = await fetch(`/api/records?date=${date}`, {
      cache: "no-store",
    });
    const data = await readJson<{ records: BabyRecordView[] }>(response);
    setRecords(data.records);
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      Promise.all([loadBaseData(), loadRecords(selectedDate)])
        .catch((error: unknown) => {
          if (active)
            notify(error instanceof Error ? error.message : "載入失敗");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadBaseData, loadRecords, notify, selectedDate]);

  const visibleTypes = useMemo(
    () => recordTypes.filter((type) => type.isVisible),
    [recordTypes],
  );
  const typeById = useMemo(
    () => new Map(recordTypes.map((type) => [type.id, type])),
    [recordTypes],
  );
  const dateLabel = displayDate(selectedDate);

  function shiftDate(direction: number) {
    const date = parseDateKey(selectedDate);
    date.setDate(date.getDate() + direction);
    const next = dateKey(date);
    if (next >= earliestDateKey() && next <= todayKey()) setSelectedDate(next);
  }

  async function refreshAll() {
    await Promise.all([loadBaseData(), loadRecords(selectedDate)]);
  }

  async function removeRecord(record: BabyRecordView) {
    if (!window.confirm("確定刪除這筆紀錄嗎？刪除後無法復原。")) return;
    try {
      const response = await fetch(`/api/records/${record.id}`, {
        method: "DELETE",
      });
      const data = await readJson<{ deletedCount: number }>(response);
      if (data.deletedCount !== 1) throw new Error("未刪除任何紀錄");
      await loadRecords(selectedDate);
      notify("紀錄已刪除");
    } catch (error) {
      notify(error instanceof Error ? error.message : "刪除失敗");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f0e9] text-[#312b26]">
      <div className="mx-auto min-h-screen max-w-6xl bg-[#fbf8f3] shadow-[0_0_80px_rgba(74,58,44,0.08)]">
        <header className="relative overflow-hidden border-b border-[#eae3da] px-5 pb-8 pt-6 sm:px-10 sm:pb-10 sm:pt-9">
          <div className="absolute -right-20 -top-24 size-72 rounded-full bg-[#f8d8c9]/45 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#a4765d]">
                Baby rhythm journal
              </p>
              <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
                {profileName ? `${profileName}的作息` : "寶寶作息日誌"}
              </h1>
              <p className="mt-2 text-sm text-[#8a8179]">
                把每個小日常，安穩地收進一天裡。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModal({ name: "settings" })}
              className="grid size-11 shrink-0 place-items-center rounded-full border border-[#e7ded4] bg-white text-lg shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              aria-label="寶寶名稱設定"
            >
              ⚙
            </button>
          </div>

          <div className="relative mt-8 flex items-center justify-between rounded-2xl border border-[#e9e0d6] bg-white/85 p-2 shadow-sm backdrop-blur sm:max-w-xl">
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              disabled={selectedDate <= earliestDateKey()}
              className="grid size-11 place-items-center rounded-xl text-xl transition hover:bg-[#f6f1eb] disabled:opacity-25"
              aria-label="前一天"
            >
              ‹
            </button>
            <label className="group relative flex flex-1 cursor-pointer flex-col items-center py-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ba8064]">
                {dateLabel.eyebrow}
              </span>
              <span className="mt-0.5 font-serif text-lg font-semibold">
                {dateLabel.title}
              </span>
              <input
                type="date"
                value={selectedDate}
                min={earliestDateKey()}
                max={todayKey()}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="選擇日期"
              />
            </label>
            <button
              type="button"
              onClick={() => shiftDate(1)}
              disabled={selectedDate >= todayKey()}
              className="grid size-11 place-items-center rounded-xl text-xl transition hover:bg-[#f6f1eb] disabled:opacity-25"
              aria-label="後一天"
            >
              ›
            </button>
          </div>
        </header>

        <div className="grid gap-8 px-5 py-8 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="section-kicker">Quick record</p>
                <h2 className="section-title">快速記一筆</h2>
              </div>
              <button
                type="button"
                onClick={() => setModal({ name: "manage" })}
                className="rounded-full border border-[#ded5cb] bg-white px-4 py-2 text-sm font-semibold text-[#6d6259] transition hover:border-[#bdaea0]"
              >
                管理項目
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {visibleTypes.map((type) => (
                <button
                  type="button"
                  key={type.id}
                  onClick={() => setModal({ name: "record", type })}
                  className="group flex min-h-28 flex-col items-center justify-center rounded-3xl border border-white/70 bg-white p-3 shadow-[0_8px_28px_rgba(78,61,47,0.07)] transition hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(78,61,47,0.12)]"
                >
                  <span
                    className={`grid size-12 place-items-center rounded-2xl text-2xl ${TYPE_ACCENTS[type.kind]}`}
                  >
                    {type.icon}
                  </span>
                  <span className="mt-2 text-sm font-bold">{type.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setModal({ name: "manage" })}
                className="flex min-h-28 flex-col items-center justify-center rounded-3xl border border-dashed border-[#d8ccc0] p-3 text-[#8b7f74] transition hover:border-[#bfa895] hover:bg-white/60"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-[#efe8e0] text-2xl">
                  ＋
                </span>
                <span className="mt-2 text-sm font-bold">新增項目</span>
              </button>
            </div>

            <div className="mt-8 rounded-[28px] border border-[#eadfd3] bg-[#fffaf4] p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="section-kicker">Daily overview</p>
                  <h2 className="section-title">每日摘要</h2>
                </div>
                <span className="rounded-full bg-[#f0e5da] px-3 py-1 text-xs font-bold text-[#8c654f]">
                  共 {records.length} 筆
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                {visibleTypes.map((type) => {
                  const count = records.filter(
                    (record) => record.recordTypeId === type.id,
                  ).length;
                  return (
                    <div
                      key={type.id}
                      className="flex items-center gap-3 rounded-2xl bg-white/75 p-3"
                    >
                      <span className="text-xl">{type.icon}</span>
                      <div>
                        <p className="text-xl font-bold tabular-nums">{count}</p>
                        <p className="text-xs text-[#92877d]">
                          次{type.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4">
              <p className="section-kicker">Today&apos;s timeline</p>
              <h2 className="section-title">當日時間軸</h2>
            </div>
            <div className="rounded-[28px] border border-[#e9e1d8] bg-white p-5 shadow-[0_12px_40px_rgba(78,61,47,0.06)] sm:p-6">
              {loading ? (
                <div className="space-y-4 py-4">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-20 animate-pulse rounded-2xl bg-[#f4f0eb]"
                    />
                  ))}
                </div>
              ) : records.length === 0 ? (
                <div className="flex min-h-80 flex-col items-center justify-center text-center">
                  <div className="grid size-20 place-items-center rounded-full bg-[#f7f0e8] text-4xl">
                    🧸
                  </div>
                  <h3 className="mt-5 font-serif text-xl font-semibold">
                    這一天還很安靜
                  </h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-[#93887e]">
                    從左邊選一個項目，記下寶寶今天的第一個小片段。
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute bottom-5 left-[52px] top-5 w-px bg-[#eadfd5]" />
                  <div className="space-y-2">
                    {records.map((record) => (
                      <TimelineItem
                        key={record.id}
                        record={record}
                        type={typeById.get(record.recordTypeId)}
                        onFinish={() =>
                          setModal({ name: "finish", record })
                        }
                        onDelete={() => void removeRecord(record)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {modal?.name === "settings" && (
        <SettingsModal
          currentName={profileName}
          onClose={() => setModal(null)}
          onSaved={async () => {
            await loadBaseData();
            setModal(null);
            notify("寶寶名稱已儲存");
          }}
        />
      )}
      {modal?.name === "manage" && (
        <ManageTypesModal
          types={recordTypes}
          onClose={() => setModal(null)}
          onChanged={async (message) => {
            await refreshAll();
            notify(message);
          }}
        />
      )}
      {modal?.name === "record" && (
        <RecordModal
          type={modal.type}
          date={selectedDate}
          onClose={() => setModal(null)}
          onSaved={async () => {
            await loadRecords(selectedDate);
            setModal(null);
            notify("已加入當日時間軸");
          }}
        />
      )}
      {modal?.name === "finish" && (
        <FinishModal
          record={modal.record}
          onClose={() => setModal(null)}
          onSaved={async () => {
            await loadRecords(selectedDate);
            setModal(null);
            notify("睡眠時間已完成");
          }}
        />
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-[#342e29] px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}
    </main>
  );
}

function TimelineItem({
  record,
  type,
  onFinish,
  onDelete,
}: {
  record: BabyRecordView;
  type?: RecordTypeView;
  onFinish: () => void;
  onDelete: () => void;
}) {
  const isRange = record.kind === "sleep" || record.kind === "customRange";
  const detail = (() => {
    if (record.kind === "milk")
      return `${record.category} · ${record.value ?? 0} ml`;
    if (record.kind === "sleep" || record.kind === "customRange") {
      return record.endedAt
        ? `${timeFromIso(record.startedAt)}–${timeFromIso(record.endedAt)} · ${record.durationMinutes} 分鐘`
        : "進行中";
    }
    if (record.kind === "diaper") return record.category;
    if (record.kind === "pump")
      return `${record.category} · ${record.value ?? 0} ml`;
    if (record.kind === "temperature")
      return `${record.value} °C${(record.value ?? 0) >= 37.5 ? " · 請留意" : ""}`;
    if (record.kind === "customInteger") return `${record.value ?? 0} 次`;
    if (record.kind === "customDecimal") return `${record.value ?? 0}`;
    return "已記錄";
  })();

  return (
    <div className="relative flex gap-4 rounded-2xl p-3 transition hover:bg-[#faf7f3]">
      <div className="w-10 shrink-0 pt-1 text-right text-sm font-bold tabular-nums text-[#776c63]">
        {timeFromIso(record.startedAt)}
      </div>
      <div
        className={`relative z-[1] grid size-10 shrink-0 place-items-center rounded-full text-lg ${TYPE_ACCENTS[record.kind]}`}
      >
        {type?.icon ?? "•"}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold">{type?.label ?? "已隱藏項目"}</p>
            <p
              className={`mt-0.5 text-sm ${
                (record.value ?? 0) >= 37.5 &&
                record.kind === "temperature"
                  ? "font-semibold text-[#b14b43]"
                  : "text-[#766d65]"
              }`}
            >
              {detail}
            </p>
            {record.note && (
              <p className="mt-1 text-xs leading-5 text-[#9a9087]">
                {record.note}
              </p>
            )}
          </div>
          <div className="flex gap-1">
            {isRange && !record.endedAt && (
              <button
                type="button"
                onClick={onFinish}
                className="rounded-full bg-[#e9a36e] px-3 py-1.5 text-xs font-bold text-white"
              >
                結束
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="grid size-8 place-items-center rounded-full text-sm text-[#a79c92] hover:bg-[#f5e9e6] hover:text-[#b64f48]"
              aria-label="刪除紀錄"
            >
              ♡
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({
  currentName,
  onClose,
  onSaved,
}: {
  currentName: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await readJson(
        await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }),
      );
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="寶寶名稱"
      subtitle="這個名稱會顯示在作息日誌首頁"
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="field-label">名稱</span>
          <input
            className="field-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={30}
            placeholder="例如：小寶"
            autoFocus
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button disabled={saving} className="primary-button">
          {saving ? "儲存中…" : "儲存名稱"}
        </button>
      </form>
    </ModalShell>
  );
}

function ManageTypesModal({
  types,
  onClose,
  onChanged,
}: {
  types: RecordTypeView[];
  onClose: () => void;
  onChanged: (message: string) => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState(EMOJIS[0]);
  const [kind, setKind] = useState<RecordKind>("customTime");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle(type: RecordTypeView) {
    try {
      await readJson(
        await fetch(`/api/record-types/${type.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isVisible: !type.isVisible }),
        }),
      );
      await onChanged(
        type.isVisible ? `已隱藏「${type.label}」` : `已顯示「${type.label}」`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新失敗");
    }
  }

  async function addType(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await readJson(
        await fetch("/api/record-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, icon, kind }),
        }),
      );
      setLabel("");
      setShowAdd(false);
      await onChanged(`已新增「${label.trim()}」`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "新增失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="管理記錄項目"
      subtitle="保留真正需要的，讓每次記錄更俐落"
      onClose={onClose}
    >
      <div className="space-y-3">
        {types.map((type) => (
          <div
            key={type.id}
            className="flex items-center gap-3 rounded-2xl border border-[#ece5de] bg-white p-3"
          >
            <span
              className={`grid size-11 place-items-center rounded-xl text-xl ${TYPE_ACCENTS[type.kind]}`}
            >
              {type.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{type.label}</p>
              <p className="text-xs text-[#978d84]">
                {type.builtIn ? "內建項目" : "自訂項目"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void toggle(type)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                type.isVisible
                  ? "bg-[#edf6f1] text-[#36735c]"
                  : "bg-[#f1eeea] text-[#8d847c]"
              }`}
            >
              {type.isVisible ? "顯示中" : "已隱藏"}
            </button>
          </div>
        ))}
      </div>

      {!showAdd ? (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="mt-5 w-full rounded-2xl border border-dashed border-[#cfbdae] py-4 font-bold text-[#8a6552] hover:bg-[#fbf5ef]"
        >
          ＋ 新增自訂項目
        </button>
      ) : (
        <form
          onSubmit={addType}
          className="mt-6 space-y-5 border-t border-[#e9e1d9] pt-6"
        >
          <label className="block">
            <span className="field-label">項目名稱</span>
            <input
              className="field-input"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={20}
              placeholder="例如：洗澡、吃藥"
              autoFocus
            />
          </label>
          <fieldset>
            <legend className="field-label">圖示</legend>
            <div className="grid grid-cols-6 gap-2">
              {EMOJIS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`grid aspect-square place-items-center rounded-xl text-xl ${
                    icon === emoji
                      ? "bg-[#ead8ca] ring-2 ring-[#b98669]"
                      : "bg-[#f6f2ed]"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="field-label">欄位模板</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {CUSTOM_TEMPLATES.map((template) => (
                <button
                  type="button"
                  key={template.kind}
                  onClick={() => setKind(template.kind)}
                  className={`rounded-2xl border p-3 text-left ${
                    kind === template.kind
                      ? "border-[#b77c5e] bg-[#fcf1e9]"
                      : "border-[#e6ded6] bg-white"
                  }`}
                >
                  <span className="block text-sm font-bold">
                    {template.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#938981]">
                    {template.detail}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          {error && <p className="form-error">{error}</p>}
          <button disabled={saving} className="primary-button">
            {saving ? "新增中…" : "新增項目"}
          </button>
        </form>
      )}
      {error && !showAdd && <p className="form-error mt-4">{error}</p>}
    </ModalShell>
  );
}

function RecordModal({
  type,
  date,
  onClose,
  onSaved,
}: {
  type: RecordTypeView;
  date: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [time, setTime] = useState(nowTime());
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState(
    type.kind === "milk" ? "母奶" : type.kind === "diaper" ? "兩者" : "兩側",
  );
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const categories =
    type.kind === "milk"
      ? ["母奶", "配方奶"]
      : type.kind === "diaper"
        ? ["小便", "大便", "兩者"]
        : type.kind === "pump"
          ? ["左側", "右側", "兩側"]
          : [];
  const needsValue = [
    "milk",
    "pump",
    "temperature",
    "customInteger",
    "customDecimal",
  ].includes(type.kind);
  const isRange = type.kind === "sleep" || type.kind === "customRange";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await readJson(
        await fetch("/api/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recordTypeId: type.id,
            date,
            time,
            endTime: endTime || undefined,
            category: categories.length ? category : undefined,
            value: value === "" ? undefined : Number(value),
            note,
          }),
        }),
      );
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "新增失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={`${type.icon} 記錄${type.label}`}
      subtitle={displayDate(date).title}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <div className={isRange ? "grid grid-cols-2 gap-3" : ""}>
          <label className="block">
            <span className="field-label">
              {isRange ? "開始時間" : "時間"}
            </span>
            <input
              type="time"
              className="field-input"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required
            />
          </label>
          {isRange && (
            <label className="block">
              <span className="field-label">結束時間</span>
              <input
                type="time"
                className="field-input"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
              <span className="mt-1 block text-xs text-[#9a9087]">
                進行中可留空
              </span>
            </label>
          )}
        </div>
        {categories.length > 0 && (
          <fieldset>
            <legend className="field-label">
              {type.kind === "pump" ? "側別" : "類型"}
            </legend>
            <div className="flex gap-2">
              {categories.map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => setCategory(option)}
                  className={`flex-1 rounded-xl border px-3 py-3 text-sm font-bold ${
                    category === option
                      ? "border-[#b87d5e] bg-[#faeee5] text-[#8f5538]"
                      : "border-[#e5ddd5] bg-white text-[#796f66]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {needsValue && (
          <label className="block">
            <span className="field-label">
              {type.kind === "temperature"
                ? "體溫（°C）"
                : type.kind === "customDecimal"
                  ? "數值"
                  : type.kind === "customInteger"
                    ? "數量"
                    : "奶量（ml）"}
            </span>
            <input
              type="number"
              min={type.kind === "temperature" ? 30 : 0}
              max={type.kind === "temperature" ? 45 : undefined}
              step={
                ["temperature", "customDecimal"].includes(type.kind)
                  ? "0.1"
                  : "1"
              }
              className="field-input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={type.kind === "temperature" ? "36.8" : "0"}
              required
            />
          </label>
        )}
        <label className="block">
          <span className="field-label">備註</span>
          <textarea
            className="field-input min-h-24 resize-none"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder="選填，記下當下的小細節"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button disabled={saving} className="primary-button">
          {saving ? "儲存中…" : "儲存紀錄"}
        </button>
      </form>
    </ModalShell>
  );
}

function FinishModal({
  record,
  onClose,
  onSaved,
}: {
  record: BabyRecordView;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [endTime, setEndTime] = useState(nowTime());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await readJson(
        await fetch(`/api/records/${record.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endTime }),
        }),
      );
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="結束這段睡眠"
      subtitle={`開始於 ${timeFromIso(record.startedAt)}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="field-label">結束時間</span>
          <input
            type="time"
            className="field-input"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            required
            autoFocus
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button disabled={saving} className="primary-button">
          {saving ? "更新中…" : "確認結束"}
        </button>
      </form>
    </ModalShell>
  );
}
