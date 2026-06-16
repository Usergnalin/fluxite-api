import logger from './src/providers/logger.js'
import {initialise_redis} from './src/providers/redis.js'
import agent_startup from './src/startup/agentStatus.js'
import {LOADER_UPDATE_INTERVAL, TUNNEL_SYNC_INTERVAL} from './src/configs/constants.js'
import ms from 'ms'
import './src/providers/bullmq.js'
import {Queue} from 'bullmq'

const app_port = process.env.APP_PORT

const start_server = async () => {
    try {
        await initialise_redis()
        await agent_startup()
        const fetch_loaders = new Queue('fetch_loaders', {connection: {host: process.env.REDIS_HOST, port: 6379}})
        fetch_loaders.add('fetch_loaders', {},  {repeat: { every: ms(LOADER_UPDATE_INTERVAL) }})
        const tunnel_sync = new Queue('tunnel_sync', {connection: {host: process.env.REDIS_HOST, port: 6379}})
        tunnel_sync.add('tunnel_sync', {}, {repeat: {every: ms(TUNNEL_SYNC_INTERVAL)}})
        const {default: app} = await import('./src/app.js')
        // TODO: Add wireguard peer sync
        app.listen(app_port, () => logger.info({port: app_port}, 'Server successfully started'))
    } catch (error) {
        logger.fatal({err: error}, 'Failed to start server')
        process.exit(1)
    }
}

start_server()
