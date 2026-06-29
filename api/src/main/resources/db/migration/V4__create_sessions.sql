-- Session ID is a UUID used directly as the Yjs room key
CREATE TABLE sessions (
    id         VARCHAR(36)  PRIMARY KEY,
    project_id BIGINT       NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    owner_id   BIGINT       NOT NULL REFERENCES users (id),
    active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_project ON sessions (project_id);
CREATE INDEX idx_sessions_owner   ON sessions (owner_id);
