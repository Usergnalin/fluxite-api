import {Worker} from 'bullmq'
import fetch_loaders from '../services/fetchLoaders.js'
import sync_tunnels from '../services/syncTunnels.js'
import delete_commands from '../services/deleteCommands.js'
import {redis_client} from '../providers/redis.js'

const _fetch_loaders_worker = new Worker(
    'fetch_loaders',
    async () => { await fetch_loaders() },
    {
        connection: redis_client,
        lockDuration: 600000,
        stalledInterval: 600000,
    }
)

const _tunnel_sync_worker = new Worker(
    'tunnel_sync',
    async () => { await sync_tunnels() },
    {
        connection: redis_client,
        lockDuration: 60000,
        stalledInterval: 60000,
    }
)

const _delete_commands_worker = new Worker(
    'delete_commands',
    async () => { await delete_commands() },
    {
        connection: redis_client,
        lockDuration: 60000,
        stalledInterval: 60000,
    }
)
