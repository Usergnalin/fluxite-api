import pool from '../providers/db.js'
import {db_events} from '../providers/events.js'
import {redis_client} from '../providers/redis.js'
import ms from 'ms'
import {v7 as uuid} from 'uuid'
import {generate_phrase, format_columns_select, random_tunnel_ip, int_to_ip} from '../utils.js'
import {LINKING_CODE_EXPIRY, AGENT_COLUMNS, MAX_RETRIES} from '../configs/constants.js'

const linking_code_expiry = ms(LINKING_CODE_EXPIRY) / 1000
const formatted_agent_columns = format_columns_select(AGENT_COLUMNS, 'Agent')

export const insert_by_linking_code = async (linking_code, data) => {
    const redis_key = `linking_code:${linking_code}`
    const team_id = await redis_client.getdel(redis_key)
    const agent_status = 'offline'
    if (team_id === null) {
        return null
    }
    const agent_id = uuid()
    const connection = await pool.getConnection()
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const tunnel_ip_int = random_tunnel_ip()
            await connection.beginTransaction()
            await connection.execute(
                `
                INSERT INTO Agent (agent_id, team_id, agent_name, public_key, tunnel_public_key, tunnel_ip, agent_status)
                VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?, ?, ?)`,
                [agent_id, team_id, data.agent_name, data.public_key, data.tunnel_public_key, tunnel_ip_int, agent_status],
            )
            const [select_results] = await connection.execute(
                `
                SELECT ${formatted_agent_columns}
                FROM Agent WHERE agent_id = UUID_TO_BIN(?)`,
                [agent_id],
            )
            await connection.commit()
            const payload = select_results[0]
            const tunnel_add_response = await fetch(process.env.WG_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${process.env.WG_API_TOKEN}`,
                },
                body: JSON.stringify({
                    "jsonrpc": "2.0",
                    "method": "AddPeer",
                    "params": {
                        "public_key": payload.tunnel_public_key,
                        "allowed_ips": [`${int_to_ip(tunnel_ip_int)}/32`]
                    }
                }),
            })
            const tunnel_add_result = await tunnel_add_response.json()
            if (tunnel_add_result.result.ok === false) {
                await connection.rollback()
                return null
            }
            db_events.emit(`create:agent:agent:${payload.agent_id}`, payload)
            db_events.emit(`create:agent:team:${payload.team_id}`, payload)
            return payload
        } catch (error) {
            await connection.rollback()
            if (error.code === 'ER_DUP_ENTRY' && attempt < MAX_RETRIES - 1) continue
            throw error
        } finally {
            connection.release()
        }
    }
    return null
}

export const select_by_agent_id = async (agent_id, columns) => {
    const [results] = await pool.query(
        `SELECT ${format_columns_select(columns)}
        FROM Agent
        WHERE agent_id = UUID_TO_BIN(?)`,
        [agent_id],
    )
    return results[0]
}

export const select_by_team_id = async (team_id, columns) => {
    const [results] = await pool.query(
        `SELECT ${format_columns_select(columns)}
        FROM Agent
        WHERE team_id = UUID_TO_BIN(?)`,
        [team_id],
    )
    return results
}

export const update_by_agent_id = async (agent_id, data, columns) => {
    const fields = []
    const values = []
    columns.forEach((column) => {
        if (data[column] !== undefined) {
            fields.push(`${column} = ?`)
            values.push(data[column])
            if (column === 'agent_status' && data[column] === 'offline') {
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
            UPDATE Agent SET ${fields.join(', ')}, revision = revision + 1
            WHERE agent_id = UUID_TO_BIN(?)`,
            [...values, agent_id],
        )
        if (update_results.affectedRows === 0) {
            await connection.rollback()
            return update_results
        }
        const [select_results] = await connection.execute(
            `
            SELECT ${formatted_agent_columns}
            FROM Agent
            WHERE Agent.agent_id = UUID_TO_BIN(?)`,
            [agent_id],
        )
        await connection.commit()
        const payload = select_results[0]
        db_events.emit(`update:agent:agent:${payload.agent_id}`, payload)
        db_events.emit(`update:agent:team:${payload.team_id}`, payload)
        return update_results
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

    export const delete_by_agent_id = async (agent_id) => {
        const [select_results] = await pool.execute(
            `
            SELECT BIN_TO_UUID(Agent.team_id) as team_id
            FROM Agent
            WHERE Agent.agent_id = UUID_TO_BIN(?)`,
            [agent_id],
        )
        if (select_results.length === 0) return {affectedRows: 0}
        const {team_id} = select_results[0] 
        const connection = await pool.getConnection()
        try {
            await connection.beginTransaction()
            await connection.execute('SELECT agent_id FROM Agent WHERE agent_id = UUID_TO_BIN(?) FOR UPDATE', [agent_id]) // Lock the agent, prevent new tunnels
            await connection.execute('UPDATE Tunnel SET to_delete = TRUE WHERE agent_id = UUID_TO_BIN(?)', [agent_id]) // Mark tunnels for deletion
            const [delete_results] = await connection.execute('DELETE FROM Agent WHERE agent_id = UUID_TO_BIN(?)', [agent_id])
            await connection.commit()
            const payload = {team_id, agent_id}
            // Dont need to send updates for tunnels because its agent is deleted
            db_events.emit(`delete:agent:agent:${agent_id}`, payload)
            db_events.emit(`delete:agent:team:${team_id}`, payload)
            return delete_results
        } catch (error) {
            await connection.rollback()
            throw error
        } finally {
            connection.release()
        }
    }

export const update_all = async (data, columns) => {
    const fields = []
    const values = []
    columns.forEach((column) => {
        if (data[column] !== undefined) {
            fields.push(`${column} = ?`)
            values.push(data[column])
        }
    })
    return await pool.query(
        `
        UPDATE Agent 
        SET ${fields.join(', ')}, revision = revision + 1`,
        values,
    )
}

export const check_access_by_user_id_and_role = async (user_id, agent_id, role) => {
    const results = await pool.query(
        `
        SELECT
        EXISTS (
            SELECT 1 FROM User WHERE user_id = UUID_TO_BIN(?)
        ) AS user_exists,

        EXISTS (
            SELECT 1 FROM Agent WHERE agent_id = UUID_TO_BIN(?)
        ) AS agent_exists,

        EXISTS (
            SELECT 1
            FROM UserTeam
            JOIN Agent ON UserTeam.team_id = Agent.team_id
            WHERE UserTeam.user_id = UUID_TO_BIN(?)
                AND Agent.agent_id = UUID_TO_BIN(?)
                AND UserTeam.role IN (?)
        ) AS has_access`,
        [user_id, agent_id, user_id, agent_id, role],
    )
    return results[0][0]
}

export const create_linking_code = async (team_id) => {
    const linking_code = generate_phrase()
    await redis_client.set(`linking_code:${linking_code}`, team_id, "EX", linking_code_expiry)
    return linking_code
}
