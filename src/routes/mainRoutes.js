import express from 'express'
const router = express.Router()
import userRoutes from './userRoutes.js'
import authRoutes from './authRoutes.js'
import teamRoutes from './teamRoutes.js'
import agentRoutes from './agentRoutes.js'
import commandRoutes from './commandRoutes.js'
import serverRoutes from './serverRoutes.js'
import moduleRoutes from './moduleRoutes.js'
import serverVersionRoutes from './serverVersionRoutes.js'
import tunnelRoutes from './tunnelRoutes.js'
import {read_constants} from '../configs/constants.js'

router.use('/user', userRoutes)
router.use('/auth', authRoutes)
router.use('/team', teamRoutes)
router.use('/agent', agentRoutes)
router.use('/command', commandRoutes)
router.use('/server', serverRoutes)
router.use('/module', moduleRoutes)
router.use('/version', serverVersionRoutes)
router.use('/tunnel', tunnelRoutes)

router.get('/constants', read_constants)

export default router
