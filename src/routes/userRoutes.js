import express from 'express'
const router = express.Router()
import * as rate_limiter from '../providers/rateLimiter.js'
import * as session_handler from '../middlewares/sessionHandler.js'
import * as global_controller from '../controllers/globalController.js'
import * as user_controller from '../controllers/userController.js'

// Get user details by id (user)
router.get(
    '/',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    user_controller.get_user_by_user_id_with_team({
        user_fields: ['user_id', 'username', 'created_at', 'revision'],
        user_team_fields: ['role', 'revision'],
        team_fields: ['team_id', 'team_name', 'slug', 'revision'],
    }),
    global_controller.send_data({data_path: 'user_data'}),
)

// Update username by id (user)
router.put(
    '/username',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    global_controller.load_body_data({fields: ['username'], data_path: 'user_data'}),
    user_controller.update_user_by_user_id({fields: ['username']}),
    global_controller.send_empty(),
)

export default router
