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