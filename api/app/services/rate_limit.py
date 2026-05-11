from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    retry_after_seconds: int


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, *, key: str, limit: int, window_seconds: int = 60) -> RateLimitResult:
        now = time.time()
        cutoff = now - window_seconds

        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= cutoff:
                hits.popleft()

            if len(hits) >= limit:
                retry_after = max(1, int(window_seconds - (now - hits[0])))
                return RateLimitResult(allowed=False, retry_after_seconds=retry_after)

            hits.append(now)

            if len(self._hits) > 10_000:
                self._cleanup(cutoff)

        return RateLimitResult(allowed=True, retry_after_seconds=0)

    def _cleanup(self, cutoff: float) -> None:
        for key in list(self._hits.keys()):
            hits = self._hits[key]
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if not hits:
                self._hits.pop(key, None)


rate_limiter = InMemoryRateLimiter()
