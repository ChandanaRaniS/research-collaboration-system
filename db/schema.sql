-- =====================================================================
-- Research Collaboration — database schema
-- Run once:   mysql -u root -p < db/schema.sql
-- Safe to re-run (everything uses IF NOT EXISTS).
-- =====================================================================
CREATE DATABASE IF NOT EXISTS research_collaboration
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE research_collaboration;

-- =====================================================================
-- PART A — Users table (Person 2)
-- Reconstructed from the register/login API routes. If you already have
-- these tables from Person 2, IF NOT EXISTS leaves them untouched.
-- =====================================================================
CREATE TABLE IF NOT EXISTS Users (
  user_id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name      VARCHAR(150) NOT NULL,
  email          VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           VARCHAR(30)  NOT NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- =====================================================================
-- PART B — PERSON 1: Research Paper Management
-- =====================================================================

-- Authors: one row per distinct author.
CREATE TABLE IF NOT EXISTS Authors (
  author_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name    VARCHAR(150) NOT NULL,
  affiliation  VARCHAR(255) NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (author_id),
  UNIQUE KEY uq_authors_full_name (full_name)
) ENGINE=InnoDB;

-- ResearchPapers: one row per paper.
-- uploaded_by links to Person 2's Users table (kept if the user is deleted).
CREATE TABLE IF NOT EXISTS ResearchPapers (
  paper_id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title             VARCHAR(500) NOT NULL,
  abstract          TEXT         NULL,
  domain            VARCHAR(100) NOT NULL,
  publication_year  SMALLINT     NULL,
  keywords          VARCHAR(500) NULL,
  doi               VARCHAR(255) NULL,
  pdf_url           VARCHAR(500) NULL,
  uploaded_by       INT UNSIGNED NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (paper_id),
  UNIQUE KEY uq_papers_doi (doi),
  KEY idx_papers_title (title(191)),
  KEY idx_papers_domain (domain),
  KEY idx_papers_year (publication_year),
  CONSTRAINT fk_papers_user FOREIGN KEY (uploaded_by)
    REFERENCES Users (user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_papers_year CHECK (publication_year IS NULL OR publication_year BETWEEN 1000 AND 2100)
) ENGINE=InnoDB;

-- PaperAuthors: many-to-many link between papers and authors.
-- author_order keeps the byline order (1 = first author).
CREATE TABLE IF NOT EXISTS PaperAuthors (
  paper_id      INT UNSIGNED NOT NULL,
  author_id     INT UNSIGNED NOT NULL,
  author_order  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (paper_id, author_id),
  KEY idx_pa_author (author_id),
  CONSTRAINT fk_pa_paper  FOREIGN KEY (paper_id)  REFERENCES ResearchPapers (paper_id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_author FOREIGN KEY (author_id) REFERENCES Authors (author_id)       ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- PART C — Person 2 tables that point at ResearchPapers
-- Reconstructed from Person 2's API routes so the whole app works on a
-- fresh database. Skipped automatically if they already exist.
-- =====================================================================
CREATE TABLE IF NOT EXISTS Bookmarks (
  bookmark_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  paper_id       INT UNSIGNED NOT NULL,
  bookmarked_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (bookmark_id),
  UNIQUE KEY uq_bookmark (user_id, paper_id),
  CONSTRAINT fk_bm_user  FOREIGN KEY (user_id)  REFERENCES Users (user_id)           ON DELETE CASCADE,
  CONSTRAINT fk_bm_paper FOREIGN KEY (paper_id) REFERENCES ResearchPapers (paper_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Collaborations (
  collaboration_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  requester_id      INT UNSIGNED NOT NULL,
  receiver_id       INT UNSIGNED NOT NULL,
  research_topic    VARCHAR(255) NOT NULL,
  message           TEXT NULL,
  status            ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collaboration_id),
  CONSTRAINT fk_col_req FOREIGN KEY (requester_id) REFERENCES Users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_col_rec FOREIGN KEY (receiver_id)  REFERENCES Users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Comments (
  comment_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,
  paper_id      INT UNSIGNED NOT NULL,
  comment_text  TEXT NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (comment_id),
  CONSTRAINT fk_cm_user  FOREIGN KEY (user_id)  REFERENCES Users (user_id)           ON DELETE CASCADE,
  CONSTRAINT fk_cm_paper FOREIGN KEY (paper_id) REFERENCES ResearchPapers (paper_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Ratings (
  rating_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  paper_id    INT UNSIGNED NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL,
  review      TEXT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rating_id),
  UNIQUE KEY uq_rating (user_id, paper_id),
  CONSTRAINT fk_rt_user  FOREIGN KEY (user_id)  REFERENCES Users (user_id)           ON DELETE CASCADE,
  CONSTRAINT fk_rt_paper FOREIGN KEY (paper_id) REFERENCES ResearchPapers (paper_id) ON DELETE CASCADE,
  CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;
