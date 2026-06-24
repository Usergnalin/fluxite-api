import * as user_model from '../models/userModel.js'
import {set_path, get_path} from '../utils.js'

// === Database operations ===

export const get_user_by_user_id_with_team = ({user_fields, user_team_fields, team_fields, user_id_path = 'user_id', user_data_path = 'user_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const user_id = get_path(res, user_id_path)
            const results = await user_model.select_by_user_id_with_team(user_id, user_fields, user_team_fields, team_fields)
            if (results === undefined) {
                return res.status(404).json({message: 'User not found'})
            }
            set_path(res, user_data_path, results)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const get_user_by_username = ({fields, username_path = 'user_data.username', user_data_path = 'user_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const username = get_path(res, username_path)
            const results = await user_model.select_by_username(username, fields)
            if (results === undefined) {
                return res.status(404).json({message: 'User not found'})
            }
            set_path(res, user_data_path, results)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const update_user_by_user_id = ({fields, user_id_path = 'user_id', user_data_path = 'user_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const user_id = get_path(res, user_id_path)
            const user_data = get_path(res, user_data_path)
            const results = await user_model.update_by_user_id(user_id, user_data, fields)
            if (results.affectedRows === 0) {
                return res.status(404).json({message: 'User not found'})
            }
            next()
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({message: 'Username already exists'})
            }
            next(error)
        }
    }
}

export const update_user_legal_compliance_by_user_id = ({user_id_path = 'user_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const user_id = get_path(res, user_id_path)
            const results = await user_model.update_legal_compliance_by_user_id(user_id)
            if (results.affectedRows === 0) {
                return res.status(404).json({message: 'User not found'})
            }
            next()
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({message: 'Username already exists'})
            }
            next(error)
        }
    }
}