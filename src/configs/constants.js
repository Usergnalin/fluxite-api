// --- DB info ---

export const COMMAND_COLUMNS = ['command_id', 'agent_id', 'user_id', 'command', 'command_status', 'revision', 'created_at', 'updated_at', 'command_feedback']
export const AGENT_COLUMNS = ['agent_id', 'team_id', 'agent_name', 'agent_status', 'last_online', 'public_key', 'tunnel_public_key', 'tunnel_ip', 'revision', 'created_at', 'updated_at']
export const MODULE_COLUMNS = ['module_id', 'server_id', 'module_name', 'module_enabled', 'module_type', 'module_metadata', 'revision', 'created_at', 'updated_at']
export const SERVER_COLUMNS = ['server_id', 'agent_id', 'server_name', 'server_thumbnail', 'properties', 'server_status', 'last_online', 'revision', 'created_at', 'updated_at']
export const TUNNEL_COLUMNS = ['tunnel_id', 'server_id', 'agent_id', 'agent_port', 'subdomain', 'to_delete', 'created_at', 'updated_at', 'revision']

export const COMMAND_STATUS = ['pending', 'queued', 'sent', 'success', 'failure']
export const SERVER_STATUS = ['online', 'offline', 'starting', 'stopping']
export const AGENT_STATUS = ['online', 'offline']
export const TEAM_ROLES = ['viewer', 'moderator', 'operator', 'admin', 'owner']
export const MODULE_TYPES = ['mod', 'resource_pack', 'data_pack', 'plugin']

// --- Security ---

// User refresh token duration before needing login
export const USER_REFRESH_TOKEN_DURATION = '7d'
// Period of time before a refresh token reuse would not trigger a breach event
export const USER_REFRESH_TOKEN_GRACE_PERIOD = '30s'
// User session token duration before needing to refresh token
export const USER_TOKEN_DURATION = '60m' // default: 60m
// Agent session token before requiring agent signature
export const AGENT_TOKEN_DURATION = '120m'
// User token duration for partial logins before user cannot continue login
export const USER_PARTIAL_LOGIN_TOKEN_DURATION = '15m'
// JWT token signing algorithm for session and refresh tokens
export const TOKEN_ALGORITHM = 'HS256'
// Number of salt rounds for hashing passwords, increases time to hash
export const SALT_ROUNDS = 10
// Toggle https requirement of cookies
export const SECURE_COOKIE = true
// Minimum zxcvbn password score accepted
export const PASSWORD_MIN_SCORE = 2
// Period of time where Oauth nonces are kept, nonces older than this are rejected on callback
export const OAUTH_NONCE_MAX_DURATION = '10m'
// Invite permission hierarchy
export const INVITE_PERMISSIONS = {
    owner:     ['admin', 'operator', 'moderator', 'viewer'],
    admin:     ['operator', 'moderator', 'viewer'],
    operator:  ['viewer'],
    moderator: null,
    viewer:    null,
}

// --- SSE streams ---

// Period of keep alive in sse streams
export const SSE_HEARTBEAT_INTERVAL = '40s'
// Time after last keep alive where a agent would be marked offline
export const AGENT_HEARTBEAT_EXPIRY = '60s'

// -- Rate Limits ---
export const RATE_LIMIT = {
    slow: {window: '10m', limit: 10},
    normal: {window: '5m', limit: 200},
    fast: {window: '1m', limit: 200},
}

// -- Tunneling ---
// Integer starting tunnel ip 
export const NET_BASE = 2886729728 // 172.16.0.0
// Minimum offset for peer ips
export const HOST_MIN = 2 // skip .0 (network) and .1 (server)
// Maximum offset for peer ips
export const HOST_MAX = 2 ** 20 - 2 // /12 => 20 host bits
// Maximum number of retries to find an available tunnel ip before giving up
export const MAX_RETRIES = 5
// Minimum Tunnel subdomain slug length
export const MIN_SUBDOMAIN_SLUG_LENGTH = 3
// Maximum Tunnel subdomain slug length
export const MAX_SUBDOMAIN_SLUG_LENGTH = 10

// --- Other configurables ---

// Character length of team slugs
export const SLUG_LENGTH = 5
// User Agent for use in modrinth api calls
export const MODRINTH_USER_AGENT = 'Usergnalin/fluxite (usernilang@gmail.com)'
// Time before a team agent linking code expires
export const LINKING_CODE_EXPIRY = '6h'
// Time before a team invite code expires
export const INVITE_CODE_EXPIRY = '6h'
// Period of time where nonces are kept, nonces older than this are rejected
export const NONCE_MAX_DURATION = '1m'
// Max body size of json requests
export const JSON_MAX_BODY_SIZE = '10mb'
// Interval of scraping of new mc and loader versions
export const LOADER_UPDATE_INTERVAL = '6h'
// Interval of syncing of tunnel server and process deletes
export const TUNNEL_SYNC_INTERVAL = '1m'
// Current legal compliance version
export const LEGAL_COMPLIANCE_VERSION = 1

export const CONSTANTS = {
    COMMAND_STATUS,
    SERVER_STATUS,
    AGENT_STATUS,
    TEAM_ROLES,
    USER_REFRESH_TOKEN_DURATION,
    USER_REFRESH_TOKEN_GRACE_PERIOD,
    USER_TOKEN_DURATION,
    AGENT_TOKEN_DURATION,
    TOKEN_ALGORITHM,
    SALT_ROUNDS,
    SECURE_COOKIE,
    PASSWORD_MIN_SCORE,
    SSE_HEARTBEAT_INTERVAL,
    AGENT_HEARTBEAT_EXPIRY,
    SLUG_LENGTH,
    MODRINTH_USER_AGENT,
    LINKING_CODE_EXPIRY,
    INVITE_CODE_EXPIRY,
    NONCE_MAX_DURATION,
    RATE_LIMIT,
    MODULE_TYPES,
    JSON_MAX_BODY_SIZE,
    COMMAND_COLUMNS,
    AGENT_COLUMNS,
    MODULE_COLUMNS,
    SERVER_COLUMNS,
    TUNNEL_COLUMNS,
    NET_BASE,
    HOST_MIN,
    HOST_MAX,
    MAX_RETRIES,
    MIN_SUBDOMAIN_SLUG_LENGTH,
    MAX_SUBDOMAIN_SLUG_LENGTH,
    LEGAL_COMPLIANCE_VERSION,
    OAUTH_NONCE_MAX_DURATION,
    LOADER_UPDATE_INTERVAL,
    INVITE_PERMISSIONS,
}

export const read_constants = async (req, res, next) => {
    try {
        return res.status(200).json(CONSTANTS)
    } catch (error) {
        next(error)
    }
}
