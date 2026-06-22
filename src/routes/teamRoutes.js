import express from 'express'
const router = express.Router()
import * as rate_limiter from '../providers/rateLimiter.js'
import * as session_handler from '../middlewares/sessionHandler.js'
import * as global_controller from '../controllers/globalController.js'
import * as team_controller from '../controllers/teamController.js'

// Create new free team (user)
router.post(
    '/',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_body_data({fields: ['team_name'], data_path: 'team_data'}),
    team_controller.create_free_team(),
    global_controller.send_data({data_path: 'team_data'}),
)

// Create invite code (user)
router.post(
    '/:team_id/invite',
    rate_limiter.slow,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'team_id', data_path: 'team_id'}),
    global_controller.load_body_data({fields: ['role'], data_path: 'team_data'}),
    team_controller.check_invite_access_by_user_id_and_requested_role(),
    team_controller.create_team_invite_code(),
    global_controller.send_data({data_path: 'invite_code'}),
)

// Join team by invite code (user)
router.post(
    '/join',
    rate_limiter.slow,
    session_handler.verify_session_token(),
    global_controller.load_body_data({fields: ['invite_code'], data_path: 'team_data'}),
    team_controller.join_by_invite_code({user_id_path: 'user_id', invite_code_path: 'team_data.invite_code'}),
    global_controller.send_empty(),
)

// Get all data by team id (user)
router.get(
    '/:team_id',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'team_id', data_path: 'team_id'}),
    team_controller.check_access_by_user_id_and_role({role: ['viewer', 'moderator', 'operator', 'admin', 'owner']}),
    team_controller.get_all_data_by_team_id({
        agent_fields: ['agent_id', 'agent_name', 'agent_status', 'updated_at', 'revision', 'last_online', 'tunnel_ip'],
        command_fields: ['agent_id', 'command_id', 'command', 'command_status', 'created_at', 'updated_at', 'command_feedback', 'revision'],
        server_fields: ['agent_id', 'server_id', 'server_name', 'server_status', 'server_port', 'server_thumbnail', 'properties', 'revision', 'last_online'],
        module_fields: ['server_id', 'module_id', 'module_name', 'module_type', 'module_enabled', 'module_metadata', 'revision'],
        tunnel_fields: ['tunnel_id', 'server_id', 'agent_id', 'agent_port', 'subdomain', 'to_delete', 'created_at', 'updated_at', 'revision'],
    }),
    global_controller.send_data({data_path: 'data'}),
)

// Stream all data by team id (user)
router.get(
    '/:team_id/stream',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'team_id', data_path: 'team_id'}),
    team_controller.check_access_by_user_id_and_role({role: ['viewer', 'moderator', 'operator', 'admin', 'owner']}),
    team_controller.stream_all_data_by_team_id({
        agent_fields: ['agent_id', 'agent_name', 'agent_status', 'updated_at', 'revision', 'last_online', 'tunnel_ip'],
        command_fields: ['agent_id', 'command_id', 'command', 'command_status', 'created_at', 'updated_at', 'command_feedback', 'revision'],
        server_fields: ['agent_id', 'server_id', 'server_name', 'server_status', 'server_port', 'server_thumbnail', 'properties', 'revision', 'last_online'],
        module_fields: ['server_id', 'module_id', 'module_name', 'module_type', 'module_enabled', 'module_metadata', 'revision'],
        tunnel_fields: ['tunnel_id', 'server_id', 'agent_id', 'agent_port', 'subdomain', 'to_delete', 'created_at', 'updated_at', 'revision'],
    }),
)

export default router
