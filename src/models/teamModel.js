import pool from '../providers/db.js'
import {redis_client} from '../providers/redis.js'
import {v7 as uuid} from 'uuid'
import {nanoid} from 'nanoid-nice'
import ms from 'ms'
import {format_columns_select} from '../utils.js'
import {INVITE_CODE_EXPIRY, MAX_FREE_TEAMS_PER_USER, TEAM_TYPES} from '../configs/constants.js'

const invite_code_expiry = ms(INVITE_CODE_EXPIRY) / 1000
const max_free_teams_per_user = MAX_FREE_TEAMS_PER_USER

export const insert_single_free = async (user_id, data) => {
    const connection = await pool.getConnection()
    try {
        const team_id = uuid()
        const slug = nanoid(6)
        await connection.beginTransaction()
        const [[quota_results]] = await connection.execute(`
            SELECT COUNT(*) >= ? AS quota_exceeded
            FROM UserTeam
            WHERE user_id = UUID_TO_BIN(?)
            FOR UPDATE`,
            [MAX_FREE_TEAMS_PER_USER, user_id]
        )
        if (quota_results.quota_exceeded) {
            await connection.rollback()
            return quota_results
        }
        await connection.execute(`INSERT INTO Team (team_id, team_name, slug, team_type) VALUES (UUID_TO_BIN(?), ?, ?, ?)`, [team_id, data.team_name, slug, 'free'])
        await connection.execute(`INSERT INTO UserTeam (user_id, team_id, role) VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?)`, [user_id, team_id, 'owner'])
        await connection.commit()
        return {team_id, slug}
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

export const select_userteam_by_user_id_and_team_id = async (user_id, team_id, columns) => {
    const [results] = await pool.query(
        `SELECT ${format_columns_select(columns)}
        FROM UserTeam
        WHERE user_id = UUID_TO_BIN(?) AND team_id = UUID_TO_BIN(?)`,
        [user_id, team_id],
    )
    return results[0]
}

export const get_all_data_by_team_id = async (team_id, agent_columns, command_columns, server_columns, module_columns, tunnel_columns) => {
    const [agents, commands, servers, modules, tunnels] = await Promise.all([
        pool.execute(
            `
            SELECT ${format_columns_select(agent_columns, 'Agent')}
            FROM Agent
            WHERE Agent.team_id = UUID_TO_BIN(?)`,
            [team_id],
        ),
        pool.execute(
            `
            SELECT ${format_columns_select(command_columns, 'Command')}
            FROM Command
            JOIN Agent ON Command.agent_id = Agent.agent_id
            WHERE Agent.team_id = UUID_TO_BIN(?)
            ORDER BY created_at DESC
            LIMIT 100`,
            [team_id],
        ),
        pool.execute(
            `
            SELECT ${format_columns_select(server_columns, 'Server')}
            FROM Server
            JOIN Agent ON Server.agent_id = Agent.agent_id
            WHERE Agent.team_id = UUID_TO_BIN(?)`,
            [team_id],
        ),
        pool.execute(
            `
            SELECT ${format_columns_select(module_columns, 'Module')}
            FROM Module
            JOIN Server ON Module.server_id = Server.server_id
            JOIN Agent ON Server.agent_id = Agent.agent_id
            WHERE Agent.team_id = UUID_TO_BIN(?)`,
            [team_id],
        ),
        pool.execute(
            `
            SELECT ${format_columns_select(tunnel_columns, 'Tunnel')}
            FROM Tunnel
            JOIN Agent ON Tunnel.agent_id = Agent.agent_id
            WHERE Agent.team_id = UUID_TO_BIN(?)`,
            [team_id],
        ),
    ])
    return {agents: agents[0], commands: commands[0], servers: servers[0], modules: modules[0], tunnels: tunnels[0]}
}

export const check_access_by_user_id_and_role = async (user_id, team_id, role) => {
    const results = await pool.query(`
        SELECT
        EXISTS (
            SELECT 1 FROM User WHERE user_id = UUID_TO_BIN(?)
        ) AS user_exists,
        EXISTS (
            SELECT 1 FROM Team WHERE team_id = UUID_TO_BIN(?)
        ) AS team_exists,
        EXISTS (
            SELECT 1 
            FROM UserTeam
            WHERE user_id = UUID_TO_BIN(?)
              AND team_id = UUID_TO_BIN(?)
              AND role IN (?)
        ) AS has_access`,
        [user_id, team_id, user_id, team_id, role],
    )
    return results[0][0]
}

export const create_invite_code = async (team_id, role) => {
    const invite_code = nanoid(8)
    await redis_client.set(`invite_code:${invite_code}`, JSON.stringify({team_id, role}), "EX", invite_code_expiry)
    return invite_code
}

export const insert_user_by_invite_code = async (invite_code, user_id) => {
    const redis_key = `invite_code:${invite_code}`
    const redis_value = await redis_client.getdel(redis_key)
    if (redis_value === null) return {invalid_invite_code: 1}
    const {team_id, role} = JSON.parse(redis_value)
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        const [team_rows] = await connection.execute(`
            SELECT team_type FROM Team WHERE team_id = UUID_TO_BIN(?) FOR UPDATE`,
            [team_id]
        )
        if (team_rows.length === 0) {
            await connection.rollback()
            return {team_not_found: 1}
        }
        const max_team_members = TEAM_TYPES[team_rows[0].team_type].max_team_members
        const [[quota_results]] = await connection.execute(`
            SELECT COUNT(*) >= ? AS quota_exceeded
            FROM UserTeam WHERE team_id = UUID_TO_BIN(?)`,
            [max_team_members, team_id]
        )
        if (quota_results.quota_exceeded) {
            await connection.rollback()
            return quota_results
        }
        const results = await connection.execute(`
            INSERT INTO UserTeam (user_id, team_id, role)
            VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?)`,
            [user_id, team_id, role],
        )
        await connection.commit()
        return results
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

export const check_free_team_limit_by_user_id = async (user_id) => {
    const results = await pool.query(`
        SELECT
        EXISTS (
            SELECT 1 FROM User WHERE user_id = UUID_TO_BIN(?)
        ) AS user_exists,
        (
            SELECT COUNT(*) > ?
            FROM UserTeam
            JOIN Team ON Team.team_id = UserTeam.team_id
            WHERE UserTeam.user_id = UUID_TO_BIN(?)
              AND UserTeam.role = 'owner'
              AND Team.plan = 'free'
        ) AS at_free_team_limit`,
        [user_id, max_free_teams_per_user, user_id]
    )
    return results[0][0]
}