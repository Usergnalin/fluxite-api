import pool from '../providers/db.js'
import {db_events} from '../providers/events.js'
import {format_columns_select} from '../utils.js'
import {SERVER_COLUMNS, MAX_SERVERS_PER_AGENT} from '../configs/constants.js'

const formatted_server_columns = format_columns_select(SERVER_COLUMNS, 'Server')

export const check_access_by_agent_id = async (server_id, agent_id) => {
    const results = await pool.query(
        `
        SELECT
        EXISTS (
            SELECT 1 FROM Server WHERE server_id = UUID_TO_BIN(?)
        ) AS server_exists,
        EXISTS (
            SELECT 1 FROM Agent WHERE agent_id = UUID_TO_BIN(?)
        ) AS agent_exists,
        EXISTS (
            SELECT 1
            FROM Server
            WHERE server_id = UUID_TO_BIN(?)
            AND agent_id = UUID_TO_BIN(?)
        ) AS has_access`,
        [server_id, agent_id, server_id, agent_id],
    )
    return results[0][0]
}

export const check_access_by_user_id_and_role = async (server_id, user_id, role) => {
    const results = await pool.query(
        `
        SELECT 
        EXISTS (
            SELECT 1 FROM Server WHERE server_id = UUID_TO_BIN(?)
        ) AS server_exists,
        EXISTS (
            SELECT 1 FROM User WHERE user_id = UUID_TO_BIN(?)
        ) AS user_exists,
        EXISTS (
            SELECT 1 
            FROM Server
            JOIN Agent ON Server.agent_id = Agent.agent_id
            JOIN UserTeam ON Agent.team_id = UserTeam.team_id
            WHERE Server.server_id = UUID_TO_BIN(?)
                AND UserTeam.user_id = UUID_TO_BIN(?)
                AND UserTeam.role IN (?)
        ) AS has_access`,
        [server_id, user_id, server_id, user_id, role],
    )
    return results[0][0]
}

export const insert_single = async (agent_id, data) => {
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        const [agent_rows] = await connection.execute(`
            SELECT * FROM Agent WHERE agent_id = UUID_TO_BIN(?) FOR UPDATE`,
            [agent_id]
        )
        if (agent_rows.length === 0) {
            await connection.rollback()
            return {agent_not_found: 1}
        }
        const [[quota_results]] = await connection.execute(`
            SELECT COUNT(*) >= ? AS quota_exceeded
            FROM Server
            WHERE agent_id = UUID_TO_BIN(?)`,
            [MAX_SERVERS_PER_AGENT, agent_id]
        )
        if (quota_results.quota_exceeded) {
            await connection.rollback()
            return quota_results
        }
        const [insert_results] = await connection.execute(`
            INSERT INTO Server (server_id, agent_id, server_name, server_port, properties)
            VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?)`,
            [data.server_id, agent_id, data.server_name, data.server_port, JSON.stringify(data.properties)]
        )
        const [select_results] = await connection.execute(`
            SELECT BIN_TO_UUID(Agent.team_id) as team_id, ${formatted_server_columns}
            FROM Server
            INNER JOIN Agent ON Server.agent_id = Agent.agent_id
            WHERE Server.server_id = UUID_TO_BIN(?)`,
            [data.server_id],
        )
        await connection.commit()
        const payload = select_results[0]
        db_events.emit(`create:server:server:${payload.server_id}`, payload)
        db_events.emit(`create:server:agent:${payload.agent_id}`, payload)
        db_events.emit(`create:server:team:${payload.team_id}`, payload)
        return {...insert_results, data: payload}
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

export const update_by_server_id = async (server_id, data, columns) => {
    const fields = []
    const values = []
    columns.forEach((column) => {
        if (data[column] !== undefined) {
            let value = data[column]
            if (column === 'properties') value = JSON.stringify(value)
            fields.push(`${column} = ?`)
            values.push(value)
            if (column === 'server_status' && data[column] === 'offline') {
                if (!fields.some((field) => field.startsWith('last_online'))) {
                    fields.push('last_online = NOW()')
                }
            }
        }
    })
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        const [update_results] = await connection.execute(
            `
            UPDATE Server 
            SET ${fields.join(', ')}, revision = revision + 1
            WHERE server_id = UUID_TO_BIN(?)`,
            [...values, server_id],
        )
        if (update_results.affectedRows === 0) {
            await connection.rollback()
            return update_results
        }
        const [select_results] = await connection.execute(
            `
            SELECT BIN_TO_UUID(Agent.team_id) as team_id, ${formatted_server_columns}
            FROM Server
            INNER JOIN Agent ON Server.agent_id = Agent.agent_id
            WHERE Server.server_id = UUID_TO_BIN(?)`,
            [server_id],
        )
        await connection.commit()
        const payload = select_results[0]
        db_events.emit(`update:server:server:${payload.server_id}`, payload)
        db_events.emit(`update:server:agent:${payload.agent_id}`, payload)
        db_events.emit(`update:server:team:${payload.team_id}`, payload)
        return update_results
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

export const delete_by_server_id = async (server_id) => {
    const [select_results] = await pool.execute(
        `SELECT BIN_TO_UUID(Server.agent_id) as agent_id, BIN_TO_UUID(Agent.team_id) as team_id
        FROM Server
        INNER JOIN Agent ON Server.agent_id = Agent.agent_id
        WHERE Server.server_id = UUID_TO_BIN(?)`,
        [server_id],
    )
    if (select_results.length === 0) return {affectedRows: 0}
    const {agent_id, team_id} = select_results[0]
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        await connection.execute('SELECT server_id FROM Server WHERE server_id = UUID_TO_BIN(?) FOR UPDATE', [server_id]) // Lock the server, prevent new tunnels
        await connection.execute('UPDATE Tunnel SET to_delete = TRUE WHERE server_id = UUID_TO_BIN(?)', [server_id]) // Mark tunnels for deletion
        const [delete_results] = await connection.execute('DELETE FROM Server WHERE server_id = UUID_TO_BIN(?)', [server_id])
        await connection.commit()
        const payload = {agent_id, server_id, team_id}
        // Dont need to send updates for tunnels because its server is deleted
        db_events.emit(`delete:server:server:${server_id}`, payload)
        db_events.emit(`delete:server:agent:${agent_id}`, payload)
        db_events.emit(`delete:server:team:${team_id}`, payload)
        return delete_results
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

export const select_by_server_id = async (server_id, columns) => {
    const [results] = await pool.query(
        `SELECT ${format_columns_select(columns)}
        FROM Server
        WHERE server_id = UUID_TO_BIN(?)`,
        [server_id],
    )
    return results[0]
}

export const select_by_agent_id = async (agent_id, columns) => {
    const [results] = await pool.query(
        `SELECT ${format_columns_select(columns)}
        FROM Server
        WHERE agent_id = UUID_TO_BIN(?)`,
        [agent_id],
    )
    return results
}
