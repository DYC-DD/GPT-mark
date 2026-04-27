/*
 * ===== Dual storage 同步工具 =====
 * 同步管理 chrome.storage.local 與 chrome.storage.sync。
 * - local 保存完整內容，sync 保存可跨裝置同步的 shard/shadow 資料。
 * - merge 時保留較新 metadata、合併 hashtags，並避免 shadow content 覆蓋完整內容。
 * - sync 寫入透過 debounce 與 backoff 降低 rate limit 風險。
 */

// ===== 常數設定 =====
const SYNC_BYTES_PER_ITEM = 8192; // chrome.storage.sync 單一 item 上限
const SYNC_SOFT_LIMIT = 7000; // shard 切分的安全容量門檻
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // deleted=true tombstone 保留時間
const MAX_SYNC_CONTENT_CHARS = 512; // sync shadow content 最大字元數
const WRITE_DEBOUNCE_MS = 1200; // sync write debounce 間隔，單位 ms
const MAX_BACKOFF_MS = 15000; // rate limit backoff 上限，單位 ms

// ===== Utility helper 工具 =====
// 估算 JSON 序列化後的 byte size
function sizeBytes(obj) {
  return new Blob([JSON.stringify(obj)]).size;
}
// 建立 shard index key
function idxKey(prefix) {
  return `${prefix}::idx`;
}
// 建立 shard data key
function shardKey(prefix, i) {
  return `${prefix}::${i}`;
}
// 判斷 chrome.storage.sync 是否觸發 write rate limit
function isRateLimitError(e) {
  return /MAX_WRITE_OPERATIONS_PER_MINUTE/i.test(String(e?.message || e));
}

// 補齊 bookmark schema 預設值
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

// 建立 sync shadow 版本，限制 content 長度
function toShadow(item) {
  const it = withDefaults(item);
  return {
    ...it,
    content: (it.content || "").slice(0, MAX_SYNC_CONTENT_CHARS),
    __shadow: true,
  };
}

// 保留 content 較完整的一份，避免 shadow 覆蓋 local full text
function takeRicherContent(base, other) {
  const bc = (base.content || "").length;
  const oc = (other.content || "").length;
  if (oc > bc) base.content = other.content;
  return base;
}

// 合併相同 id 的 bookmark，較新的 updatedAt 優先
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

// 合併 local/sync 清單，並移除過期 tombstone
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

// 建立 bookmark list signature，用於判斷是否需要回寫 sync
function listSignature(list = []) {
  return (list || [])
    .map((it) => {
      const x = withDefaults(it);
      return `${x.id}|${x.updatedAt}|${x.deleted ? 1 : 0}|${(
        x.hashtags || []
      ).join(",")}|${(x.content || "").length}`;
    })
    .sort()
    .join(";");
}

// ===== Sync shard 處理 =====
// 將過大的 bookmark 轉為 shadow，避免單 shard 超過 sync 限制
function makeSyncShadowList(list) {
  return list.map((it) => {
    const full = withDefaults(it);
    if (sizeBytes(full) > SYNC_SOFT_LIMIT) return toShadow(full);
    return full;
  });
}

// 從 sync index 讀回所有 shard 並還原清單
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

// 將清單切成 shard 寫入 sync，並移除不再使用的舊 shard
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

// ===== Sync write queue 寫入排程 =====
const _writeBuffers = new Map();
const _writeTimers = new Map();
const _backoffMs = new Map();

// 將同一 prefix 的多次寫入合併為一次 sync flush
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
      // rate limit 時提高 backoff
      if (isRateLimitError(e)) {
        const cur = _backoffMs.get(prefix) || WRITE_DEBOUNCE_MS;
        const next = Math.min(cur * 2, MAX_BACKOFF_MS);
        _backoffMs.set(prefix, next);
      }
      console.warn("[DualStorage] syncSetShards retry:", e);
      // 使用最新 buffer 重新排程
      scheduleSyncFlush(prefix, _writeBuffers.get(prefix));
    }
  }, delay);
  _writeTimers.set(prefix, timer);
}

// 讀取並合併 local/sync；僅在 sync 不一致時回寫
async function dualRead(key) {
  const [loc, synList] = await Promise.all([
    chrome.storage.local.get([key]),
    syncGetAll(key),
  ]);
  const merged = mergeLists(loc[key], synList);

  await chrome.storage.local.set({ [key]: merged });

  if (listSignature(merged) !== listSignature(synList)) {
    scheduleSyncFlush(key, merged);
  }
  return merged;
}

// ===== Public API 對外介面 =====
// 讀取 local/sync、合併後回寫兩端
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

// 先寫入 local，再以排程方式同步到 sync
async function dualSet(key, list) {
  await chrome.storage.local.set({ [key]: list });
  scheduleSyncFlush(key, list);
}

// 監聽指定 bookmark key 的 local/sync shard 變動
function onKeyStorageChanged(prefix, handler) {
  const listener = (changes, area) => {
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
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// ===== Settings key-value helper 設定工具 =====
async function dualGetSetting(key, fallback) {
  const [loc, syn] = await Promise.all([
    chrome.storage.local.get([key]),
    chrome.storage.sync.get([key]),
  ]);
  // sync 優先，其次 local，最後 fallback
  const hasSyn = Object.prototype.hasOwnProperty.call(syn, key);
  const hasLoc = Object.prototype.hasOwnProperty.call(loc, key);
  let val = hasSyn ? syn[key] : hasLoc ? loc[key] : fallback;

  // 補寫缺漏端，維持 local/sync 一致
  const writes = [];
  if (!hasSyn && hasLoc)
    writes.push(chrome.storage.sync.set({ [key]: loc[key] }));
  if (!hasLoc || loc[key] !== val)
    writes.push(chrome.storage.local.set({ [key]: val }));
  if (writes.length) await Promise.all(writes);

  return val;
}

async function dualSetSetting(key, value) {
  await Promise.all([
    chrome.storage.local.set({ [key]: value }),
    chrome.storage.sync.set({ [key]: value }),
  ]);
}

// 監聽單一 settings key 的 local/sync 變動
function onSettingChangedKey(key, handler) {
  const listener = (changes, area) => {
    if (changes[key]) handler(changes[key].newValue, area);
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// 暴露 shared API 給 extension pages/content script 使用
self.dualRead = dualRead;
self.withDefaults = withDefaults;
self.dualGet = dualGet;
self.dualSet = dualSet;
self.onKeyStorageChanged = onKeyStorageChanged;
self.dualGetSetting = dualGetSetting;
self.dualSetSetting = dualSetSetting;
self.onSettingChangedKey = onSettingChangedKey;
