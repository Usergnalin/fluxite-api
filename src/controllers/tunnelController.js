import * as tunnel_model from '../models/tunnelModel.js'
import {get_path, set_path} from '../utils.js'

export const create_agent_tunnel = ({tunnel_data_path = 'tunnel_data', agent_id_path = 'agent_id', output_tunnel_data_path = 'tunnel_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const tunnel_data = get_path(res, tunnel_data_path)
            const agent_id = get_path(res, agent_id_path)
            const results = await tunnel_model.insert_agent_tunnel(agent_id, tunnel_data)
            if (results === null) {
                return res.status(409).json({message: 'Failed to create tunnel'})
            }
            set_path(res, output_tunnel_data_path, results.data)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const create_server_tunnel = ({server_id_path = 'server_id', output_tunnel_data_path = 'tunnel_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const server_id = get_path(res, server_id_path)
            const results = await tunnel_model.insert_server_tunnel(server_id)
            if (results.team_not_found) {
                return res.status(404).json({message: "Team not found"})
            } else if (results.quota_exceeded) {
                return res.status(403).json({message: "Tunnel per team quota reached"})
            } else if (results.routing_failed) {
                return res.status(500).json({message: "Routing failed"})
            } else if (results.subdomain_allocation_failed) {
                return res.status(409).json({message: "Failed to allocate subdomain"})
            }
            set_path(res, output_tunnel_data_path, results.data)
            next()
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({message: 'Server already has a tunnel'})
            }
            next(error)
        }
    }
}

export const delete_by_tunnel_id = ({tunnel_id_path = 'tunnel_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const tunnel_id = get_path(res, tunnel_id_path)
            const results = await tunnel_model.update_by_tunnel_id(tunnel_id, {to_delete: true}, ['to_delete'])
            if (results.affectedRows === 0) {
                return res.status(404).json({message: 'Tunnel not found'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const update_by_tunnel_id = ({fields, tunnel_id_path = 'tunnel_id', tunnel_data_path = 'tunnel_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const tunnel_id = get_path(res, tunnel_id_path)
            const tunnel_data = get_path(res, tunnel_data_path)
            const results = await tunnel_model.update_by_tunnel_id(tunnel_id, tunnel_data, fields)
            if (results.affectedRows === 0) {
                return res.status(404).json({message: 'Tunnel not found'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const check_access_by_user_id_and_role = ({tunnel_id_path = 'tunnel_id', user_id_path = 'user_id', role = []} = {}) => {
    return async (req, res, next) => {
        try {
            const tunnel_id = get_path(res, tunnel_id_path)
            const user_id = get_path(res, user_id_path)
            const results = await tunnel_model.check_access_by_user_id_and_role(user_id, tunnel_id, role)
            if (!results.user_exists) {
                return res.status(404).json({message: 'User not found'})
            }
            if (!results.tunnel_exists) {
                return res.status(404).json({message: 'Tunnel not found'})
            }
            if (!results.has_access) {
                return res.status(403).json({message: 'User does not have access to this Tunnel'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}