-- Weather Budget Modifier — initial schema
-- All timestamp columns are INTEGER unix epoch milliseconds.

PRAGMA foreign_keys = ON;

CREATE TABLE config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE campaigns (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  google_campaign_id  TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  base_budget_micros  INTEGER NOT NULL,
  currency            TEXT NOT NULL,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);

CREATE TABLE buckets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  priority     INTEGER NOT NULL,
  min_temp_c   REAL,
  max_temp_c   REAL,
  conditions   TEXT NOT NULL DEFAULT '[]',
  modifier_pct REAL NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE bucket_campaigns (
  bucket_id   INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,
  PRIMARY KEY (bucket_id, campaign_id),
  FOREIGN KEY (bucket_id)   REFERENCES buckets(id)   ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE TABLE weather_snapshots (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,
  temp_c    REAL NOT NULL,
  condition TEXT NOT NULL,
  wmo_code  INTEGER NOT NULL,
  location  TEXT NOT NULL
);

CREATE TABLE adjustment_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ts                INTEGER NOT NULL,
  campaign_id       INTEGER NOT NULL,
  bucket_id         INTEGER,
  old_budget_micros INTEGER NOT NULL,
  new_budget_micros INTEGER NOT NULL,
  reason            TEXT NOT NULL,
  dry_run           INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (bucket_id)   REFERENCES buckets(id)
);

CREATE INDEX idx_weather_ts       ON weather_snapshots(ts DESC);
CREATE INDEX idx_adjustment_ts    ON adjustment_log(ts DESC);
CREATE INDEX idx_buckets_priority ON buckets(priority, active);
