import express from 'express'
const router = express.Router()
import * as rate_limiter from '../providers/rateLimiter.js'
import * as global_controller from '../controllers/globalController.js'
import * as server_version_controller from '../controllers/serverVersionController.js'

// Get loaders by MC version (user)
router.get(
    '/:mc_version/loaders',
    rate_limiter.normal,
    global_controller.load_param_data({field: 'mc_version', data_path: 'mc_version'}),
    server_version_controller.get_loaders_by_mc_version(),
    global_controller.send_data({data_path: 'loaders'}),
)

// Get all MC versions
router.get(
    '/',
    rate_limiter.normal,
    server_version_controller.get_mc_versions(),
    global_controller.send_data({data_path: 'mc_versions'}),
)

export default router
