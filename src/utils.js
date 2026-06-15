import crypto from 'node:crypto'
import ms from 'ms'
import logger from './providers/logger.js'
import {SSE_HEARTBEAT_INTERVAL, NET_BASE, HOST_MIN, HOST_MAX} from './configs/constants.js'
import {predicates, objects} from 'friendly-words'
import {redis_client} from './providers/redis.js'

const sse_heartbeat_interval = ms(SSE_HEARTBEAT_INTERVAL)

export const generate_phrase = () => {
    const p1 = predicates[crypto.randomInt(0, predicates.length)]
    const o1 = objects[crypto.randomInt(0, objects.length)]
    const p2 = predicates[crypto.randomInt(0, predicates.length)]
    const o2 = objects[crypto.randomInt(0, objects.length)]
    return `${p1}-${o1}-${p2}-${o2}`
}

export const get_path = (res, path) => {
    const result = path.split('.').reduce((accumulator, property) => {
        if (accumulator && accumulator[property] !== undefined) {
            return accumulator[property]
        }
        return undefined
    }, res.locals)

    if (result === undefined) {
        throw new Error(`Invalid data path: ${path}`)
    }

    return result
}

export const set_path = (res, path, value) => {
    if (path === undefined || path === null || typeof path !== 'string') return

    const properties = path.split('.')
    const last_property = properties.pop()

    const target_object = properties.reduce((accumulator, property) => {
        if (accumulator[property] === undefined) {
            accumulator[property] = {}
        }
        return accumulator[property]
    }, res.locals)

    target_object[last_property] = value
}

export const filter_object = (object, allowed_keys) => {
    return allowed_keys.reduce((obj, key) => {
        if (key in object) {
            obj[key] = object[key]
        }
        return obj
    }, {})
}

export const create_stream = (res, {on_heartbeat, on_close, session_expiry, session_id}) => {
    let is_stopped = false

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    })

    const stop = () => {
        if (is_stopped) return
        is_stopped = true
        clearInterval(heartbeat_timer)
        on_close()
        if (!res.writableEnded) res.end()
    }

    const perform_heartbeat = async () => {
        if (is_stopped) return

        if (session_expiry && Date.now() > session_expiry) {
            if (res.writable) res.write(`data: {"message": "Session expired"}\n\n`)
            return stop()
        }

        if (session_id) {
            try {
                const revoked = await redis_client.exists(`revoked_session:${session_id}`)

                if (revoked) {
                    if (res.writable) res.write(`data: {"message": "Session expired"}\n\n`)
                    return stop()
                }

                if (res.writable && res.write(': keep-alive\n\n')) {
                    if (typeof on_heartbeat === 'function') on_heartbeat(stop)
                } else {
                    stop()
                }
            } catch (err) {
                logger.error({err, session_id}, 'Redis error during SSE heartbeat')
                stop()
            }
        } else {
            if (res.writable && res.write(': keep-alive\n\n')) {
                if (typeof on_heartbeat === 'function') on_heartbeat(stop)
            } else {
                stop()
            }
        }
    }

    perform_heartbeat()
    const heartbeat_timer = setInterval(perform_heartbeat, sse_heartbeat_interval)
    res.on('close', stop)

    return {
        send: (data) => {
            if (is_stopped || !res.writable) return false
            return res.write(`data: ${JSON.stringify(data)}\n\n`)
        },
        stop,
    }
}

const special_formats_select = {
    user_id: (prefix) => `BIN_TO_UUID(${prefix}user_id) AS user_id`,
    agent_id: (prefix) => `BIN_TO_UUID(${prefix}agent_id) AS agent_id`,
    module_id: (prefix) => `BIN_TO_UUID(${prefix}module_id) AS module_id`,
    team_id: (prefix) => `BIN_TO_UUID(${prefix}team_id) AS team_id`,
    server_id: (prefix) => `BIN_TO_UUID(${prefix}server_id) AS server_id`,
    session_id: (prefix) => `BIN_TO_UUID(${prefix}session_id) AS session_id`,
    command_id: (prefix) => `BIN_TO_UUID(${prefix}command_id) AS command_id`,
    tunnel_id: (prefix) => `BIN_TO_UUID(${prefix}tunnel_id) AS tunnel_id`,
    tunnel_ip: (prefix) => `INET_NTOA(${prefix}tunnel_ip) AS tunnel_ip`,
}

export const format_columns_select = (columns, prefix = '') => {
    const formatted_prefix = prefix ? `${prefix}.` : ''
    const formatted_columns = columns.map((column) => {
        if (special_formats_select[column]) {
            return special_formats_select[column](formatted_prefix)
        }
        return `${formatted_prefix}${column}`
    })
    return formatted_columns.join(', ')
}

export const compare_versions = (a, b) => {
    const parse = (v) => v.split(/[.-]/).map((part) => (/^\d+$/.test(part) ? parseInt(part, 10) : part))
    const parts_a = parse(a)
    const parts_b = parse(b)

    for (let i = 0; i < Math.max(parts_a.length, parts_b.length); i++) {
        const part_a = parts_a[i]
        const part_b = parts_b[i]

        if (part_a === undefined) return -1
        if (part_b === undefined) return 1

        if (typeof part_a === 'number' && typeof part_b === 'number') {
            if (part_a !== part_b) return part_a - part_b
        } else if (part_a !== part_b) {
            return String(part_a).localeCompare(String(part_b))
        }
    }
    return 0
}

export const ip_to_int = (ip) => {
  return ip.split('.').reduce((a, o) => ((a << 8) >>> 0) + Number(o), 0) >>> 0
}
export const int_to_ip = (n) => {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}
export const random_tunnel_ip = () => {
  return NET_BASE + HOST_MIN + Math.floor(Math.random() * (HOST_MAX - HOST_MIN + 1))
}