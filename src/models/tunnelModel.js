import pool from '../providers/db.js'
import {db_events} from '../providers/events.js'
import {v7 as uuid} from 'uuid'
import {nanoid} from 'nanoid-nice'
import slug from 'limax'
import {format_columns_select} from '../utils.js'
import {MIN_SUBDOMAIN_SLUG_LENGTH, MAX_SUBDOMAIN_SLUG_LENGTH, TUNNEL_COLUMNS, TEAM_TYPES} from '../configs/constants.js'

const formatted_tunnel_columns = format_columns_select(TUNNEL_COLUMNS, 'Tunnel')

// Need to add quotas
// export const insert_agent_tunnel = async (agent_id, data) => {
//     const connection = await pool.getConnection()
//     const tunnel_id = uuid()
//     try {
//         for (let subdomain_length = MIN_SUBDOMAIN_SLUG_LENGTH; subdomain_length <= MAX_SUBDOMAIN_SLUG_LENGTH; subdomain_length++) {
//             try {
//                 await connection.beginTransaction()
//                 const subdomain = `${data.tunnel_name}-${nanoid(subdomain_length).toLowerCase()}`
//                 const [insert_results] = await connection.execute(`INSERT INTO Tunnel (tunnel_id, agent_id, agent_port, subdomain) VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)`, [
//                     tunnel_id,
//                     agent_id,
//                     data.agent_port,
//                     subdomain,
//                 ])
//                 const [select_results] = await connection.execute(`
//                     SELECT BIN_TO_UUID(Agent.team_id) as team_id, ${formatted_tunnel_columns}, INET_NTOA(Agent.tunnel_ip) as tunnel_ip
//                     FROM Tunnel
//                     INNER JOIN Agent ON Tunnel.agent_id = Agent.agent_id
//                     WHERE Tunnel.tunnel_id = UUID_TO_BIN(?)`,
//                     [tunnel_id],
//                 )
//                 const routing_response = await fetch(process.env.ROUTING_API_ENDPOINT, {
//                     method: 'POST',
//                     headers: {'Content-Type': 'application/json'},
//                     body: JSON.stringify({
//                         serverAddress: `${subdomain}.${process.env.TUNNEL_DOMAIN}`,
//                         backend: `${select_results[0].tunnel_ip}:${data.agent_port}`,
//                     }),
//                 })
//                 if (!routing_response.ok) {
//                     await connection.rollback()
//                     return null
//                 }
//                 await connection.commit()
//                 const payload = select_results[0]
//                 db_events.emit(`create:tunnel:tunnel:${payload.tunnel_id}`, payload)
//                 db_events.emit(`create:tunnel:agent:${payload.agent_id}`, payload)
//                 db_events.emit(`create:tunnel:team:${payload.team_id}`, payload)
//                 return {...insert_results, data: payload}
//             } catch (error) {
//                 if (error.code === 'ER_DUP_ENTRY') {
//                     continue
//                 }
//                 await connection.rollback()
//                 throw error
//             } 
//         } 
//         return null
//     } finally {
//         connection.release()
//     }
// }

export const insert_server_tunnel = async (server_id) => {
    const connection = await pool.getConnection()
    const tunnel_id = uuid()

    try {
        const [server_rows] = await connection.execute(`
            SELECT BIN_TO_UUID(Agent.agent_id) as agent_id, BIN_TO_UUID(Agent.team_id) as team_id, Server.server_port, Server.server_name
            FROM Server
            INNER JOIN Agent ON Server.agent_id = Agent.agent_id
            WHERE Server.server_id = UUID_TO_BIN(?)`,
            [server_id]
        )
        if (server_rows.length === 0) return null
        const { agent_id, team_id, server_port, server_name } = server_rows[0]

        for (let len = MIN_SUBDOMAIN_SLUG_LENGTH; len <= MAX_SUBDOMAIN_SLUG_LENGTH; len++) {
            await connection.beginTransaction()
            try {
                const [team_rows] = await connection.execute(`
                    SELECT team_type FROM Team WHERE team_id = UUID_TO_BIN(?) FOR UPDATE`,
                    [team_id]
                )
                if (team_rows.length === 0) {
                    await connection.rollback()
                    return {team_not_found: 1}
                }
                const max_tunnels = TEAM_TYPES[team_rows[0].team_type].max_tunnels
                const [[quota_results]] = await connection.execute(`
                    SELECT COUNT(*) >= ? AS quota_exceeded
                    FROM Tunnel
                    INNER JOIN Agent ON Tunnel.agent_id = Agent.agent_id
                    WHERE Agent.team_id = UUID_TO_BIN(?)`,
                    [max_tunnels, team_id]
                )
                if (quota_results.quota_exceeded) {
                    await connection.rollback()
                    return quota_results
                }
                const subdomain = `${slug(server_name)}-${nanoid(len).toLowerCase()}`
                await connection.execute(`
                    INSERT INTO Tunnel (tunnel_id, server_id, agent_id, agent_port, subdomain)
                    VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)`,
                    [tunnel_id, server_id, agent_id, server_port, subdomain]
                )

                const [tunnel_rows] = await connection.execute(`
                    SELECT BIN_TO_UUID(Agent.team_id) as team_id, ${formatted_tunnel_columns}, INET_NTOA(Agent.tunnel_ip) as tunnel_ip
                    FROM Tunnel
                    INNER JOIN Agent ON Tunnel.agent_id = Agent.agent_id
                    WHERE Tunnel.tunnel_id = UUID_TO_BIN(?)`,
                    [tunnel_id]
                )

                const routing_response = await fetch(process.env.ROUTING_API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        serverAddress: `${subdomain}.${process.env.TUNNEL_DOMAIN}`,
                        backend: `${tunnel_rows[0].tunnel_ip}:${tunnel_rows[0].agent_port}`,
                    }),
                })

                if (!routing_response.ok) {
                    await connection.rollback()
                    return {routing_failed: 1}
                }

                await connection.commit()
                const payload = tunnel_rows[0]
                db_events.emit(`create:tunnel:tunnel:${payload.tunnel_id}`, payload)
                db_events.emit(`create:tunnel:agent:${payload.agent_id}`, payload)
                db_events.emit(`create:tunnel:team:${payload.team_id}`, payload)
                return { data: payload }
            } catch (error) {
                await connection.rollback()
                if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage?.includes('subdomain')) {
                    continue
                }
                throw error
            }
        }
        return {subdomain_allocation_failed: 1}
    } finally {
        connection.release()
    }
}

// export const delete_by_tunnel_id = async (tunnel_id) => {
//     const [select_results] = await pool.execute(`
//         SELECT 
//         BIN_TO_UUID(Tunnel.tunnel_id) as tunnel_id,
//         BIN_TO_UUID(Tunnel.server_id) as server_id,
//         BIN_TO_UUID(Tunnel.agent_id) as agent_id,
//         BIN_TO_UUID(Agent.team_id) as team_id
//         FROM Tunnel
//         INNER JOIN Agent ON Tunnel.agent_id = Agent.agent_id
//         WHERE Tunnel.tunnel_id = UUID_TO_BIN(?) AND Tunnel.to_delete = FALSE`,
//         [tunnel_id]
//     ) 
//     if (select_results.length === 0) return {affectedRows: 0}
//     const { server_id, agent_id, team_id } = select_results[0]
//     const [update_results] = await pool.execute(
//         'UPDATE Tunnel SET to_delete = TRUE WHERE tunnel_id = UUID_TO_BIN(?)', 
//         [tunnel_id]
//     )
//     const payload = { tunnel_id, server_id, agent_id, team_id }
//     db_events.emit(`update:tunnel:tunnel:${tunnel_id}`, payload)
//     db_events.emit(`update:tunnel:agent:${agent_id}`, payload)
//     if (server_id) db_events.emit(`delete:tunnel:server:${server_id}`, payload)
//     db_events.emit(`update:tunnel:team:${team_id}`, payload)
//     return update_results
// }

export const delete_by_tunnel_id = async (tunnel_id) => {
    const [select_results] = await pool.execute(`
        SELECT
        BIN_TO_UUID(Server.agent_id) as agent_id,
        BIN_TO_UUID(Agent.team_id) as team_id,
        BIN_TO_UUID(Server.server_id) as server_id
        FROM Tunnel
        INNER JOIN Agent ON Tunnel.agent_id = Agent.agent_id
        LEFT JOIN Server ON Tunnel.server_id = Server.server_id
        WHERE Tunnel.tunnel_id = UUID_TO_BIN(?)`,
        [tunnel_id],
    )
    if (select_results.length === 0) return {affectedRows: 0}
    const {server_id, agent_id, team_id} = select_results[0]
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        const [delete_results] = await connection.execute('DELETE FROM Tunnel WHERE tunnel_id = UUID_TO_BIN(?)', [tunnel_id])
        await connection.commit()
        const payload = {tunnel_id, agent_id, server_id, team_id}
        db_events.emit(`delete:tunnel:tunnel:${tunnel_id}`, payload)
        if (server_id) db_events.emit(`delete:tunnel:server:${server_id}`, payload)
        db_events.emit(`delete:tunnel:agent:${agent_id}`, payload)
        db_events.emit(`delete:tunnel:team:${team_id}`, payload)
        return delete_results
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

export const update_by_tunnel_id = async (tunnel_id, data, columns) => {
    const fields = []
    const values = []
    columns.forEach((column) => {
        if (data[column] !== undefined) {
            let value = data[column]
            fields.push(`${column} = ?`)
            values.push(value)
        }
    })
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        const [update_results] = await connection.execute(
            `
            UPDATE Tunnel 
            SET ${fields.join(', ')}, revision = revision + 1
            WHERE tunnel_id = UUID_TO_BIN(?)`,
            [...values, tunnel_id],
        )
        if (update_results.affectedRows === 0) {
            await connection.rollback()
            return update_results
        }
        const [select_results] = await connection.execute(`
            SELECT
            BIN_TO_UUID(Agent.team_id) as team_id,
            BIN_TO_UUID(Tunnel.agent_id) as agent_id,
            BIN_TO_UUID(Server.server_id) as server_id,
            ${formatted_tunnel_columns}
            FROM Tunnel
            INNER JOIN Agent ON Tunnel.agent_id = Agent.agent_id
            LEFT JOIN Server ON Tunnel.server_id = Server.server_id
            WHERE Tunnel.tunnel_id = UUID_TO_BIN(?)`,
            [tunnel_id],
        )
        await connection.commit()
        const payload = select_results[0]
        db_events.emit(`update:tunnel:tunnel:${payload.tunnel_id}`, payload)
        if (payload.server_id) db_events.emit(`update:tunnel:server:${payload.server_id}`, payload)
        db_events.emit(`update:tunnel:agent:${payload.agent_id}`, payload)
        db_events.emit(`update:tunnel:team:${payload.team_id}`, payload)
        return update_results
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

export const check_access_by_user_id_and_role = async (user_id, tunnel_id, role) => {
    const results = await pool.query(
        `
        SELECT
        EXISTS (
            SELECT 1 FROM User WHERE user_id = UUID_TO_BIN(?)
        ) AS user_exists,

        EXISTS (
            SELECT 1 FROM Tunnel WHERE tunnel_id = UUID_TO_BIN(?)
        ) AS tunnel_exists,

        EXISTS (
            SELECT 1
            FROM UserTeam
            JOIN Agent ON UserTeam.team_id = Agent.team_id
            JOIN Tunnel ON Agent.agent_id = Tunnel.agent_id
            WHERE UserTeam.user_id = UUID_TO_BIN(?)
                AND Tunnel.tunnel_id = UUID_TO_BIN(?)
                AND UserTeam.role IN (?)
        ) AS has_access`,
        [user_id, tunnel_id, user_id, tunnel_id, role],
    )
    return results[0][0]
}

export const select_all = async (tunnel_columns, agent_columns) => {
    const [results] = await pool.execute(`
        SELECT ${format_columns_select(tunnel_columns, 'Tunnel')}, ${format_columns_select(agent_columns, "Agent")} FROM Tunnel
        JOIN Agent ON Tunnel.agent_id = Agent.agent_id`
    )
    return results
}

export const select_all_to_delete = async (columns) => {
    const [results] = await pool.execute(`
        SELECT ${format_columns_select(columns, 'Tunnel')} FROM Tunnel
        WHERE to_delete = TRUE`
    )
    return results
}