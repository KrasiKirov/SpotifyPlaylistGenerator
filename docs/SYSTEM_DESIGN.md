# The Listening Room — System Design & Decision Record

---

## 1. Executive summary

**The Listening Room** turns a natural-language mood
into a real Spotify playlist in the user's account. A large language model proposes a
tracklist; the user curates it; the backend resolves each track against Spotify's catalog
and writes a private playlist.

Architecture: A stateless FastAPI service brokers two side-effect-free
concerns; LLM track generation and Spotify playlist creation, for a thin Expo/React
Native client that owns the user's OAuth session entirely on-device.

The defining property of the design is that the server holds no user state: no
database, no sessions, no stored tokens. Everything the server needs arrives in the
request and is forgotten when the response is sent. Most of the interesting trade-offs in
this document follow from that one choice.

---

## 2. System context (C4 Level 1)

This uses the [C4 model](https://c4model.com/), a standard way to describe software
architecture at four zoom levels (Context → Container → Component → Code). Level 1 shows
the system as a single box among its users and external dependencies.

```
        ┌──────────────┐
        │   Listener   │  (person, on a phone)
        └──────┬───────┘
               │ describes a mood, curates, taps "press to Spotify"
               ▼
        ┌──────────────────────┐        OAuth 2.0 PKCE (on-device)
        │  The Listening Room   │◄──────────────────────────────────┐
        │  (mobile + backend)   │                                    │
        └───┬───────────────┬───┘                                    │
            │ prompt         │ playlist_name + tracks + access_token  │
            ▼                ▼                                        │
   ┌────────────────┐  ┌────────────────┐                   ┌────────────────┐
   │  OpenAI API    │  │  Spotify Web   │                   │ Spotify Accounts│
   │ (track ideas)  │  │  API (catalog  │                   │  (authorizes   │
   │                │  │  + playlists)  │                   │   the listener)│
   └────────────────┘  └────────────────┘                   └────────────────┘
```

Two external dependencies do the heavy lifting (OpenAI for ideas, Spotify for catalog and
writes). The system's own job is orchestration, validation, and trust-boundary
enforcement, not storage.

---

## 3. Architecture overview (C4 Level 2 — containers)

Three deployable units share one core library:

| Container | Tech | Responsibility |
|---|---|---|
| **Mobile app** | Expo SDK 54, React Native 0.81, TypeScript | UI, OAuth PKCE flow, session held in memory, calls the backend |
| **Backend API** | FastAPI + Uvicorn (Python 3.11), Docker on Railway | Validates input, calls OpenAI, resolves & writes Spotify playlists |
| **CLI** | `argparse` (`app.py`) | Developer/local entry point to the same core library |
| _shared_ | `playlist_generator.py` | LLM call + Spotify resolve/create logic, imported by both API and CLI |

Keeping the domain logic in `playlist_generator.py` and giving it two thin entry points
(HTTP in `api.py`, CLI in `app.py`) is a deliberate ports-and-adapters/hexagonal
arrangement: the business logic doesn't know or care whether it was invoked by a web
request or a terminal. That separation is what makes the core unit-testable without a
server (see §5, testing).

### Request lifecycle — flow A: generate

```
Mobile ──POST /generate {prompt,count,genre,decade,mood}──► FastAPI
                                                            │  validate (Pydantic)
                                                            │  compose full prompt
                                                            ├──► OpenAI chat.completions
                                                            │     (JSON mode, few-shot)
                                                            │  parse + defensively clean
                                                            ◄── 200 {tracks:[{song,artist}]}
Mobile shows PreviewScreen ◄────────────────────────────────┘
```

### Request lifecycle — flow B: add to Spotify

```
Mobile ──getAccessToken() (refresh if near-expiry, all on-device)
       ──POST /add-to-spotify {playlist_name,tracks,spotify_token}──► FastAPI
                                                                      │ validate
                                                                      ├─ for each track: Spotify search (limit 1)
                                                                      │    dedupe by id, collect "skipped" misses
                                                                      ├─ create private playlist
                                                                      ├─ add resolved track ids
                                                                      ◄ 200 {added_count, skipped[], playlist_url}
Mobile shows ResultScreen ◄────────────────────────────────────────┘
```

The two flows are separate HTTP calls on purpose (ADR-1). The user sees and edits the
tracklist between them.

---

## 4. Architecture Decision Records (ADRs)

### ADR-1 — Split the workflow into two endpoints (`/generate`, then `/add-to-spotify`)

- **Context.** The product has a human-in-the-loop step: the user reviews and trims the AI's
  suggestions before committing them to their account.
- **Decision.** Two stateless endpoints. `/generate` is a pure read (no side effects);
  `/add-to-spotify` is the write. The client carries the tracklist between them.
- **Why not one call?** A single "describe → playlist appears" call removes the curation
  step, makes the request slow (LLM + N Spotify writes in one shot), and turns a partial
  failure into an all-or-nothing event. Splitting keeps each endpoint fast and gives the
  write a clean retry boundary.
- **Consequences.** The client is the source of truth for the in-progress tracklist. This
  fits a stateless server (the tracklist never needs storing) and maps cleanly onto REST:
  `/generate` is safe, `/add-to-spotify` is the unsafe mutation.

### ADR-2 — Stateless token pass-through; no database, no server sessions

- **Context.** To write a playlist, the server needs the user's Spotify authorization. The
  conventional approach stores per-user OAuth tokens server-side.
- **Decision.** The server stores nothing. The mobile client performs OAuth itself and
  sends the access token in each `/add-to-spotify` body; the server uses it for exactly one
  request and discards it. `add_songs_with_token()` constructs a per-request Spotipy client
  bound to that token.
- **Why not store tokens / sessions?** A token store means a database, encryption at rest,
  key rotation, token-refresh cron jobs, GDPR/data-deletion obligations. For a single-purpose tool, that is enormous accidental complexity.
- **Consequences.** The backend is horizontally scalable by default, since any instance can
  serve any request because there is no session affinity and no shared state (a core
  [12-Factor](https://12factor.net/) principle: processes are stateless and
  share-nothing). The cost: the token travels in a request body, so transport security
  (TLS) and not logging bodies are non-negotiable, and there's no server-side revocation.

### ADR-3 — OAuth 2.0 Authorization Code + PKCE on a public client (no client secret)

- **Context.** A mobile app is a public client: anything shipped in the binary can be
  extracted, so it cannot keep a client secret.
- **Decision.** Use the Authorization Code flow with **PKCE** ([RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)),
  implemented via `expo-auth-session`. The app generates a random `code_verifier`, sends its
  SHA-256 `code_challenge` to Spotify, and proves possession of the verifier when exchanging
  the code for tokens. A random `state` parameter is verified on return to defeat CSRF.
- **Why not Implicit flow or a shipped secret?** The Implicit flow (tokens in the redirect)
  is deprecated by [OAuth 2.0 Security BCP](https://datatracker.ietf.org/doc/html/rfc9700)
  precisely because it exposes tokens; shipping a client secret in an app is a textbook
  credential leak.
- **Consequences.** No secret lives in the app. The `redirect_uri`
  (`spotifyplaylist://callback`) is a custom scheme that returns control to the app.

### ADR-4 — The mobile token lives in memory only (forget on app close)

- **Context.** Originally the token was persisted in `expo-secure-store`, so the app
  silently stayed logged in across cold starts indefinitely.
- **Decision.** Hold the session (`accessToken` / `refreshToken` / `expiresAt`) in a
  module-level variable. The OS wipes it when the app is killed, so a cold start returns to
  the "Pair with Spotify" screen.
- **Why not keep SecureStore?** Persistent auth is a UX expectation for big apps, but for a
  privacy-first single-purpose tool the cleaner default is "nothing on disk." It also
  sidesteps stale-token edge cases on shared devices.
- **Consequences.** Re-pair on each launch; the in-app OAuth round-trip keeps the process
  alive so login still works within a session, and the access token still auto-refreshes for
  long sessions.

### ADR-5 — Treat the LLM as a constrained structured-data generator, not a chatbot

- **Context.** The model must return data the program can consume, not prose.
- **Decision.** Three reinforcing controls in `get_playlist()`:
  1. **JSON mode** — `response_format={"type": "json_object"}` forces syntactically valid JSON.
  2. **Few-shot priming** — a worked `user → assistant` example fixes the exact shape
     `{"tracks":[{"song","artist"}]}`.
  3. **Defensive parsing** — even with the above, the code assumes the model can lie: it
     catches `JSONDecodeError`, checks `tracks` is a non-empty list, and filters out items
     that aren't `{str song, str artist}` before returning.
- **Why not trust the model / free-text parse?** LLM output is untrusted input. Regexing
  prose is brittle; trusting JSON mode alone still lets through wrong-shaped objects.
- **Consequences.** Bad model output degrades gracefully (filtered or a clean `ValueError`)
  instead of crashing or poisoning downstream Spotify calls. `max_tokens` scales with
  `count` to bound cost/latency.

### ADR-6 — Pydantic models as the single trust boundary

- **Context.** Every external input (client body, and the LLM's output re-validated as
  `Track`) needs validating before use.
- **Decision.** Pydantic v2 models with explicit constraints: `prompt` 1–500 chars,
  `count` 1–50, `tracks` 1–50 items, `spotify_token` ≤ 4096 chars. FastAPI rejects
  violations with `422` automatically and generates an OpenAPI schema for free.
- **Why not hand-rolled checks?** Manual validation is error-prone and scatters rules across
  handlers. Declarative schemas keep the contract in one place and self-document.
- **Consequences.** Garbage requests are rejected at the edge before touching OpenAI/Spotify
  (cost + abuse control). The bounds also cap blast radius (e.g. ≤ 50 Spotify writes).

### ADR-7 — Spotify resolution: best-effort search with dedupe and skip-tracking

- **Context.** The LLM returns song + artist strings; Spotify needs track IDs.
- **Decision.** For each suggestion, search Spotify (`limit=1`), take the top hit, dedupe
  by track ID via a `seen` set, and collect un-findable songs into a `skipped` list
  returned to the client. If nothing resolves, raise and don't create an empty playlist.
- **Why not fail on the first miss?** Partial success is the right UX: deliver the 18 tracks
  that matched and transparently report the 2 that didn't.
- **Consequences.** The result surfaces `added_count` and `skipped[]`, and the UI shows
  "N unaccounted for." Dedupe prevents the model's repeats from doubling a track.

### ADR-8 — FastAPI + Uvicorn, containerized, on Railway

- **Context.** Need an async-friendly Python web framework and a no-fuss deploy.
- **Decision.** FastAPI (Pydantic-native, OpenAPI out of the box, ASGI) on Uvicorn, in a
  slim Docker image, deployed on Railway; mobile distributed via EAS Build.
- **Why not Flask/Django?** Flask lacks built-in validation/schemas; Django is far too heavy
  for two endpoints and no DB. FastAPI hits the sweet spot.
- **Consequences.** The Dockerfile follows container best practices: pinned slim base,
  layer-cached deps (`COPY requirements.txt` before code), a non-root user, and
  `--proxy-headers` so client IPs survive Railway's proxy (used by the rate limiter).
  
---

## 5. Cross-cutting concerns

### Security (mapped to the [OWASP API Security Top 10](https://owasp.org/API-Security/))

- **Broken auth (API2):** PKCE on the client (ADR-3); the server never holds long-lived
  creds (ADR-2). Spotify enforces token validity; a `401` from Spotify is surfaced to the
  client which then forces re-pairing.
- **Unrestricted resource consumption (API4):** per-IP rate limiting (`10/hour` per
  endpoint via SlowAPI), a 64 KB request-body cap (custom middleware → `413`), and
  bounded fields (ADR-6). `max_tokens` caps LLM spend.
- **Injection / unsafe input:** all inputs schema-validated; LLM output re-validated (ADR-5/6).
- **Security misconfiguration (API8):** CORS is allow-list driven from
  `ALLOWED_ORIGINS` and restricted to `POST` + `Content-Type`; secrets come from the
  environment, never the repo (`.env.example` is the template).
- **Transport:** tokens ride in request bodies, so HTTPS is mandatory and bodies are never
  logged.

### Reliability & error handling

- **Fail fast with timeouts everywhere:** OpenAI (30 s), Spotify (15 s), and the mobile
  `fetch` (30 s via `AbortController`). An unbounded external call is an outage waiting to
  happen.
- **Error taxonomy → HTTP semantics:** malformed model output → `502` (upstream's fault);
  unexpected generation failure → `500`; invalid/expired Spotify token → `401`; other
  Spotify failures → `502`; validation → `422`; oversized body → `413`. Clients get
  actionable status codes, and internal exceptions are logged but never leaked in the
  response body.
- **Graceful partial failure:** the skip list (ADR-7).

### Observability

Structured logging via the stdlib `logging` module with `logger.exception(...)` on
every failure path (full traceback server-side, generic message client-side). Log level is
env-driven (`LOG_LEVEL`). This is the seam where real observability (structured JSON logs,
request IDs, metrics, tracing) would attach — see §6.

### Testing strategy (the test pyramid)

The [test pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) says:
many fast unit tests, fewer integration tests, few end-to-end. The suite reflects it:

- **Unit tests** (`test_playlist_generator.py`): the OpenAI client and Spotipy are
  mocked at the boundary, so logic (JSON cleaning, dedupe, skip, "no tracks found") is
  tested deterministically with zero network and zero cost.
- **API/integration tests** (`test_api.py`): FastAPI's `TestClient` exercises the real
  validation + error-mapping stack (422/413/401/500/502 paths) with the domain layer
  patched.
- **Boundary discipline:** tests patch exactly the external edge (`api.get_playlist`,
  `playlist_generator.spotipy.Spotify`), never internal functions, so refactors don't
  break tests spuriously.

### Configuration & secrets (12-Factor)

Config is read from the environment (`dotenv_values(".env")` merged under `os.environ`, so
real env vars win). Mobile build-time config travels via `eas.json` `EXPO_PUBLIC_*` vars.
Nothing secret is committed. This is 12-Factor's config in the environment factor and is
what lets the same image run in dev and prod unchanged.

---

## 6. Scaling the system (10× → 100× → 1000×)

The current design is a single stateless service calling two third-party APIs. Here is how
each layer evolves as traffic grows — and crucially, **why the stateless foundation makes
most of this easy.**

### Layer 1 — The stateless API (10×)

Because the server is share-nothing (ADR-2), scaling out is "run more replicas behind a
load balancer." No session affinity, no sticky routing. Railway → multiple instances, or
move to a container orchestrator. This is the dividend of statelessness: the easy scaling
axis is already free.

### Layer 2 — Protect and cache the upstreams (10×–100×)

The real bottlenecks are OpenAI and Spotify (latency, rate limits, cost), not our CPU.

- **Caching (read path):** identical `/generate` prompts can serve a cached tracklist
  (Redis, keyed by normalized prompt+count, short TTL). Spotify search results cache
  well too (song+artist → track ID rarely changes); this collapses the per-request N
  searches dramatically. Introduces the classic cache concerns: invalidation, stampede
  (use single-flight / request coalescing).
- **Resilience patterns:** add **circuit breakers** around OpenAI/Spotify so a provider
  outage sheds load fast instead of piling up timeouts; exponential backoff with jitter
  and respect for Spotify's `Retry-After` on `429`.
- **Distributed rate limiting:** SlowAPI's in-process counters don't share state across
  replicas. Move the limiter to a Redis backend so limits are global, not per-instance.

### Layer 3 — Make the write path asynchronous (100×)

`/add-to-spotify` does N sequential searches + writes —> slow and tied to one HTTP request.
At scale:

- **Job queue:** accept the request, enqueue it (SQS/Celery/RQ), return `202 Accepted` with
  a status URL; a worker pool does the Spotify work and the client polls or gets a push.
  This decouples request latency from upstream latency and lets writes retry independently.
- **Idempotency:** give each submission an idempotency key so a retried "create
  playlist" doesn't create duplicates. The standard pattern for safe retries on
  non-idempotent operations (what Stripe/payment APIs do).
- **Batch the Spotify calls:** `user_playlist_add_tracks` already takes a list; search is
  the per-item cost, parallelize searches with a bounded worker pool.

### Layer 4 — When you finally need state (100×–1000×)

State enters only when the product demands it (accounts, playlist history,
edit-before-add persistence), not because scaling forces it.
At that point:

- **Datastore:** Postgres for relational user/playlist data; tokens (if persisted) in a
  KMS-encrypted store with rotation.
- **Read replicas / partitioning** as the data grows; cache-aside in front.

### Layer 5 — Operate it (cross-cutting at every scale)

- **Observability:** structured JSON logs with correlation/request IDs, RED metrics
  (Rate/Errors/Duration) per endpoint and per upstream, and distributed tracing
  (OpenTelemetry) so an OpenAI slowdown is visible as a span, not a mystery.
- **Cost controls:** per-user and global LLM budgets, cheaper/distilled models for simple
  prompts, and the cache above (the cheapest token is the one you don't spend).
- **Multi-region** only once latency or availability SLOs demand it; the stateless tier
  makes active-active straightforward, the datastore is the hard part.

---

## 7. Known limitations & future work

- **Top-1 Spotify match** can occasionally pick the wrong recording (live vs. studio); a
  scoring pass would improve precision.
- **No CI pipeline described** — tests exist; wiring them to run on every push is the next
  hygiene step.

---

## 8. Appendix

**Q: Why no database?**
The product needs no server-side state: the client owns the in-progress tracklist and its
own OAuth session, and the server only brokers two stateless calls. No DB means no breach
surface, no migrations, and free horizontal scaling. I'd add one only when a feature
(accounts, history) demands it. (ADR-2)

**Q: Isn't sending the Spotify token in the request body insecure?**
It's a deliberate trade-off. Over TLS the body is encrypted in transit; I never log bodies;
the token is used for one request and discarded; and Spotify's own expiry bounds its
lifetime. The alternative — storing tokens server-side — trades that transient exposure for
a permanent, high-value data store to defend. (ADR-2)

**Q: How do you stop the LLM from inventing songs that don't exist?**
I don't fully; I design for it. The model's output is untrusted: JSON mode + a few-shot
exemplar fix the shape, defensive parsing drops malformed items, and the Spotify resolve
step is the reality check. Anything that doesn't resolve to a real catalog track lands in
the transparent `skipped` list rather than the playlist. (ADR-5/7)

**Q: Why two endpoints instead of one?**
To insert human curation, to give the idempotent read and the side-effecting write separate
latency and failure profiles, and to keep the server stateless (the client holds the
tracklist between calls). (ADR-1)

**Q: How would you make `/add-to-spotify` safe to retry?**
Idempotency keys: the client sends a unique key per submission; the server (with a small
store at that point) records the key→result so a retried create returns the original result
instead of making a second playlist.

**Q: What's the bottleneck, and how do you scale it?**
It's the upstreams. Cache `/generate` results and Spotify search lookups in
Redis, coalesce duplicate in-flight requests, add circuit breakers + backoff, and move the
write path onto a job queue returning `202`. The stateless API itself scales by adding
replicas. (§6)

**Q: What is PKCE and why use it?**
Proof Key for Code Exchange (RFC 7636). A public client can't keep a secret, so it generates
a random verifier, sends its hash up front, and proves possession when redeeming the auth
code, making a stolen code useless. It's the modern replacement for the deprecated Implicit
flow. (ADR-3)

**Q: How do you handle a Spotify token expiring mid-session?**
The client refreshes proactively when within 60 s of expiry. If a refresh fails, the API
surfaces Spotify's `401`, the app clears the session and routes the user back to re-pair. (ADR-3/4)

**Q: How are errors represented?**
A deliberate taxonomy mapped to HTTP: `422` validation, `413` oversized body, `401` bad
token, `502` upstream returned garbage, `500` unexpected. Full tracebacks are logged
server-side; clients get an actionable status and a safe message, never an internal stack
trace. (§5)

**Q: How is it tested without hitting OpenAI/Spotify?**
Mock at the boundary. Unit tests stub the OpenAI client and Spotipy so domain logic
(cleaning, dedupe, skip) is deterministic and free; API tests use FastAPI's `TestClient` to
verify the validation/error stack. Classic test pyramid. (§5)

**Q: What would you do differently with more time?**
Distributed rate limiting + caching in Redis, circuit breakers and retries on upstreams, an
async job queue with idempotency for writes, a CI pipeline running the tests, and a
match-scoring pass for Spotify resolution. (§6, §7)

**Q: How do you control LLM cost?**
`max_tokens` scales with requested count; rate limits cap volume; a singleton OpenAI client
avoids per-request setup; at scale, cache identical prompts and route simple prompts to
cheaper models. (ADR-5, §6)

**Q: Why FastAPI over Flask or Django?**
Flask needs bolt-on validation; Django is a heavy, DB-centric framework I don't need for two
stateless endpoints. FastAPI gives Pydantic validation, OpenAPI docs, and ASGI async on one
stack. (ADR-8)

---
