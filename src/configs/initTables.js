import pool from '../providers/db.js'
import logger from '../providers/logger.js'
import {redis_client, initialise_redis} from '../providers/redis.js'
import {COMMAND_STATUS, SERVER_STATUS, AGENT_STATUS, TEAM_ROLES, MODULE_TYPES, TEAM_TYPE_NAMES} from '../configs/constants.js'

const SQLSTATEMENT = `

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS Identity;
DROP TABLE IF EXISTS Module;
DROP TABLE IF EXISTS Session;
DROP TABLE IF EXISTS UserTeam;
DROP TABLE IF EXISTS Command;
DROP TABLE IF EXISTS User;
DROP TABLE IF EXISTS Server;
DROP TABLE IF EXISTS Agent;
DROP TABLE IF EXISTS Team;
DROP TABLE IF EXISTS Tunnel;

CREATE TABLE User (
    user_id BINARY(16) PRIMARY KEY,
    username VARCHAR(63) NOT NULL UNIQUE,
    accepted_legal_compliance_version INT UNSIGNED NOT NULL DEFAULT 0,
    legal_compliance_accepted_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0
);

CREATE TABLE Identity (
    identity_id BINARY(16) PRIMARY KEY,
    user_id BINARY(16) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider VARCHAR(63) NOT NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    UNIQUE (provider, provider_user_id)
);

CREATE TABLE Session (
    session_id BINARY(16) PRIMARY KEY,
    user_id BINARY(16) NOT NULL,
    refresh_token VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    INDEX (user_id),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0
);

CREATE TABLE Team (
    team_id BINARY(16) PRIMARY KEY,
    team_name VARCHAR(255) NOT NULL,
    slug VARCHAR(15) NOT NULL,
    team_type ENUM(${TEAM_TYPE_NAMES.map((r) => `'${r}'`).join(',')}) NOT NULL DEFAULT 'free',
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    CONSTRAINT unqiue_full_name UNIQUE (team_name, slug)
);

CREATE TABLE UserTeam (
    user_id BINARY(16) NOT NULL,
    team_id BINARY(16) NOT NULL,
    role ENUM(${TEAM_ROLES.map((r) => `'${r}'`).join(',')}) NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, team_id),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES Team(team_id) ON DELETE CASCADE
);

CREATE TABLE Agent (
    agent_id BINARY(16) PRIMARY KEY,
    team_id BINARY(16) NOT NULL,
    agent_name VARCHAR(255) NOT NULL,
    agent_status ENUM(${AGENT_STATUS.map((r) => `'${r}'`).join(',')}) NOT NULL DEFAULT 'offline',
    last_online DATETIME NULL,
    public_key VARCHAR(255) NOT NULL,
    tunnel_public_key VARCHAR(255) NOT NULL,
    tunnel_ip INT UNSIGNED NOT NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    FOREIGN KEY (team_id) REFERENCES Team(team_id) ON DELETE CASCADE,
    INDEX(tunnel_ip)
);

CREATE TABLE Command (
    command_id BINARY(16) PRIMARY KEY,
    agent_id BINARY(16) NOT NULL,
    user_id BINARY(16) NULL,
    command JSON NOT NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    command_status ENUM(${COMMAND_STATUS.map((r) => `'${r}'`).join(',')}) NOT NULL DEFAULT 'pending',
    command_feedback VARCHAR(1023) NULL,
    FOREIGN KEY (agent_id) REFERENCES Agent(agent_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE SET NULL,
    INDEX (agent_id, command_status),
    INDEX (agent_id, created_at DESC)
);

CREATE TABLE Server (
    server_id BINARY(16) PRIMARY KEY,
    agent_id BINARY(16) NOT NULL,
    server_name VARCHAR(255) NOT NULL,
    server_port INT UNSIGNED NOT NULL,
    properties JSON NOT NULL,
    server_status ENUM(${SERVER_STATUS.map((r) => `'${r}'`).join(',')}) NOT NULL DEFAULT 'offline',
    server_thumbnail VARCHAR(1023) NULL,
    last_online DATETIME NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    FOREIGN KEY (agent_id) REFERENCES Agent(agent_id) ON DELETE CASCADE
);

CREATE TABLE Tunnel (
    tunnel_id BINARY(16) PRIMARY KEY,
    server_id BINARY(16) NULL UNIQUE,
    agent_id BINARY(16) NULL,
    agent_port INT UNSIGNED NOT NULL,
    subdomain VARCHAR(255) NOT NULL UNIQUE,
    to_delete BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    FOREIGN KEY (server_id) REFERENCES Server(server_id) ON DELETE SET NULL,
    FOREIGN KEY (agent_id) REFERENCES Agent(agent_id) ON DELETE SET NULL
);

CREATE TABLE Module (
    module_id BINARY(16) PRIMARY KEY,
    server_id BINARY(16) NOT NULL,
    module_name VARCHAR(255) NOT NULL,
    module_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    module_type ENUM(${MODULE_TYPES.map((r) => `'${r}'`).join(',')}) NOT NULL,
    module_metadata JSON NULL,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
    FOREIGN KEY (server_id) REFERENCES Server(server_id) ON DELETE CASCADE,
    INDEX (server_id)
);

SET FOREIGN_KEY_CHECKS = 1;
`

const init_tables = async () => {
    try {
        await initialise_redis()
        await redis_client.flushall()
        logger.info({}, 'Redis flushed successfully')
        await pool.query(SQLSTATEMENT)
        logger.info({}, 'Tables initialised successfully')
        process.exit()
    } catch (error) {
        logger.error({err: error}, 'Failed to initialise tables')
        process.exit(1)
    }
}

init_tables()
