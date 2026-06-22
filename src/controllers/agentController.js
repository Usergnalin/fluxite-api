import * as agent_model from '../models/agentModel.js'
import logger from '../providers/logger.js'
import {db_events} from '../providers/events.js'
import {redis_events} from '../providers/events.js'
import {get_path, set_path, create_stream, filter_object} from '../utils.js'

redis_events.on('agent_expired', async (agent_id) => {
    try {
        await agent_model.update_by_agent_id(agent_id, {agent_status: 'offline'}, ['agent_status'])
    } catch (error) {
        logger.error({err: error, agent_id: agent_id}, 'Error on agent offline status update')
    }
})

export const create_agent_by_linking_code = ({agent_data_path = 'agent_data', linking_code_path = 'linking_code', output_agent_data_path = 'agent_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const {linking_code} = get_path(res, linking_code_path)
            const agent_data = get_path(res, agent_data_path)
            const results = await agent_model.insert_by_linking_code(linking_code, agent_data)
            if (results.invalid_linking_code) {
                return res.status(403).json({message: 'Invalid linking code'})
            } else if (results.team_not_found) {
                return res.status(404).json({message: 'Team not found'})
            } else if (results.quota_exceeded) {
                return res.status(403).json({message: 'Agent per team quota reached'})
            } else if (results.tunnel_registration_failed) {
                return res.status(500).json({message: 'Tunnel registration failed'})
            }
            set_path(res, output_agent_data_path, results)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const create_agent_linking_code = ({team_id_path = 'team_id', output_linking_code_path = 'linking_code'} = {}) => {
    return async (req, res, next) => {
        try {
            const team_id = get_path(res, team_id_path)
            const results = await agent_model.create_linking_code(team_id)
            set_path(res, output_linking_code_path, results)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const update_agent_by_agent_id = ({fields, agent_id_path = 'agent_id', agent_data_path = 'agent_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const agent_id = get_path(res, agent_id_path)
            const agent_data = get_path(res, agent_data_path)
            const results = await agent_model.update_by_agent_id(agent_id, agent_data, fields)
            if (results.affectedRows === 0) {
                return res.status(404).json({message: 'Agent not found'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const delete_agent_by_agent_id = ({agent_id_path = 'agent_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const agent_id = get_path(res, agent_id_path)
            await agent_model.delete_by_agent_id(agent_id)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const get_agent_by_agent_id = ({fields, agent_id_path = 'agent_id', output_agent_data_path = 'agent_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const agent_id = get_path(res, agent_id_path)
            const results = await agent_model.select_by_agent_id(agent_id, fields)
            if (results === undefined) {
                return res.status(404).json({message: 'Agent not found'})
            }
            set_path(res, output_agent_data_path, results)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const get_agent_by_team_id = ({fields, team_id_path = 'team_id', output_agent_data_path = 'agent_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const team_id = get_path(res, team_id_path)
            const results = await agent_model.select_by_team_id(team_id, fields)
            set_path(res, output_agent_data_path, results)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const stream_agent_by_team_id = ({fields, team_id_path = 'team_id', session_id_path = 'session_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const team_id = get_path(res, team_id_path)
            const session_id = get_path(res, session_id_path)

            const event_names = [`create:agent:team:${team_id}`, `update:agent:team:${team_id}`, `delete:agent:team:${team_id}`]

            const subscriptions = new Map()

            const on_event = (event, payload) => {
                try {
                    const action = event.split(':')[0]
                    const filtered_payload = {
                        ...filter_object(payload, fields),
                        _action: action,
                    }
                    sse.send(filtered_payload)
                } catch (error) {
                    logger.error({err: error, event: event}, 'Error SSE on_event')
                }
            }

            const on_close = () => {
                subscriptions.forEach((handler, event) => {
                    db_events.off(event, handler)
                })
                subscriptions.clear()
            }

            const sse = create_stream(res, {
                session_expiry: res.locals.session_expiry,
                session_id,
                on_heartbeat: (_stop) => {},
                on_close,
            })

            event_names.forEach((event) => {
                const handler = (payload) => on_event(event, payload)
                subscriptions.set(event, handler)
                db_events.on(event, handler)
            })
        } catch (error) {
            next(error)
        }
    }
}

export const check_access_by_user_id_and_role = ({agent_id_path = 'agent_id', user_id_path = 'user_id', role = []} = {}) => {
    return async (req, res, next) => {
        try {
            const agent_id = get_path(res, agent_id_path)
            const user_id = get_path(res, user_id_path)
            const results = await agent_model.check_access_by_user_id_and_role(user_id, agent_id, role)
            if (!results.user_exists) {
                return res.status(404).json({message: 'User not found'})
            }
            if (!results.agent_exists) {
                return res.status(404).json({message: 'Agent not found'})
            }
            if (!results.has_access) {
                return res.status(403).json({message: 'User does not have access to this agent'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}
