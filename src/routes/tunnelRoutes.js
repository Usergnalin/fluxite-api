import express from 'express'
const router = express.Router()
import * as rate_limiter from '../providers/rateLimiter.js'
import * as agent_controller from '../controllers/agentController.js'
import * as global_controller from '../controllers/globalController.js'
import * as agent_auth_handler from '../middlewares/agentAuthHandler.js'

// Create new tunnel (user)
// router.post(
//     '/',
//     rate_limiter.slow,
//     global_controller.load_body_data({fields: ['username', 'password'], data_path: 'user_data'}),
//     password_handler.hash_password(),
//     user_controller.create_user(),
//     global_controller.send_data({data_path: 'user_team_data'}),
// )

// Authenticate frpc login request (frps)
router.post(
    '/login',
    rate_limiter.fast,
    global_controller.load_body_data({fields: ['content'], data_path: 'tunnel_login_data'}),
    agent_controller.get_agent_by_agent_id({fields: ['public_key'], agent_id_path: 'tunnel_login_data.content.metas.agent_id'}),
    agent_auth_handler.verify_token_signature(),
    global_controller.send_data_fixed({data: {reject: false, unchange: false}, status_code: 200}),
)

export default router
