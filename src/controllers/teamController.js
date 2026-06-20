import * as team_model from '../models/teamModel.js'
import {db_events} from '../providers/events.js'
import logger from '../providers/logger.js'
import {INVITE_PERMISSIONS} from '../configs/constants.js'
import {set_path, get_path, filter_object, create_stream} from '../utils.js'

export const create_team = ({team_data_path = 'team_data', user_id_path = 'user_id', output_team_data_path = 'team_data'} = {}) => {
    return async (req, res, next) => {
        try {
            const {team_name} = get_path(res, team_data_path)
            const user_id = get_path(res, user_id_path)
            const results = await team_model.insert_single(user_id, {team_name})
            set_path(res, output_team_data_path, {
                team_id: results.team_id,
                slug: results.slug,
            })
            next()
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({message: 'Team already exists'})
            }
            next(error)
        }
    }
}

export const create_team_invite_code = ({team_id_path = 'team_id', role_path = 'team_data.role', output_invite_code_path = 'invite_code'} = {}) => {
    return async (req, res, next) => {
        try {
            const team_id = get_path(res, team_id_path)
            const role = get_path(res, role_path)
            const results = await team_model.create_invite_code(team_id, role)
            set_path(res, output_invite_code_path, results)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const join_by_invite_code = ({user_id_path = 'user_id', invite_code_path = 'invite_code'} = {}) => {
    return async (req, res, next) => {
        try {
            const user_id = get_path(res, user_id_path)
            const invite_code = get_path(res, invite_code_path)
            const results = await team_model.insert_user_by_invite_code(invite_code, user_id)
            if (results === null) {
                return res.status(403).json({message: "Invalid invite code"})
            }
            next()
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({message: 'User already in team'})
            }
            next(error)
        }
    }
}


export const get_all_data_by_team_id = ({agent_fields, command_fields, server_fields, module_fields, tunnel_fields, team_id_path = 'team_id', output_data_path = 'data'} = {}) => {
    return async (req, res, next) => {
        try {
            const team_id = get_path(res, team_id_path)
            const results = await team_model.get_all_data_by_team_id(team_id, agent_fields, command_fields, server_fields, module_fields, tunnel_fields)
            set_path(res, output_data_path, results)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const check_access_by_user_id_and_role = ({team_id_path = 'team_id', user_id_path = 'user_id', role = []} = {}) => {
    return async (req, res, next) => {
        try {
            const team_id = get_path(res, team_id_path)
            const user_id = get_path(res, user_id_path)
            const results = await team_model.check_access_by_user_id_and_role(user_id, team_id, role)
            if (!results.user_exists) {
                return res.status(404).json({message: 'User not found'})
            }
            if (!results.team_exists) {
                return res.status(404).json({message: 'Team not found'})
            }
            if (!results.has_access) {
                return res.status(403).json({message: 'User does not have access to this team'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const check_invite_access_by_user_id_and_requested_role = ({team_id_path = 'team_id', user_id_path = 'user_id', requested_role_path = 'team_data.role'} = {}) => {
    return async (req, res, next) => {
        try {
            const team_id = get_path(res, team_id_path)
            const user_id = get_path(res, user_id_path)
            const requested_role = get_path(res, requested_role_path)
            if (requested_role === 'owner') return res.status(403).json({ message: 'Cannot invite owner' })
            const results = await team_model.select_userteam_by_user_id_and_team_id(user_id, team_id, ['role'])
            const current_role = results.role
            if (!results.role) return res.status(403).json({ message: 'You are not a member of this team' })
            const allowed_roles = INVITE_PERMISSIONS[current_role]
            if (!allowed_roles) return res.status(403).json({ message: 'You do not have permission to invite members' })
            if (!allowed_roles.includes(requested_role)) return res.status(403).json({ message: `Your role cannot invite a ${requested_role}` })
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const stream_all_data_by_team_id = ({agent_fields, command_fields, server_fields, module_fields, tunnel_fields, team_id_path = 'team_id', session_id_path = 'session_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const field_map = {
                agent: agent_fields,
                command: command_fields,
                server: server_fields,
                module: module_fields,
                tunnel: tunnel_fields,
            }

            const team_id = get_path(res, team_id_path)
            const session_id = get_path(res, session_id_path)

            const event_names = [
                `create:agent:team:${team_id}`,
                `update:agent:team:${team_id}`,
                `delete:agent:team:${team_id}`,
                `create:command:team:${team_id}`,
                `update:command:team:${team_id}`,
                `delete:command:team:${team_id}`,
                `create:server:team:${team_id}`,
                `update:server:team:${team_id}`,
                `delete:server:team:${team_id}`,
                `create:module:team:${team_id}`,
                `update:module:team:${team_id}`,
                `delete:module:team:${team_id}`,
                `create:tunnel:team:${team_id}`,
                `update:tunnel:team:${team_id}`,
                `delete:tunnel:team:${team_id}`,
            ]

            const subscriptions = new Map()

            const on_event = (event, payload) => {
                try {
                    const action = event.split(':')[0]
                    const resource = event.split(':')[1]
                    const fields = field_map[resource]
                    if (fields) {
                        const filtered_payload = {
                            ...filter_object(payload, fields),
                            _action: action,
                            _resource: resource,
                        }
                        sse.send(filtered_payload)
                    }
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
