-- Align TermSeason with NCAT first / second summer sessions.

ALTER TYPE "TermSeason" ADD VALUE IF NOT EXISTS 'SUMMER_I';
ALTER TYPE "TermSeason" ADD VALUE IF NOT EXISTS 'SUMMER_II';
