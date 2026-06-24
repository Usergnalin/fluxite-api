import express from 'express'
const router = express.Router()
import * as rate_limiter from '../providers/rateLimiter.js'
import * as session_handler from '../middlewares/sessionHandler.js'
import * as oauth_handler from '../middlewares/oauthHandler.js'
import * as legal_compliance_handler from '../middlewares/legalComplianceHandler.js'
import * as global_controller from '../controllers/globalController.js'
import * as user_controller from '../controllers/userController.js'

// Refresh session (user)
router.post(
    '/refresh',
    rate_limiter.slow,
    session_handler.rotate_session({output_user_id_path: 'user_id', output_session_id_path: 'session_id'}),
    session_handler.generate_session_token({user_id_path: 'user_id', session_id_path: 'session_id'}),
    global_controller.send_empty(),
)

// Logout (user)
router.post(
    '/logout',
    rate_limiter.normal,
    session_handler.verify_session_token(),
    session_handler.delete_session_by_session_id(),
    session_handler.delete_token_cookies(),
    global_controller.send_empty(),
)

// Logout from all devices (user)
router.post(
    '/logoutall',
    rate_limiter.slow,
    session_handler.verify_session_token(),
    session_handler.delete_session_by_user_id(),
    session_handler.delete_token_cookies(),
    global_controller.send_empty(),
)

// Accept legal terms and login (user)
router.put(
    '/accept-legal',
    rate_limiter.slow,
    session_handler.verify_partial_login_token(),
    user_controller.update_user_legal_compliance_by_user_id(),
    session_handler.create_session(),
    session_handler.generate_session_token(),
    global_controller.send_empty(),
)

// Initalise google Oauth
router.get(
    '/google/init',
    rate_limiter.slow,
    oauth_handler.generate_oauth_url(),
    global_controller.send_data({data_path: 'oauth_url'}),
)

router.get(
    '/google/callback',
    rate_limiter.slow,
    global_controller.load_query_data({field: 'state', data_path: 'state'}),
    oauth_handler.validate_nonce(),
    global_controller.load_query_data({field: 'code', data_path: 'code'}),
    oauth_handler.exchange_code(),
    oauth_handler.get_or_create_oauth_user({provider: 'google'}),
    legal_compliance_handler.check_user_legal_compliance_by_user_id(),
    session_handler.create_session(),
    session_handler.generate_session_token(),
    global_controller.redirect({url: `https://${process.env.PANEL_BASE}/dashboard`}),
)

export default router
