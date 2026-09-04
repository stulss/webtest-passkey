// 로컬 개발 전용 인메모리 KV. REDIS_URL 이 없고 프로덕션이 아닐 때만 쓴다.
// lib/kv.ts 의 KvLike 가 쓰는 메서드의 부분집합만 구현한다.
// 값은 객체를 그대로 저장·반환한다(실 Redis 경로의 JSON 직렬화는 lib/kv.ts 어댑터가 담당).
// 프로세스가 죽으면 사라진다 — 로컬에서 흐름을 눈으로 확인하는 용도.

type Entry = { value: unknown; expireAt: number | null };

class MemoryKV {
  private store = new Map<string, Entry>();

  private live(key: string): Entry | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expireAt !== null && Date.now() > e.expireAt) {
      this.store.delete(key);
      return undefined;
    }
    return e;
  }

  async set(key: string, value: unknown, opts?: { ex?: number }): Promise<"OK"> {
    this.store.set(key, {
      value,
      expireAt: opts?.ex ? Date.now() + opts.ex * 1000 : null,
    });
    return "OK";
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const e = this.live(key);
    return e ? (structuredClone(e.value) as T) : null;
  }

  async getdel<T = unknown>(key: string): Promise<T | null> {
    const e = this.live(key);
    this.store.delete(key);
    return e ? (structuredClone(e.value) as T) : null;
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) if (this.store.delete(k)) n++;
    return n;
  }

  private set_(key: string): Set<string> {
    const e = this.live(key);
    if (e && e.value instanceof Set) return e.value as Set<string>;
    const s = new Set<string>();
    this.store.set(key, { value: s, expireAt: null });
    return s;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    const s = this.set_(key);
    let n = 0;
    for (const m of members) if (!s.has(m)) (s.add(m), n++);
    return n;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const e = this.live(key);
    if (!e || !(e.value instanceof Set)) return 0;
    let n = 0;
    for (const m of members) if ((e.value as Set<string>).delete(m)) n++;
    return n;
  }

  async smembers(key: string): Promise<string[]> {
    const e = this.live(key);
    return e && e.value instanceof Set ? [...(e.value as Set<string>)] : [];
  }

  async scard(key: string): Promise<number> {
    const e = this.live(key);
    return e && e.value instanceof Set ? (e.value as Set<string>).size : 0;
  }

  private list_(key: string): unknown[] {
    const e = this.live(key);
    if (e && Array.isArray(e.value)) return e.value as unknown[];
    const arr: unknown[] = [];
    this.store.set(key, { value: arr, expireAt: null });
    return arr;
  }

  async lpush(key: string, ...values: unknown[]): Promise<number> {
    const arr = this.list_(key);
    arr.unshift(...values);
    return arr.length;
  }

  async rpush(key: string, ...values: unknown[]): Promise<number> {
    const arr = this.list_(key);
    arr.push(...values);
    return arr.length;
  }

  async lrange<T = unknown>(key: string, start: number, stop: number): Promise<T[]> {
    const e = this.live(key);
    if (!e || !Array.isArray(e.value)) return [];
    const arr = e.value as T[];
    const end = stop < 0 ? arr.length + stop + 1 : stop + 1;
    return structuredClone(arr.slice(start, end));
  }

  async lrem(key: string, count: number, value: unknown): Promise<number> {
    const e = this.live(key);
    if (!e || !Array.isArray(e.value)) return 0;
    const arr = e.value as unknown[];
    const target = JSON.stringify(value);
    let removed = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (JSON.stringify(arr[i]) === target) {
        arr.splice(i, 1);
        removed++;
        if (count > 0 && removed >= count) break;
      }
    }
    return removed;
  }

  async llen(key: string): Promise<number> {
    const e = this.live(key);
    return e && Array.isArray(e.value) ? (e.value as unknown[]).length : 0;
  }

  async ltrim(key: string, start: number, stop: number): Promise<"OK"> {
    const e = this.live(key);
    if (e && Array.isArray(e.value)) {
      const arr = e.value as unknown[];
      const end = stop < 0 ? arr.length + stop + 1 : stop + 1;
      e.value = arr.slice(start, end);
    }
    return "OK";
  }
}

// Next dev 는 라우트마다 모듈을 따로 번들할 수 있어 모듈 스코프 싱글턴이 공유되지 않는다.
// globalThis 에 붙여 한 프로세스 안에서 확실히 하나만 쓰도록 한다.
const g = globalThis as unknown as { __to8_memkv__?: MemoryKV };
export function memoryKV(): MemoryKV {
  g.__to8_memkv__ ??= new MemoryKV();
  return g.__to8_memkv__;
}
