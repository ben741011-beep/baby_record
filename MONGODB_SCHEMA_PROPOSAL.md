# Baby Record MongoDB Schema Proposal

狀態：待核准；尚未建立 collection、validator、index 或文件。

## 已確認的現況

- Database：`baby_record`
- 現有 collection：`test`
- `test` 文件數：0
- `test` validator：無
- `test` indexes：只有 `_id_`
- 本次不修改或刪除 `test`

## 1. `babyProfiles`

用途：保存這個單一寶寶作息表的寶寶名稱。未來若要支援多寶寶，再以 migration 加入明確的 profile 關聯，不先假設帳號或家庭系統。

| 欄位 | TypeScript | BSON | 必填 | 規則與語意 |
| --- | --- | --- | --- | --- |
| `_id` | `ObjectId` | `objectId` | 是 | MongoDB 產生 |
| `profileKey` | `"default"` | `string` | 是 | 單一寶寶設定的固定商業識別 |
| `name` | `string` | `string` | 是 | trim 後 1–30 字；不可為空字串 |
| `createdAt` | `Date` | `date` | 是 | 文件建立時間，UTC |
| `updatedAt` | `Date` | `date` | 是 | 最後更新時間，UTC |

Indexes：

- `{ profileKey: 1 }`，`unique: true`，確保只有一份 `default` 設定。

範例（僅為 schema 示意，不是實際資料）：

```json
{ "_id": "ObjectId(...)" , "profileKey": "default", "name": "小寶", "createdAt": "Date(...)" , "updatedAt": "Date(...)" }
{ "_id": "ObjectId(...)" , "profileKey": "default", "name": "安安", "createdAt": "Date(...)" , "updatedAt": "Date(...)" }
```

第二筆只示意同一 schema；unique index 不允許兩筆同時存在。

## 2. `recordTypes`

用途：集中管理五個內建類型、自訂類型及顯示／隱藏狀態。

| 欄位 | TypeScript | BSON | 必填 | 規則與語意 |
| --- | --- | --- | --- | --- |
| `_id` | `ObjectId` | `objectId` | 是 | MongoDB 產生 |
| `key` | `string` | `string` | 是 | 內建固定 key 或 `custom_<UUID>` |
| `label` | `string` | `string` | 是 | trim 後 1–20 字 |
| `icon` | `string` | `string` | 是 | 1–16 字的 emoji／顯示文字 |
| `kind` | `RecordKind` | `string` | 是 | `milk`, `sleep`, `diaper`, `pump`, `temperature`, `customTime`, `customRange`, `customInteger`, `customDecimal` |
| `builtIn` | `boolean` | `bool` | 是 | 是否為內建類型 |
| `isVisible` | `boolean` | `bool` | 是 | 內建與自訂類型目前是否顯示 |
| `sortOrder` | `number` | `int` | 是 | 非負整數，控制按鈕順序 |
| `createdAt` | `Date` | `date` | 是 | 文件建立時間，UTC |
| `updatedAt` | `Date` | `date` | 是 | 最後更新時間，UTC |

Indexes：

- `{ key: 1 }`，`unique: true`，作為初始化及重跑的 idempotency key。
- `{ isVisible: 1, sortOrder: 1 }`，支援首頁依顯示狀態與順序查詢。

範例：

```json
{ "_id": "ObjectId(...)" , "key": "milk", "label": "喝奶", "icon": "🍼", "kind": "milk", "builtIn": true, "isVisible": true, "sortOrder": 10, "createdAt": "Date(...)" , "updatedAt": "Date(...)" }
{ "_id": "ObjectId(...)" , "key": "custom_<UUID>", "label": "洗澡", "icon": "🛁", "kind": "customTime", "builtIn": false, "isVisible": true, "sortOrder": 60, "createdAt": "Date(...)" , "updatedAt": "Date(...)" }
```

## 3. `babyRecords`

用途：保存喝奶、睡覺、尿布、擠奶、體溫及自訂類型紀錄。每筆紀錄都有 `_id`，更新或刪除只用 `_id`，避免同分鐘多筆資料誤刪。

| 欄位 | TypeScript | BSON | 必填 | 規則與語意 |
| --- | --- | --- | --- | --- |
| `_id` | `ObjectId` | `objectId` | 是 | MongoDB 產生 |
| `recordTypeId` | `ObjectId` | `objectId` | 是 | 對應 `recordTypes._id` |
| `kind` | `RecordKind` | `string` | 是 | 建立時保存的類型快照，方便驗證與顯示 |
| `startedAt` | `Date` | `date` | 是 | 作息事件時間，UTC；前端以 Asia/Taipei 顯示 |
| `endedAt` | `Date` | `date` | 否 | 只有睡眠／區間類型使用；缺少代表進行中，不使用 `null` |
| `category` | `string` | `string` | 否 | 母奶／配方奶、小便／大便／兩者、左側／右側／兩側 |
| `value` | `number` | `int` 或 `double` | 否 | 奶量、體溫、自訂數量／數值；`0` 是有效值，不等同缺少 |
| `unit` | `string` | `string` | 否 | `ml`, `°C`, `count` 等；沒有單位時省略 |
| `note` | `string` | `string` | 是 | 無備註時使用空字串，最多 500 字 |
| `createdAt` | `Date` | `date` | 是 | 文件建立時間，UTC |
| `updatedAt` | `Date` | `date` | 是 | 最後更新時間，UTC |

`durationMinutes` 不保存，從 `startedAt` 與 `endedAt` 即時計算，避免衍生值與時間欄位不一致。

Indexes：

- `{ startedAt: -1 }`，支援指定日期範圍與時間軸倒序查詢。
- `{ recordTypeId: 1, startedAt: -1 }`，支援每日各類型統計與查詢。

範例：

```json
{ "_id": "ObjectId(...)" , "recordTypeId": "ObjectId(...)" , "kind": "milk", "startedAt": "Date(...)" , "category": "母奶", "value": 120, "unit": "ml", "note": "", "createdAt": "Date(...)" , "updatedAt": "Date(...)" }
{ "_id": "ObjectId(...)" , "recordTypeId": "ObjectId(...)" , "kind": "sleep", "startedAt": "Date(...)" , "endedAt": "Date(...)" , "note": "午睡", "createdAt": "Date(...)" , "updatedAt": "Date(...)" }
```

## Validator 與資料規則

- 三個 collection 都使用 `$jsonSchema`、`validationLevel: "strict"`、`validationAction: "error"`。
- `additionalProperties: false`，但允許 MongoDB `_id`。
- API runtime validation、TypeScript types、serializer 與 MongoDB validator 由根目錄 `models/` 內各 collection 的獨立 PascalCase 檔案統一定義。
- Route handlers 只處理 HTTP request/response 與 status code，不重複 schema。
- 所有日期由伺服器解析為 UTC `Date`；日期篩選以 Asia/Taipei 的日界線轉換為 UTC range。
- 沒有登入需求，因此本版不虛構 `userId` 或帳號 collection；也不宣稱具備多租戶隔離。

## 初次 schema mutation 提案

預計建立：

- `babyProfiles`：strict/error validator + 1 個 custom unique index。
- `recordTypes`：strict/error validator + 2 個 custom indexes。
- `babyRecords`：strict/error validator + 2 個 custom indexes。
- `test`：不修改。

Schema-only 階段預期文件變化：全部 0。

## 第一批受控寫入提案

只在 schema 建立與回讀驗證成功後執行：

- `recordTypes` 新增 5 筆：`milk`, `sleep`, `diaper`, `pump`, `temperature`。
- 預期 inserts：5；updates：0；deletes：0。
- `babyProfiles`：0；等使用者第一次設定名稱時才透過 API 建立。
- `babyRecords`：0；等使用者從 UI 建立第一筆紀錄。
- idempotency：以 unique `key` 搭配 `$setOnInsert`；相同初始化重跑時不新增重複資料，也不覆寫既有設定。
- 寫入後逐筆以 `_id` 查回五筆內建類型，回報 inserted／modified／skipped／failed／deleted 與最終 count。

## 保存、文件大小與未來 migration

- 這些是個人／家庭作息與健康相關資料，不設定 TTL，除非未來另行核准保存期限。
- 每個事件獨立成一份文件，避免單一寶寶文件持續增長並接近 MongoDB 16 MB 限制。
- `babyRecords.kind` 是建立當時的類型快照；日後修改顯示名稱不會改寫歷史紀錄。
- 未來若加入登入或多寶寶，需另提 migration：新增 owner/profile 關聯、回填既有文件、調整 compound indexes，不能只在 UI 增加切換器。
