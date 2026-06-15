import pool from '../providers/db.js'
import {v7 as uuid} from 'uuid'
import {nanoid} from 'nanoid-nice'
import {format_columns_select} from '../utils.js'

export const insert_single = async (user_id, data) => {
    const connection = await pool.getConnection()
    try {
        const team_id = uuid()
        const slug = nanoid(6)
        await connection.beginTransaction()
        await connection.execute(`INSERT INTO Team (team_id, team_name, slug) VALUES (UUID_TO_BIN(?), ?, ?)`, [team_id, data.team_name, slug])
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
    const results = await pool.query(
        `
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
