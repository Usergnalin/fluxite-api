import pool from '../providers/db.js'
import {format_columns_select, filter_object} from '../utils.js'
import {db_events} from '../providers/events.js'
import {COMMAND_COLUMNS, TEAM_TYPES, COMMAND_DELETE_BATCH_SIZE} from '../configs/constants.js'
import {v7 as uuid} from 'uuid'

const formatted_command_columns = format_columns_select(COMMAND_COLUMNS, 'Command')

export const select_by_agent_id_and_mark_sent = async (agent_id, columns) => {
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        const [select_results] = await connection.execute(
            `
            SELECT BIN_TO_UUID(Agent.team_id) AS team_id, ${formatted_command_columns}
            FROM Command
            INNER JOIN Agent ON Command.agent_id = Agent.agent_id
            WHERE Command.agent_id = UUID_TO_BIN(?) AND Command.command_status = 'queued'
            FOR UPDATE SKIP LOCKED`,
            [agent_id],
        )
        if (select_results.length === 0) {
            await connection.rollback()
            return []
        }
        const command_ids = select_results.map((command) => command.command_id)
        const placeholders = command_ids.map(() => 'UUID_TO_BIN(?)').join(', ')
        await connection.execute(
            `
            UPDATE Command SET command_status = 'sent', revision = revision + 1
            WHERE command_id IN (${placeholders})`,
            command_ids,
        )
        await connection.commit()
        const filtered_results = select_results.map((command) => {
            const payload = {...command, command_status: 'sent'}
            db_events.emit(`update:command:command:${payload.command_id}`, payload)
            db_events.emit(`update:command:agent:${payload.agent_id}`, payload)
            db_events.emit(`update:command:team:${payload.team_id}`, payload)
            return filter_object(payload, columns)
        })
        return filtered_results
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

export const select_by_agent_id = async (agent_id, columns) => {
    const [results] = await pool.query(
        `SELECT ${format_columns_select(columns)}
        FROM Command
        WHERE agent_id = UUID_TO_BIN(?)
        ORDER BY created_at DESC
        LIMIT 100`,
        [agent_id],
    )
    return results
}

export const insert_single = async (agent_id, user_id, data) => {
    const command_id = uuid()
    const command_status = 'queued'
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        await pool.execute(`INSERT INTO Command (command_id, agent_id, user_id, command, command_status) VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)`, [
            command_id,
            agent_id,
            user_id,
            JSON.stringify(data.command),
            command_status,
        ])
        const [select_results] = await pool.execute(
            `
            SELECT BIN_TO_UUID(Agent.team_id) as team_id, ${formatted_command_columns}
            FROM Command
            INNER JOIN Agent ON Command.agent_id = Agent.agent_id
            WHERE Command.command_id = UUID_TO_BIN(?)`,
            [command_id],
        )
        await connection.commit()
        const payload = select_results[0]
        db_events.emit(`create:command:command:${payload.command_id}`, payload)
        db_events.emit(`create:command:agent:${payload.agent_id}`, payload)
        db_events.emit(`create:command:team:${payload.team_id}`, payload)
        return payload
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

export const update_by_command_id = async (command_id, data, columns) => {
    const fields = []
    const values = []
    columns.forEach((column) => {
        if (data[column] !== undefined) {
            let value = data[column]
            if (column === 'command') value = JSON.stringify(value)
            fields.push(`${column} = ?`)
            values.push(value)
        }
    })
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        const [update_results] = await connection.execute(
            `
            UPDATE Command SET ${fields.join(', ')}, revision = revision + 1
            WHERE command_id = UUID_TO_BIN(?)`,
            [...values, command_id],
        )
        if (update_results.affectedRows === 0) {
            await connection.rollback()
            return update_results
        }
        const [select_results] = await connection.execute(
            `
            SELECT BIN_TO_UUID(Agent.team_id) as team_id, ${formatted_command_columns}
            FROM Command
            INNER JOIN Agent ON Command.agent_id = Agent.agent_id
            WHERE Command.command_id = UUID_TO_BIN(?)`,
            [command_id],
        )
        await connection.commit()
        const payload = select_results[0]
        db_events.emit(`update:command:command:${payload.command_id}`, payload)
        db_events.emit(`update:command:agent:${payload.agent_id}`, payload)
        db_events.emit(`update:command:team:${payload.team_id}`, payload)
        return update_results
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

// export const delete_by_created_at_and_team_type = async () => {
//     for (const [team_type, limits] of Object.entries(TEAM_TYPES)) {
//         let deleted_ids = []
//         do {
//             const [rows] = await pool.execute(`
//                 SELECT BIN_TO_UUID(Command.command_id) as command_id,
//                        BIN_TO_UUID(Command.agent_id) as agent_id,
//                        BIN_TO_UUID(Agent.team_id) as team_id
//                 FROM Command
//                 INNER JOIN Agent ON Command.agent_id = Agent.agent_id
//                 INNER JOIN Team ON Agent.team_id = Team.team_id
//                 WHERE Team.team_type = ?
//                 AND Command.created_at < NOW() - INTERVAL ? DAY
//                 LIMIT ?`,
//                 [team_type, limits.max_command_history_days, COMMAND_DELETE_BATCH_SIZE]
//             )
//             if (rows.length === 0) break

//             const ids = rows.map(r => r.command_id)

//             await pool.execute(`
//                 DELETE FROM Command
//                 WHERE command_id IN (${ids.map(() => 'UUID_TO_BIN(?)').join(',')})`,
//                 ids
//             )

//             for (const row of rows) {
//                 db_events.emit(`delete:command:command:${row.command_id}`, row)
//                 db_events.emit(`delete:command:agent:${row.agent_id}`, row)
//                 db_events.emit(`delete:command:team:${row.team_id}`, row)
//             }

//             deleted_ids = ids
//             if (ids.length === COMMAND_DELETE_BATCH_SIZE) await new Promise(r => setTimeout(r, 100))
//         } while (deleted_ids.length === COMMAND_DELETE_BATCH_SIZE)
//     }
// }

export const delete_by_team_type = async (team_type) => {
    const [rows] = await pool.execute(`
        SELECT BIN_TO_UUID(Command.command_id) as command_id, BIN_TO_UUID(Command.agent_id) as agent_id, BIN_TO_UUID(Agent.team_id) as team_id
        FROM Command
        INNER JOIN Agent ON Command.agent_id = Agent.agent_id
        INNER JOIN Team ON Agent.team_id = Team.team_id
        WHERE Team.team_type = ?
        AND Command.created_at < NOW() - INTERVAL ${TEAM_TYPES[team_type].max_command_history_days} DAY
        LIMIT ${COMMAND_DELETE_BATCH_SIZE}`,
        [team_type]
    )
    if (rows.length === 0) return rows
    const ids = rows.map(r => r.command_id)
    await pool.execute(`
        DELETE FROM Command
        WHERE command_id IN (${ids.map(() => 'UUID_TO_BIN(?)').join(',')})`,
        ids
    )
    for (const row of rows) {
        db_events.emit(`delete:command:command:${row.command_id}`, row)
        db_events.emit(`delete:command:agent:${row.agent_id}`, row)
        db_events.emit(`delete:command:team:${row.team_id}`, row)
    }

    return rows
}