import express from 'express'
const router = express.Router()
import * as rate_limiter from '../providers/rateLimiter.js'
import * as session_handler from '../middlewares/sessionHandler.js'
import * as agent_auth_handler from '../middlewares/agentAuthHandler.js'
import * as global_controller from '../controllers/globalController.js'
import * as agent_controller from '../controllers/agentController.js'
import * as server_controller from '../controllers/serverController.js'
import * as log_controller from '../controllers/logController.js'

// Create new server (agent)
router.post(
    '/',
    rate_limiter.normal,
    agent_auth_handler.verify_agent_token(),
    global_controller.load_body_data({fields: ['server_id', 'server_name', 'server_port', 'properties'], data_path: 'server_data'}),
    server_controller.create_server(),
    global_controller.send_empty(),
)

// Update server status (agent)
router.put(
    '/:server_id/status',
    rate_limiter.normal,
    agent_auth_handler.verify_agent_token(),
    global_controller.load_param_data({field: 'server_id', data_path: 'server_id'}),
    global_controller.load_body_data({fields: ['server_status'], data_path: 'server_data'}),
    server_controller.check_access_by_agent_id(),
    server_controller.update_by_server_id({fields: ['server_status']}),
    global_controller.send_empty(),
)

// Update server properties (agent)
router.put(
    '/:server_id/properties/agent',
    rate_limiter.normal,
    agent_auth_handler.verify_agent_token(),
    global_controller.load_param_data({field: 'server_id', data_path: 'server_id'}),
    global_controller.load_body_data({fields: ['properties'], data_path: 'server_data'}),
    server_controller.check_access_by_agent_id(),
    server_controller.update_by_server_id({fields: ['properties']}),
    global_controller.send_empty(),
)

// Update server thumbnail (agent)
router.put(
    '/:server_id/thumbnail/agent',
    rate_limiter.normal,
    agent_auth_handler.verify_agent_token(),
    global_controller.load_param_data({field: 'server_id', data_path: 'server_id'}),
    global_controller.load_body_data({fields: ['server_thumbnail'], data_path: 'server_data'}),
    server_controller.check_access_by_agent_id(),
    server_controller.update_by_server_id({fields: ['server_thumbnail']}),
    global_controller.send_empty(),
)

// Delete server (agent)
router.delete(
    '/:server_id',
    rate_limiter.normal,
    agent_auth_handler.verify_agent_token(),
    global_controller.load_param_data({field: 'server_id', data_path: 'server_id'}),
    server_controller.check_access_by_agent_id(),
    server_controller.delete_server_by_server_id(),
    global_controller.send_empty(),
)

// Get server details by server id (user)
router.get(
    '/:server_id',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'server_id', data_path: 'server_id'}),
    server_controller.check_access_by_user_id_and_role({role: ['viewer', 'moderator', 'operator', 'admin', 'owner']}),
    server_controller.get_server_by_server_id({fields: ['server_name', 'properties', 'server_status', 'server_thumbnail', 'revision', 'last_online']}),
    global_controller.send_data({data_path: 'server_data'}),
)

// Get server details by agent id (user)
router.get(
    '/agent/:agent_id',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'agent_id', data_path: 'agent_id'}),
    agent_controller.check_access_by_user_id_and_role({role: ['viewer', 'moderator', 'operator', 'admin', 'owner']}),
    server_controller.get_server_by_agent_id({fields: ['server_id', 'server_name', 'server_status', 'server_thumbnail', 'revision', 'last_online']}),
    global_controller.send_data({data_path: 'server_data'}),
)

// Stream server details by agent id (user)
router.get(
    '/agent/:agent_id/stream',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'agent_id', data_path: 'agent_id'}),
    agent_controller.check_access_by_user_id_and_role({role: ['viewer', 'moderator', 'operator', 'admin', 'owner']}),
    server_controller.stream_server_by_agent_id({fields: ['server_id', 'server_name', 'server_status', 'server_thumbnail', 'revision', 'last_online']}),
)

// Stream server details by server id (user)
router.get(
    '/:server_id/stream',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'server_id', data_path: 'server_id'}),
    server_controller.check_access_by_user_id_and_role({role: ['viewer', 'moderator', 'operator', 'admin', 'owner']}),
    server_controller.stream_server_by_server_id({fields: ['server_name', 'server_status', 'properties', 'server_thumbnail', 'revision', 'last_online']}),
)

// Stream server logs by server_id (user)
router.get(
    '/logs/:server_id/stream',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'server_id', data_path: 'server_id'}),
    server_controller.check_access_by_user_id_and_role({role: ['viewer', 'moderator', 'operator', 'admin', 'owner']}),
    global_controller.load_query_data({field: 'logs_history_lines', data_path: 'logs_history_lines'}),
    log_controller.stream_logs_by_server_id(),
)

// Report server logs by server_id (agent)
router.post(
    '/logs/:server_id',
    rate_limiter.fast,
    agent_auth_handler.verify_agent_token(),
    global_controller.load_param_data({field: 'server_id', data_path: 'server_id'}),
    global_controller.load_body_data({fields: ['logs', 'logs_start_line'], data_path: 'log_data'}),
    log_controller.create_server_log(),
    global_controller.send_empty(),
)

export default router
