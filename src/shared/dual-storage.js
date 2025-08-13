/*/
同時儲存到 chrome.storage.local 與 chrome.storage.sync 的工具
 1. 支援資料「分片」（避免單一項超過 sync 每鍵 8KB 上限）
 2. 大內容會產生「影子」版本（截短 content），避免 sync 寫入失敗
 3. 新舊資料合併（保留較新版本、hashtags 聯集）
 4. 寫入時有 debounce + 指數退避，避免短時間內觸發同步速率限制
/*/

// ---- 常數設定 ----
const SYNC_BYTES_PER_ITEM = 8192; // sync 單鍵最大容量
const SYNC_SOFT_LIMIT = 7000; // 分片時的容量軟限制（留安全空間）
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 墓碑（deleted=true）保留 30 天
const MAX_SYNC_CONTENT_CHARS = 512; // sync 影子內容的最大字元數
const WRITE_DEBOUNCE_MS = 1200; // 最短寫入間隔（毫秒）
const MAX_BACKOFF_MS = 15000; // 退避延遲上限（毫秒）

// ---- 工具函式 ----
// 計算物件序列化後的位元組大小
function sizeBytes(obj) {
  return new Blob([JSON.stringify(obj)]).size;
}
// 生成分片索引 key
function idxKey(prefix) {
  return `${prefix}::idx`;
}
// 生成分片資料 key
function shardKey(prefix, i) {
  return `${prefix}::${i}`;
}
// 判斷是否為同步速率限制錯誤
function isRateLimitError(e) {
  return /MAX_WRITE_OPERATIONS_PER_MINUTE/i.test(String(e?.message || e));
}

// 補齊書籤物件缺少的欄位（預設值）
function withDefaults(item) {
  return {
    id: item.id,
    content: item.content ?? "",
    role: item.role ?? "unknown",
    hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
    deleted: !!item.deleted,
    updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : 0,
    createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
    __shadow: !!item.__shadow,
  };
}

// 生成 sync 的影子（縮短 content）
function toShadow(item) {
  const it = withDefaults(item);
  return {
    ...it,
    content: (it.content || "").slice(0, MAX_SYNC_CONTENT_CHARS),
    __shadow: true,
  };
}

// 從兩份資料取較長的 content（避免影子蓋掉完整內容）
function takeRicherContent(base, other) {
  const bc = (base.content || "").length;
  const oc = (other.content || "").length;
  if (oc > bc) base.content = other.content;
  return base;
}

// 合併同一 id 的兩筆資料
function mergeItems(a, b) {
  const A = withDefaults(a),
    B = withDefaults(b);
  if (A.updatedAt !== B.updatedAt) {
    const newer = A.updatedAt > B.updatedAt ? A : B;
    const older = newer === A ? B : A;
    return takeRicherContent({ ...newer }, older);
  }
  const hs = Array.from(
    new Set([...(A.hashtags || []), ...(B.hashtags || [])])
  );
  const deleted = !!(A.deleted || B.deleted);
  const base = {
    ...A,
    hashtags: hs,
    deleted,
    createdAt: Math.max(A.createdAt || 0, B.createdAt || 0),
  };
  return takeRicherContent(base, B);
}

// 合併兩份清單（local + sync），並移除過期墓碑
function mergeLists(listA = [], listB = []) {
  const map = new Map();
  [...listA, ...listB].forEach((raw) => {
    const it = withDefaults(raw);
    const prev = map.get(it.id);
    map.set(it.id, prev ? mergeItems(prev, it) : it);
  });
  const now = Date.now();
  return Array.from(map.values()).filter(
    (it) =>
      !(it.deleted && it.updatedAt && now - it.updatedAt > TOMBSTONE_TTL_MS)
  );
}

// ---- sync 分片相關 ----
function makeSyncShadowList(list) {
  return list.map((it) => {
    const full = withDefaults(it);
    if (sizeBytes(full) > SYNC_SOFT_LIMIT) return toShadow(full);
    return full;
  });
}

// 從 sync 讀取所有分片並組合
async function syncGetAll(prefix) {
  const key = idxKey(prefix);
  const { [key]: idx = [] } = await chrome.storage.sync.get([key]);
  if (!Array.isArray(idx) || idx.length === 0) return [];
  const shardKeys = idx.map((i) => shardKey(prefix, i));
  const res = await chrome.storage.sync.get(shardKeys);
  const out = [];
  for (const k of shardKeys) out.push(...(res[k] || []));
  return out;
}

// 把清單分片後寫入 sync（並清理舊分片）
async function syncSetShards(prefix, list) {
  const safeList = makeSyncShadowList(list);
  const shards = [];
  let cur = [];
  for (const item of safeList) {
    const probe = [...cur, item];
    if (sizeBytes(probe) > SYNC_SOFT_LIMIT) {
      if (cur.length === 0) {
        shards.push([item]);
        cur = [];
      } else {
        shards.push(cur);
        cur = [item];
      }
    } else {
      cur = probe;
    }
  }
  if (cur.length) shards.push(cur);

  const indexK = idxKey(prefix);
  const batch = { [indexK]: shards.map((_, i) => i) };
  const used = new Set();
  shards.forEach((arr, i) => {
    const k = shardKey(prefix, i);
    used.add(k);
    batch[k] = arr;
  });

  const prev = await chrome.storage.sync.get([indexK]);
  const prevIdx = prev[indexK] || [];
  const obsolete = prevIdx
    .map((i) => shardKey(prefix, i))
    .filter((k) => !used.has(k));

  await chrome.storage.sync.set(batch);
  if (obsolete.length) await chrome.storage.sync.remove(obsolete);
}

// ---- 寫入排程（debounce + backoff） ----
const _writeBuffers = new Map();
const _writeTimers = new Map();
const _backoffMs = new Map();

// 安排將資料寫入 sync（會合併短時間多次寫入）
function scheduleSyncFlush(prefix, list) {
  _writeBuffers.set(prefix, list);
  if (_writeTimers.has(prefix)) return;

  const delay = _backoffMs.get(prefix) || WRITE_DEBOUNCE_MS;
  const timer = setTimeout(async () => {
    _writeTimers.delete(prefix);
    const payload = _writeBuffers.get(prefix);
    try {
      await syncSetShards(prefix, payload);
      _backoffMs.delete(prefix);
    } catch (e) {
      // 遇到速率限制 → 延長等待時間
      if (isRateLimitError(e)) {
        const cur = _backoffMs.get(prefix) || WRITE_DEBOUNCE_MS;
        const next = Math.min(cur * 2, MAX_BACKOFF_MS);
        _backoffMs.set(prefix, next);
      }
      console.warn("[DualStorage] syncSetShards retry:", e);
      // 重新安排最新資料
      scheduleSyncFlush(prefix, _writeBuffers.get(prefix));
    }
  }, delay);
  _writeTimers.set(prefix, timer);
}

// ---- 對外 API ----
// 從 local + sync 讀取並合併，回寫兩邊
async function dualGet(key) {
  const [loc, synList] = await Promise.all([
    chrome.storage.local.get([key]),
    syncGetAll(key),
  ]);
  const merged = mergeLists(loc[key], synList);
  await chrome.storage.local.set({ [key]: merged });
  scheduleSyncFlush(key, merged);
  return merged;
}

// 寫入 local 並安排寫入 sync
async function dualSet(key, list) {
  await chrome.storage.local.set({ [key]: list });
  scheduleSyncFlush(key, list);
}

// 監聽指定 key 的 local + sync 變動
function onKeyStorageChanged(prefix, handler) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[prefix]) {
      handler();
      return;
    }
    if (area === "sync") {
      const ks = Object.keys(changes);
      const hit = ks.some(
        (k) => k === idxKey(prefix) || k.startsWith(prefix + "::")
      );
      if (hit) handler();
    }
  });
}

// 將重要方法掛到全域
self.withDefaults = withDefaults;
self.dualGet = dualGet;
self.dualSet = dualSet;
self.onKeyStorageChanged = onKeyStorageChanged;
