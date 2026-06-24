import {get_path} from '../utils.js'
import {validate as validate_uuid} from 'uuid'
import logger from '../providers/logger.js'
import {SERVER_STATUS, COMMAND_STATUS, AGENT_STATUS, MODULE_TYPES, TEAM_ROLES, MIN_PORT, MAX_PORT} from '../configs/constants.js'

// === Request handlers ===

const validation_logic = {
    agent_port: (value) => {
        const parsed_value = parseInt(value)
        return Number.isSafeInteger(parsed_value) && parsed_value > MIN_PORT && parsed_value <= MAX_PORT ? parsed_value : null
    },
    tunnel_name: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 63 ? trimmed : null
    },
    username: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 63 ? trimmed : null
    },
    team_name: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
    team_id: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return validate_uuid(trimmed) ? trimmed : null
    },
    role: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim().toLowerCase()
        if (!TEAM_ROLES.includes(trimmed)) return null
        return trimmed
    },
    agent_name: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
    agent_id: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return validate_uuid(trimmed) ? trimmed : null
    },
    tunnel_id: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return validate_uuid(trimmed) ? trimmed : null
    },
    command: (value) => {
        let payload
        if (typeof value === 'string') {
            try {
                payload = JSON.parse(value)
            } catch {
                return null
            }
        } else if (typeof value === 'object') {
            payload = value
        } else {
            return null
        }
        return typeof payload !== 'object' || payload === null ? null : payload
    },
    linking_code: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim().toLowerCase()
        if (trimmed.length === 0) return null
        const parts = trimmed.split('-')
        if (parts.length !== 4) return null
        if (parts.some((part) => part.length === 0)) return null
        return trimmed
    },
    invite_code: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
    public_key: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
    tunnel_public_key: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
    server_name: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
    properties: (value) => {
        let payload
        if (typeof value === 'string') {
            try {
                payload = JSON.parse(value)
            } catch {
                return null
            }
        } else if (typeof value === 'object') {
            payload = value
        } else {
            return null
        }
        return typeof payload !== 'object' || payload === null ? null : payload
    },
    server_id: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return validate_uuid(trimmed) ? trimmed : null
    },
    command_id: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return validate_uuid(trimmed) ? trimmed : null
    },
    server_status: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim().toLowerCase()
        if (!SERVER_STATUS.includes(trimmed)) return null
        return trimmed
    },
    server_port: (value) => {
        const parsed_value = parseInt(value)
        return Number.isSafeInteger(parsed_value) && parsed_value >= MIN_PORT && parsed_value <= MAX_PORT ? parsed_value : null
    },
    command_status: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim().toLowerCase()
        if (!COMMAND_STATUS.includes(trimmed)) return null
        return trimmed
    },
    agent_status: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim().toLowerCase()
        if (!AGENT_STATUS.includes(trimmed)) return null
        return trimmed
    },
    module_id: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return validate_uuid(trimmed) ? trimmed : null
    },
    file_name: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
    module_name: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
    module_metadata: (value) => {
        let payload
        if (typeof value === 'string') {
            try {
                payload = JSON.parse(value)
            } catch {
                return null
            }
        } else if (typeof value === 'object') {
            payload = value
        } else {
            return null
        }
        return typeof payload !== 'object' || payload === null ? null : payload
    },
    logs: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 32768 ? trimmed : null
    },
    logs_start_line: (value) => {
        const parsed_value = parseInt(value)
        return Number.isSafeInteger(parsed_value) ? parsed_value : null
    },
    logs_end_line: (value) => {
        const parsed_value = parseInt(value)
        return Number.isSafeInteger(parsed_value) ? parsed_value : null
    },
    command_feedback: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 1027 ? trimmed : null
    },
    module_type: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim().toLowerCase()
        if (!MODULE_TYPES.includes(trimmed)) return null
        return trimmed
    },
    logs_history_lines: (value) => {
        const parsed_value = parseInt(value)
        return Number.isSafeInteger(parsed_value) ? parsed_value : null
    },
    module_enabled: (value) => {
        const truthy = [true, 'true']
        const falsy = [false, 'false']
        if (truthy.includes(value)) return true
        if (falsy.includes(value)) return false
        return null
    },
    mc_version: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
    code: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
    state: (value) => {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed.length > 0 && trimmed.length <= 255 ? trimmed : null
    },
    server_thumbnail: (value) => {
        if (typeof value !== 'string') return null
        return value.length > 0 && value.length <= 1023 ? value : null
    },
    content: (value) => {
        let payload
        if (typeof value === 'string') {
            try {
                payload = JSON.parse(value)
            } catch {
                return null
            }
        } else if (typeof value === 'object') {
            payload = value
        } else {
            return null
        }
        return typeof payload !== 'object' || payload === null ? null : payload
    },
}
export const load_body_data = ({fields, data_path, bulk = false} = {}) => {
    return async (req, res, next) => {
        try {
            if (req.body === undefined) {
                return res.status(422).json({message: 'Missing body'})
            }

            const is_input_array = Array.isArray(req.body)

            if (is_input_array && !bulk) {
                return res.status(400).json({message: 'Bulk data not allowed'})
            }
            if (!is_input_array && bulk) {
                return res.status(400).json({message: 'Array of items expected'})
            }

            const items = is_input_array ? req.body : [req.body]
            const validated_items = []

            for (const [index, item] of items.entries()) {
                const current_validated = {}
                for (const field of fields) {
                    const raw_value = item[field]

                    if (raw_value === undefined) {
                        return res.status(422).json({
                            message: bulk ? `Item ${index}: Missing ${field}` : `Missing ${field}`,
                        })
                    }

                    const validated_value = validation_logic[field](raw_value)
                    if (validated_value === null) {
                        return res.status(400).json({
                            message: bulk ? `Item ${index}: Invalid ${field}` : `Invalid ${field}`,
                        })
                    }
                    current_validated[field] = validated_value
                }
                validated_items.push(current_validated)
            }

            res.locals[data_path] = bulk ? validated_items : validated_items[0]
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const load_param_data = ({field, data_path} = {}) => {
    return async (req, res, next) => {
        const raw_value = req.params[field]
        if (raw_value === undefined) {
            return res.status(422).json({message: `Missing param: ${field}`})
        }
        if (!validation_logic[field]) {
            logger.error({}, `No validation logic for url parameter: ${field}`)
            return res.status(500).json({message: 'Internal server error'})
        }
        const validated_value = validation_logic[field](raw_value)
        if (validated_value === null) {
            return res.status(400).json({message: `Invalid ${field}`})
        }
        res.locals[data_path] = validated_value
        next()
    }
}

export const load_query_data = ({field, data_path, is_required = true} = {}) => {
    return async (req, res, next) => {
        const raw_value = req.query[field]
        if (raw_value === undefined && is_required) {
            return res.status(422).json({message: `Missing query param: ${field}`})
        }
        if (!validation_logic[field]) {
            logger.error({}, `No validation logic for url query parameter: ${field}`)
            return res.status(500).json({message: 'Internal server error'})
        }
        const validated_value = validation_logic[field](raw_value)
        if (validated_value === null) {
            return res.status(400).json({message: `Invalid ${field}`})
        }
        res.locals[data_path] = validated_value
        next()
    }
}

// === Response handlers ===

export const send_data = ({data_path, status_code = 200} = {}) => {
    return async (req, res, next) => {
        try {
            const data = get_path(res, data_path)
            res.status(status_code).json(data)
        } catch (error) {
            next(error)
        }
    }
}

export const send_data_fixed = ({data, status_code = 200} = {}) => {
    return async (req, res, next) => {
        try {
            res.status(status_code).json(data)
        } catch (error) {
            next(error)
        }
    }
}


export const send_empty = () => {
    return async (req, res, next) => {
        try {
            res.status(204).send()
        } catch (error) {
            next(error)
        }
    }
}

export const redirect = ({url} = {}) => {
    return async (req, res, next) => {
        try {
            res.redirect(url)
        } catch (error) {
            next(error)
        }
    }
}

// === Debug only ===

export const log_data = ({data_path} = {}) => {
    return async (req, res, next) => {
        try {
            const data = get_path(res, data_path)
            logger.debug({data: data}, 'Logging data')
            next()
        } catch (error) {
            next(error)
        }
    }
}