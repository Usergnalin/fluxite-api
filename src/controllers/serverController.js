import * as server_model from '../models/serverModel.js'
import {db_events} from '../providers/events.js'
import {get_path, set_path, create_stream, filter_object} from '../utils.js'
import logger from '../providers/logger.js'

// === Database operations ===

export const create_server = ({server_data_path = 'server_data', agent_id_path = 'agent_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const server_data = get_path(res, server_data_path)
            const agent_id = get_path(res, agent_id_path)
            const results = await server_model.insert_single(agent_id, server_data)
            if (results.agent_not_found) {
                return res.status(404).json({message: "Agent not found"})
            } else if (results.quota_exceeded) {
                return res.status(403).json({message: 'Server per agent limit exceeded'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const update_by_server_id = ({fields, server_id_path = 'server_id', server_data_path = 'server_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const server_id = get_path(res, server_id_path)
            const server_data = get_path(res, server_data_path)
            const results = await server_model.update_by_server_id(server_id, server_data, fields)
            if (results.affectedRows === 0) {
                return res.status(404).json({message: 'Server not found'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const get_server_by_agent_id = ({fields, agent_id_path = 'agent_id', output_server_data_path = 'server_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const agent_id = get_path(res, agent_id_path)
            const results = await server_model.select_by_agent_id(agent_id, fields)
            set_path(res, output_server_data_path, results)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const delete_server_by_server_id = ({server_id_path = 'server_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const server_id = get_path(res, server_id_path)
            await server_model.delete_by_server_id(server_id)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const stream_server_by_agent_id = ({fields, agent_id_path = 'agent_id', session_id_path = 'session_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const agent_id = get_path(res, agent_id_path)
            const session_id = get_path(res, session_id_path)

            const event_names = [`create:server:agent:${agent_id}`, `update:server:agent:${agent_id}`, `delete:server:agent:${agent_id}`]

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

export const stream_server_by_server_id = ({fields, server_id_path = 'server_id', session_id_path = 'session_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const server_id = get_path(res, server_id_path)
            const session_id = get_path(res, session_id_path)

            const event_names = [`create:server:server:${server_id}`, `update:server:server:${server_id}`, `delete:server:server:${server_id}`]

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

export const check_access_by_agent_id = ({server_id_path = 'server_id', agent_id_path = 'agent_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const server_id = get_path(res, server_id_path)
            const agent_id = get_path(res, agent_id_path)
            const results = await server_model.check_access_by_agent_id(server_id, agent_id)
            if (!results.server_exists) {
                return res.status(404).json({message: 'Server not found'})
            }
            if (!results.agent_exists) {
                return res.status(404).json({message: 'Agent not found'})
            }
            if (!results.has_access) {
                return res.status(403).json({message: 'Agent does not have access to this server'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const check_access_by_user_id_and_role = ({server_id_path = 'server_id', user_id_path = 'user_id', role = []} = {}) => {
    return async (req, res, next) => {
        try {
            const server_id = get_path(res, server_id_path)
            const user_id = get_path(res, user_id_path)
            const results = await server_model.check_access_by_user_id_and_role(server_id, user_id, role)
            if (!results.user_exists) {
                return res.status(404).json({message: 'User not found'})
            }
            if (!results.server_exists) {
                return res.status(404).json({message: 'Server not found'})
            }
            if (!results.has_access) {
                return res.status(403).json({message: 'User does not have access to this server'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const get_server_by_server_id = ({fields, server_id_path = 'server_id', output_server_data_path = 'server_data'}) => {
    return async (req, res, next) => {
        try {
            const server_id = get_path(res, server_id_path)
            const results = await server_model.select_by_server_id(server_id, fields)
            if (results === undefined) {
                return res.status(404).json({message: 'Server not found'})
            }
            set_path(res, output_server_data_path, results)
            next()
        } catch (error) {
            next(error)
        }
    }
}
