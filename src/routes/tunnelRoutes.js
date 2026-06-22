import express from 'express'
const router = express.Router()
import * as session_handler from '../middlewares/sessionHandler.js'
import * as server_controller from '../controllers/serverController.js'
import * as rate_limiter from '../providers/rateLimiter.js'
import * as global_controller from '../controllers/globalController.js'
import * as tunnel_controller from '../controllers/tunnelController.js'

// // Create new tunnel with no associated server (user)
// // TODO need to add quotas
// router.post(
//     '/agent/:agent_id',
//     rate_limiter.normal,
//     session_handler.verify_session_token(),
//     global_controller.load_param_data({field: 'agent_id', data_path: 'agent_id'}),
//     agent_controller.check_access_by_user_id_and_role({role: ['operator', 'admin', 'owner']}),   
//     // TODO: Check if tunnel creation is allowed for the agent's team
//     global_controller.load_body_data({fields: ['agent_port', 'tunnel_name'], data_path: 'tunnel_data'}),
//     tunnel_controller.create_agent_tunnel({agent_id_path: 'agent_id'}),
//     global_controller.send_data({data_path: 'tunnel_data'}),
// )

// Create new tunnel with associated server (user)
router.post(
    '/server/:server_id',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'server_id', data_path: 'server_id'}),
    server_controller.check_access_by_user_id_and_role({role: ['operator', 'admin', 'owner']}),
    tunnel_controller.create_server_tunnel({server_id_path: 'server_id'}),
    global_controller.send_data({data_path: 'tunnel_data'}),
)

// Delete tunnel by tunnel id (user)
router.delete(
    '/:tunnel_id',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_param_data({field: 'tunnel_id', data_path: 'tunnel_id'}),
    tunnel_controller.check_access_by_user_id_and_role({role: ['operator', 'admin', 'owner']}),
    tunnel_controller.delete_by_tunnel_id(),
    global_controller.send_empty(),
)
export default router
