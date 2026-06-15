import pool from '../providers/db.js'
import {db_events} from '../providers/events.js'
import {v7 as uuid} from 'uuid'
import {nanoid} from 'nanoid-nice'
import {format_columns_select} from '../utils.js'
import {MIN_SUBDOMAIN_SLUG_LENGTH, MAX_SUBDOMAIN_SLUG_LENGTH, TUNNEL_COLUMNS} from '../configs/constants.js'

const formatted_tunnel_columns = format_columns_select(TUNNEL_COLUMNS, 'Tunnel')

export const insert_agent_tunnel = async (agent_id, data) => {
    const connection = await pool.getConnection()
    const tunnel_id = uuid()
    try {
        for (let subdomain_length = MIN_SUBDOMAIN_SLUG_LENGTH; subdomain_length <= MAX_SUBDOMAIN_SLUG_LENGTH; subdomain_length++) {
            try {
                await connection.beginTransaction()
                const subdomain = `${data.tunnel_name}-${nanoid(subdomain_length).toLowerCase()}`
                const [insert_results] = await connection.execute(`INSERT INTO Tunnel (tunnel_id, agent_id, agent_port, subdomain) VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)`, [
                    tunnel_id,
                    agent_id,
                    data.agent_port,
                    subdomain,
                ])
                const [select_results] = await connection.execute(`
                    SELECT BIN_TO_UUID(Agent.team_id) as team_id, ${formatted_tunnel_columns}, INET_NTOA(Agent.tunnel_ip) as tunnel_ip
                    FROM Tunnel
                    INNER JOIN Agent ON Tunnel.agent_id = Agent.agent_id
                    WHERE Tunnel.tunnel_id = UUID_TO_BIN(?)`,
                    [tunnel_id],
                )
                const routing_response = await fetch(process.env.ROUTING_API_ENDPOINT, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        serverAddress: `${subdomain}.${process.env.TUNNEL_DOMAIN}`,
                        backend: `${select_results[0].tunnel_ip}:${data.agent_port}`,
                    }),
                })
                if (!routing_response.ok) {
                    await connection.rollback()
                    return null
                }
                await connection.commit()
                const payload = select_results[0]
                db_events.emit(`create:tunnel:tunnel:${payload.tunnel_id}`, payload)
                db_events.emit(`create:tunnel:agent:${payload.agent_id}`, payload)
                db_events.emit(`create:tunnel:team:${payload.team_id}`, payload)
                return {...insert_results, data: payload}
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    continue
                }
                await connection.rollback()
                throw error
            } 
        } 
        return null
    } finally {
        connection.release()
    }
}

export const insert_server_tunnel = async (server_id) => {
    const connection = await pool.getConnection()
    const tunnel_id = uuid()
    try {
        for (let subdomain_length = MIN_SUBDOMAIN_SLUG_LENGTH; subdomain_length <= MAX_SUBDOMAIN_SLUG_LENGTH; subdomain_length++) {
            try {
                await connection.beginTransaction()
                const [insert_results] = await connection.execute(`
                    INSERT INTO Tunnel (tunnel_id, server_id, agent_id, agent_port, subdomain)
                    SELECT UUID_TO_BIN(?), server_id, agent_id, server_port, CONCAT(LOWER(SERVER_NAME), '-', ?) FROM Server WHERE server_id = UUID_TO_BIN(?)`,
                    [
                        tunnel_id,
                        nanoid(subdomain_length).toLowerCase(),
                        server_id,
                    ]
                )
                const [select_results] = await connection.execute(`
                    SELECT BIN_TO_UUID(Agent.team_id) as team_id, ${formatted_tunnel_columns}, INET_NTOA(Agent.tunnel_ip) as tunnel_ip
                    FROM Tunnel
                    INNER JOIN Agent ON Tunnel.agent_id = Agent.agent_id
                    WHERE Tunnel.tunnel_id = UUID_TO_BIN(?)`,
                    [tunnel_id],
                )
                const routing_response = await fetch(process.env.ROUTING_API_ENDPOINT, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        serverAddress: `${select_results[0].subdomain}.${process.env.TUNNEL_DOMAIN}`,
                        backend: `${select_results[0].tunnel_ip}:${select_results[0].agent_port}`,
                    }),
                })
                if (!routing_response.ok) {
                    await connection.rollback()
                    return null
                }
                await connection.commit()
                const payload = select_results[0]
                db_events.emit(`create:tunnel:tunnel:${payload.tunnel_id}`, payload)
                db_events.emit(`create:tunnel:agent:${payload.agent_id}`, payload)
                db_events.emit(`create:tunnel:team:${payload.team_id}`, payload)
                return {...insert_results, data: payload}
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    continue
                }
                await connection.rollback()
                throw error
            }
        }
        return null
    } finally {
        connection.release()
    }
}