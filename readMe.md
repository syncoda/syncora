# MoodRead Backend Progress (April 6, 2026)

## What Was Implemented

### 1) Express App Foundation

- Added production-style Express bootstrapping with:
  - CORS + credentials support
  - JSON and URL-encoded body parsing
  - static uploads folder exposure
  - centralized 404 and global error handlers
- Added health endpoint:
  - `GET /api/health`

### 2) SQLite Database + Schema

- Added and initialized SQLite database at `db/moodread.db`.
- Extended schema with app tables:
  - `books`
  - `paragraphs`
  - `songs`
  - `users`
  - `auth_sessions`
- Added indexes for common query paths.
- Important SQLite fix:
  - reserved keyword `index` is quoted as `"index"` in schema and SQL queries.

### 3) Authentication (Functional)

- Implemented auth routes under ` /api/auth `:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Added:
  - password hashing (`bcryptjs`)
  - access/refresh JWT tokens (`jsonwebtoken`)
  - refresh-token cookie handling (`cookie-parser`)
  - refresh-session storage in DB (`auth_sessions`)
  - middleware-protected access for `/me`

### 4) Songs Catalog Improvements

- Replaced hardcoded songs seed with CSV-driven seeding from `audio_features.csv`.
- Added mood-to-emotion mapping from CSV mood labels to app emotion enum.
- Current seeded catalog size from CSV: **37 songs**.

### 5) Book/Paragraph + Upload Flow

- Added upload endpoint:
  - `POST /api/upload` (`multipart/form-data`, field name: `file`)
  - supports `.txt` and `.pdf`
  - parses paragraphs and stores them in DB
- Added book/paragraph read endpoints:
  - `GET /api/books/:bookId`
  - `GET /api/books/:bookId/paragraphs?page=&limit=`
  - `GET /api/books/:bookId/paragraphs/:index`
- Added songs endpoints:
  - `GET /api/songs`
  - `GET /api/songs?emotion=`
  - `GET /api/songs/:songId`
  - `GET /api/songs/:songId/stream`

## Manual Verification Status

### Manually checked by me

- `POST /api/auth/register` -> checked
- `POST /api/auth/login` -> checked
- `GET /api/songs` and `GET /api/songs?emotion=` -> checked
- `GET /api/health` -> checked

### Not yet checked by me

- `POST /api/upload` -> pending manual validation

## Note About `/api/auth/me`

`/api/auth/me` is a protected endpoint and requires a valid access token.

- Without token:
  - returns `401` with `Missing access token.`
- With header `Authorization: Bearer <accessToken>`:
  - returns user payload successfully

If `/me` appears "not working", the most common cause is calling it without a bearer token or with an expired token.

---

## Project Setup (Backend)

Backend source now lives under `backend/`.

### Prerequisites

- Node.js 20+
- npm 10+

### Install and Run

1. Install dependencies:

  ```bash
  npm install
  ```

1. Create a local `.env` file (required for stable auth sessions):

  ```bash
  copy .env.example .env
  ```

  Or create it manually with:

  ```env
  PORT=3001
  CLIENT_ORIGIN=http://localhost:5173
  JWT_ACCESS_SECRET=change-this-access-secret
  JWT_REFRESH_SECRET=change-this-refresh-secret
  ACCESS_TOKEN_TTL=15m
  REFRESH_TOKEN_TTL=7d
  NODE_ENV=development
  ```

1. Start server:

  ```bash
  npm start
  ```

1. Verify server:

- `GET /api/health` should return `{ "ok": true, ... }`

### Optional Dev Mode

```bash
npm run dev
```

## End-to-End Test Steps (Manual)

Use these steps to verify the full backend flow after startup.

### 1) Health Check

```bash
curl http://localhost:3001/api/health
```

Expected: JSON with `ok: true`.

### 2) Songs List and Filter

```bash
curl http://localhost:3001/api/songs
curl "http://localhost:3001/api/songs?emotion=joy"
```

Expected: valid JSON arrays in `songs`.

### 3) Auth Register and Protected Route

Register a user:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test1@example.com\",\"username\":\"test1user\",\"password\":\"Passw0rd!\",\"confirmPassword\":\"Passw0rd!\"}"
```

Use returned `accessToken` on protected route:

```bash
curl http://localhost:3001/api/auth/me -H "Authorization: Bearer <accessToken>"
```

Expected: user payload is returned.

### 4) Upload + Book + Paragraph Flow

Upload a `.txt` file using field name `file`:

```bash
curl -X POST http://localhost:3001/api/upload -F "file=@sample-upload.txt"
```

Take returned `bookId` and test:

```bash
curl http://localhost:3001/api/books/<bookId>
curl "http://localhost:3001/api/books/<bookId>/paragraphs?page=1&limit=10"
curl http://localhost:3001/api/books/<bookId>/paragraphs/0
```

Expected: metadata, paginated paragraphs, and paragraph detail all resolve.

### 5) Song Detail and Stream

Use any `songId` from `/api/songs`:

```bash
curl http://localhost:3001/api/songs/<songId>
curl -I http://localhost:3001/api/songs/<songId>/stream
```

Expected: song metadata from first call; `Content-Type: audio/mpeg` header from stream endpoint.

### Notes About `.env` / "nv"

- If you meant `.env`: yes, this project should use it for stable auth behavior.
- In development only, if JWT secrets are missing, the server currently generates temporary in-memory secrets and logs a warning.
- Those temporary secrets reset on restart, so existing tokens become invalid.
- In production, missing `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` causes startup failure.

---

## Database Maintenance (SQLite)

The current backend uses SQLite at `backend/db/moodread.db`.

### How DB initializes

- On server start, `backend/db/schema.sql` runs with `CREATE TABLE IF NOT EXISTS`.
- Songs are seeded from root `audio_features.csv` if `songs` table is empty.

### Reset DB safely

Use this when schema/data gets out of sync during development:

```powershell
if (Test-Path .\db\moodread.db) { Remove-Item .\db\moodread.db -Force }
npm start
```

Use this path now:

```powershell
if (Test-Path .\backend\db\moodread.db) { Remove-Item .\backend\db\moodread.db -Force }
npm start
```

### Common maintenance tasks

- Reseed songs: remove `backend/db/moodread.db` and restart.
- Clean uploaded temp files: clear `backend/uploads/` if needed.
- Backup DB locally:

  ```powershell
  Copy-Item .\backend\db\moodread.db .\backend\db\moodread.backup.db
  ```

### What should not be committed

- `backend/db/moodread.db` (machine-local runtime data)
- `backend/uploads/` and `aiservice/uploads/` generated files
- `.env` secrets

### Frontend + Songs Location

- Frontend dev server serves songs from root `songs/`.

---

## Future Migration to PostgreSQL

Yes, this project can be migrated to PostgreSQL later with moderate effort.

### Suggested migration approach

1. Add a DB adapter layer so routes call repository/helper functions instead of inline SQL.
2. Introduce a migration tool (recommended: `knex`, `drizzle`, or `prisma`).
3. Port `db/schema.sql` into versioned Postgres migrations.
4. Replace SQLite placeholders/quoting with Postgres style where needed.
5. Move `createdAt/updatedAt` fields to `TIMESTAMP WITH TIME ZONE`.
6. Replace DB bootstrapping in `db/db.js` with Postgres client/pool.
7. Add `DATABASE_URL` and environment-specific configs.
8. Run data migration script (SQLite -> Postgres) for existing books/paragraphs/songs/users/auth sessions.
9. Smoke test all endpoints (`auth`, `upload`, `books`, `songs`, `stream`).

### Practical note on SQL compatibility

- Quoted identifier `"index"` in `paragraphs` is valid in Postgres too.
- Keep this quoted or rename column to `paragraphIndex` during migration to reduce future friction.

---

# Audio Feature Extraction and Mood Mapping Pipeline

## 1. Waveform and Framing (Time-Domain Analysis)

We begin with the raw audio signal (waveform), represented as a discrete sequence of amplitude values:

    y = [x₀, x₁, x₂, x₃, ...]

Each value corresponds to air pressure at a specific moment in time. The sampling rate (e.g., 22050 Hz) determines how many samples are taken per second.

### Framing

Audio signals are non-stationary, meaning their properties change over time. To analyze them effectively, we divide the waveform into small overlapping chunks called frames:

    y[i : i + frame_length]

- Typical frame size: 20–100 ms  
- Assumption: the signal is locally stationary within each frame  

---

## 2. Energy (Signal Power)

For each frame, we compute the energy:

    Energy = Σ (x²)

### Purpose

- Squaring removes negative values  
- Emphasizes larger amplitudes  
- Represents physical signal power  

### Interpretation

- High energy: loud or intense sound  
- Low energy: quiet or calm sound  

---

## 3. Root Mean Square (RMS)

RMS provides a normalized measure of energy:

    RMS = sqrt((1/N) Σ x²)

### Properties

- Normalized by frame size  
- Better approximation of perceived loudness than raw energy  

---

## 4. Decibel Scale (dB)

Amplitude is converted to a logarithmic scale:

    dB = 20 * log10(A)

### Why logarithmic scaling?

Human hearing is logarithmic in nature:

- Equal ratios in amplitude correspond to similar perceived differences in loudness  

### Characteristics

- 0 dB represents a reference maximum  
- Negative values indicate lower amplitudes  

---

## 5. Spectrogram (Time-Frequency Representation)

The Short-Time Fourier Transform (STFT) is applied to each frame:

    Signal (time domain) → Frequency domain

### Output Structure

- X-axis: time  
- Y-axis: frequency  
- Values: magnitude (often converted to dB)  

### Interpretation

The spectrogram shows how energy is distributed across different frequencies over time.

### Tradeoff

- Smaller frames: better time resolution, poorer frequency resolution  
- Larger frames: better frequency resolution, poorer time resolution  

---

## 6. Mel-Frequency Cepstral Coefficients (MFCC)

MFCCs are derived from the spectrogram using the following steps:

1. Convert frequency scale to Mel scale  
2. Apply logarithmic compression  
3. Apply Discrete Cosine Transform (DCT)  

---

### Mel Scale

The Mel scale models human auditory perception:

    Mel(f) = 2595 * log(1 + f / 700)

- More resolution at lower frequencies  
- Less resolution at higher frequencies  

---

### Discrete Cosine Transform (DCT)

- Reduces dimensionality  
- Captures overall spectral shape  
- Removes redundancy in the representation  

---

### Output

- Typically 13 coefficients  
- Represents timbre (texture and character of sound)  

---

## 7. Feature Interpretation and Mood Mapping

Extracted features include:

- Energy / RMS: signal strength  
- Spectral centroid: brightness  
- Tempo: speed of the track  
- MFCCs: timbral characteristics  

These features are mapped to moods using heuristic rules:

    if tempo > 120 and energy is high:
        mood = "Energetic"

---

## Limitations

- Rule-based mapping is heuristic and not mathematically derived  
- Emotional interpretation of sound is subjective  
- Results depend on chosen thresholds and dataset characteristics  

---

## Complete Pipeline

    Waveform (raw signal)
       ↓
    Framing (local analysis)
       ↓
    Energy / RMS (signal power)
       ↓
    Decibel scaling (logarithmic perception)
       ↓
    Spectrogram (frequency structure over time)
       ↓
    MFCC (compressed perceptual representation)
       ↓
    Rule-based mapping (mood classification)

---

## Conceptual Layers

| Layer        | Description                         |
|--------------|-------------------------------------|
| Waveform     | Physical signal representation      |
| Spectrogram  | Frequency structure over time       |
| MFCC         | Perceptual representation           |
| Mood         | Heuristic interpretation            |

---

## Summary

This system transforms raw audio into structured numerical features using signal processing techniques. These features are then interpreted using rule-based logic to assign semantic meaning (mood). The process follows a progression from physical signal representation to higher-level abstraction.
