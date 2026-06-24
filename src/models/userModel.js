import pool from '../providers/db.js'
import {v7 as uuid} from 'uuid'
import {nanoid} from 'nanoid-nice'
import {format_columns_select} from '../utils.js'
import {LEGAL_COMPLIANCE_VERSION} from '../configs/constants.js'

export const insert_single_with_identity = async (provider, provider_user_id, oauth_username) => {
    const connection = await pool.getConnection()
    try {
        const user_id = uuid()
        const team_id = uuid()
        const identity_id = uuid()
        const username = oauth_username ?? nanoid(8)
        const slug = nanoid(6)
        const team_name = `${username}'s Team`
        await connection.beginTransaction()
        await connection.query(`
            INSERT INTO User (user_id, username)
            VALUES (UUID_TO_BIN(?), ?)`,
            [user_id, username],
        )
        await connection.query(
            `INSERT INTO Team (team_id, team_name, slug)
            VALUES (UUID_TO_BIN(?), ?, ?)`,
            [team_id, team_name, slug],
        )
        await connection.query(
            `INSERT INTO UserTeam (user_id, team_id, role)
            VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?)`,
            [user_id, team_id, 'owner'],
        )
        await connection.query(
            `INSERT INTO Identity (identity_id, user_id, provider_user_id, provider)
            VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)`,
            [identity_id, user_id, provider_user_id, provider],
        )
        await connection.commit()
        return {user_id, team_id, slug}
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

export const select_by_user_id_with_team = async (user_id, user_columns, user_team_columns, team_columns) => {
    const [rows] = await pool.query(
        `SELECT ${format_columns_select(user_columns, 'User')}, ${format_columns_select(user_team_columns, 'UserTeam')}, ${format_columns_select(team_columns, 'Team')}
        FROM User
        LEFT JOIN UserTeam ON User.user_id = UserTeam.user_id
        LEFT JOIN Team ON UserTeam.team_id = Team.team_id
        WHERE User.user_id = UUID_TO_BIN(?)`,
        [user_id],
    )
    if (rows.length === 0) return null

    const user = {}
    user_columns.forEach((column) => {
        user[column] = rows[0][column]
    })

    user.teams = []

    rows.forEach((row) => {
        if (row.team_id) {
            const team_data = {}
            user_team_columns.forEach((column) => {
                team_data[column] = row[column]
            })
            team_columns.forEach((column) => {
                team_data[column] = row[column]
            })
            user.teams.push(team_data)
        }
    })

    return user
}

export const select_by_username = async (username, columns) => {
    const [rows] = await pool.query(
        `SELECT ${format_columns_select(columns)}
        FROM User
        WHERE username = ?`,
        [username],
    )
    return rows[0]
}

export const select_by_user_id = async (user_id, columns) => {
    const [rows] = await pool.query(`
        SELECT ${format_columns_select(columns)}
        FROM User
        WHERE user_id = UUID_TO_BIN(?)`,
        [user_id],
    )
    return rows[0]
}

export const update_by_user_id = async (user_id, data, columns) => {
    const fields = []
    const values = []
    columns.forEach((column) => {
        fields.push(`${column} = ?`)
        values.push(data[column])
    })
    const statement = `
        UPDATE User
        SET ${fields.join(', ')}, revision = revision + 1
        WHERE user_id = UUID_TO_BIN(?)
    `
    values.push(user_id)
    return await pool.query(statement, values)
}

export const update_legal_compliance_by_user_id = async (user_id) => {
    const statement = `
        UPDATE User
        SET accepted_legal_compliance_version = ?, legal_compliance_accepted_at = CURRENT_TIMESTAMP(6), revision = revision + 1
        WHERE user_id = UUID_TO_BIN(?)
    `
    return await pool.query(statement, [LEGAL_COMPLIANCE_VERSION, user_id])
}