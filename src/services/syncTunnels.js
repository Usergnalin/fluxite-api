import logger from  '../providers/logger.js'
import * as tunnel_model from '../models/tunnelModel.js'

const ROUTING_API_ENDPOINT = process.env.ROUTING_API_ENDPOINT
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN

import pLimit from 'p-limit'

const limit = pLimit(20)

const register_tunnels = async (tunnels) => {
  await Promise.allSettled(
    tunnels.map(tunnel => limit(async () => {
      const response = await fetch(ROUTING_API_ENDPOINT, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          serverAddress: `${tunnel.subdomain}.${TUNNEL_DOMAIN}`,
          backend: `${tunnel.tunnel_ip}:${tunnel.agent_port}`,
        }),
      })
      if (!response.ok) {
        logger.error({ tunnel, status: response.status }, 'Failed to register tunnel')
      }
    }))
  )
}

const delete_tunnels = async (subdomains) => {
  await Promise.allSettled(
    subdomains.map(subdomain => limit(async () => {
      const response = await fetch(
        `${ROUTING_API_ENDPOINT}/${subdomain}.${TUNNEL_DOMAIN}`,
        { method: 'DELETE' }
      )
      if (!response.ok && response.status !== 404) {
        logger.error({ subdomain, status: response.status }, 'Failed to delete tunnel')
      }
    }))
  )
}

const delete_tunnel_full = async (tunnel) => {
  const response = await fetch(`${ROUTING_API_ENDPOINT}/${tunnel.subdomain}.${TUNNEL_DOMAIN}`, {method: 'DELETE'})
  if (response.ok || response.status === 404) {
    try {
        await tunnel_model.delete_by_tunnel_id(tunnel.tunnel_id)
    } catch (error) {
        logger.error({ tunnel, error }, 'Failed to delete tunnel from db')
    }
  } else {
    logger.error({ tunnel, status: response.status }, 'Failed to delete tunnel on routing api')
  }
}

const delete_tunnels_to_delete = async (tunnels_to_delete_fully) => {
  await Promise.allSettled(
    tunnels_to_delete_fully.map(tunnel => limit(() => delete_tunnel_full(tunnel)))
  )
}

export default async () => {
  try {
    logger.info({}, 'Syncing tunnels')
    const [active_tunnels, db_tunnels] = await Promise.all([
      fetch(process.env.ROUTING_API_ENDPOINT).then(r => r.json()),
      tunnel_model.select_all(['tunnel_id', 'subdomain', 'agent_port', 'updated_at'], ['tunnel_ip'])
    ])

    const active_subdomains = new Set()
    for (const address of Object.keys(active_tunnels)) {
      const subdomain = address.replace(/\.(fluxite\.io|craftedconsole\.app)$/, '')
      active_subdomains.add(subdomain)
    }

    const db_subdomains = new Set()
    const now = new Date()
    const five_minutes_ago = new Date(now.getTime() - 5 * 60 * 1000)

    const tunnels_to_add = []
    for (const tunnel of db_tunnels) {
      db_subdomains.add(tunnel.subdomain)
      if (!active_subdomains.has(tunnel.subdomain)) {
        const updated_at = new Date(tunnel.updated_at)
        if (updated_at < five_minutes_ago) {
          tunnels_to_add.push({
            subdomain: tunnel.subdomain,
            tunnel_ip: tunnel.tunnel_ip,
            agent_port: tunnel.agent_port
          })
        }
      }
    }

    const tunnels_to_delete = []
    for (const address of Object.keys(active_tunnels)) {
      const subdomain = address.replace(/\.(fluxite\.io|craftedconsole\.app)$/, '')
      if (!db_subdomains.has(subdomain)) {
        tunnels_to_delete.push(subdomain)
      }
    }

    logger.info({ "To Add": tunnels_to_add, "To Delete": tunnels_to_delete }, 'Tunnels to sync')

    await register_tunnels(tunnels_to_add)
    await delete_tunnels(tunnels_to_delete)

    logger.info({}, 'Syncing tunnels complete')
    logger.info({}, 'Processing tunnel deletion')

    const tunnels_to_delete_fully = await tunnel_model.select_all_to_delete(['subdomain', 'tunnel_id'])

    await delete_tunnels_to_delete(tunnels_to_delete_fully)

    logger.info({}, 'Tunnel deletion complete')

    return
  } catch (error) {
    logger.error({ error }, 'Error while syncing tunnels')
  }
}