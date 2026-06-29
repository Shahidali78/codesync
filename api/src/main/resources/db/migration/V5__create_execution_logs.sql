CREATE TABLE execution_logs (
    id          BIGSERIAL   PRIMARY KEY,
    session_id  VARCHAR(36) REFERENCES sessions (id) ON DELETE SET NULL,
    user_id     BIGINT      NOT NULL REFERENCES users (id),
    language    VARCHAR(50) NOT NULL,
    code        TEXT        NOT NULL,
    stdout      TEXT,
    stderr      TEXT,
    exit_code   INTEGER,
    duration_ms BIGINT,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_execlog_session ON execution_logs (session_id);
CREATE INDEX idx_execlog_user    ON execution_logs (user_id);
CREATE INDEX idx_execlog_created ON execution_logs (created_at);
