import express from 'express'
const router = express.Router()
import * as rate_limiter from '../providers/rateLimiter.js'
import * as nonce_handler from '../middlewares/nonceHandler.js'
import * as session_handler from '../middlewares/sessionHandler.js'
import * as agent_auth_handler from '../middlewares/agentAuthHandler.js'
import * as global_controller from '../controllers/globalController.js'
import * as agent_controller from '../controllers/agentController.js'
import * as team_controller from '../controllers/teamController.js'
import * as log_controller from '../controllers/logController.js'

// Create new agent (agent)
router.post(
    '/',
    rate_limiter.slow,
    global_controller.load_body_data({
        fields: ['agent_name', 'public_key', 'tunnel_public_key'],
        data_path: 'agent_data',
    }),
    global_controller.load_body_data({fields: ['linking_code'], data_path: 'linking_code'}),
    agent_controller.create_agent_by_linking_code(),
    global_controller.send_data({data_path: 'agent_data'}),
)

// Create linking code (user)
router.post(
    '/:team_id/link',
    rate_limiter.slow,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'team_id', data_path: 'team_id'}),
    team_controller.check_access_by_user_id_and_role({role: ['operator', 'admin', 'owner']}),
    agent_controller.create_agent_linking_code(),
    global_controller.send_data({data_path: 'linking_code'}),
)

// Refresh agent token (agent)
router.get(
    '/:agent_id/refresh',
    rate_limiter.slow,
    nonce_handler.verify_nonce(),
    global_controller.load_param_data({field: 'agent_id', data_path: 'agent_id'}),
    agent_controller.get_agent_by_agent_id({fields: ['public_key']}),
    agent_auth_handler.verify_signature(),
    agent_auth_handler.generate_agent_token(),
)

// Get agents by team id (user)
router.get(
    '/team/:team_id',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'team_id', data_path: 'team_id'}),
    team_controller.check_access_by_user_id_and_role({role: ['viewer', 'moderator', 'operator', 'admin', 'owner']}),
    agent_controller.get_agent_by_team_id({
        fields: ['agent_id', 'agent_name', 'agent_status', 'updated_at', 'revision', 'last_online'],
    }),
    global_controller.send_data({data_path: 'agent_data'}),
)

// Stream agents by team id (user)
router.get(
    '/team/:team_id/stream',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'team_id', data_path: 'team_id'}),
    team_controller.check_access_by_user_id_and_role({role: ['viewer', 'moderator', 'operator', 'admin', 'owner']}),
    agent_controller.stream_agent_by_team_id({
        fields: ['agent_id', 'agent_name', 'agent_status', 'updated_at', 'revision', 'last_online'],
    }),
)

// Update agent by agent id (agent)
router.put(
    '/',
    rate_limiter.normal,
    agent_auth_handler.verify_agent_token(),
    global_controller.load_body_data({fields: ['agent_status'], data_path: 'agent_data'}),
    agent_controller.update_agent_by_agent_id({fields: ['agent_status']}),
    global_controller.send_empty(),
)

// Delete agent by agent id (user)
router.delete(
    '/:agent_id',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'agent_id', data_path: 'agent_id'}),
    agent_controller.check_access_by_user_id_and_role({role: ['admin', 'owner']}),
    agent_controller.delete_agent_by_agent_id(),
    global_controller.send_empty(),
)

// Stream server logs by server_id (user)
router.get(
    '/logs/:agent_id/stream',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'agent_id', data_path: 'agent_id'}),
    agent_controller.check_access_by_user_id_and_role({role: ['viewer', 'moderator', 'operator', 'admin', 'owner']}),
    global_controller.load_query_data({field: 'logs_history_lines', data_path: 'logs_history_lines'}),
    log_controller.stream_logs_by_agent_id(),
)

// Report agent logs by agent_id (agent)
router.post(
    '/logs/:agent_id',
    rate_limiter.fast,
    agent_auth_handler.verify_agent_token(),
    global_controller.load_param_data({field: 'agent_id', data_path: 'agent_id'}),
    global_controller.load_body_data({fields: ['logs', 'logs_start_line'], data_path: 'log_data'}),
    log_controller.create_agent_log(),
    global_controller.send_empty(),
)

export default router
