import nacl from 'tweetnacl'
import {Buffer} from 'node:buffer'
import {get_path} from '../utils.js'
import ms from 'ms'
import jwt from 'jsonwebtoken'
import {set_path} from '../utils.js'
import {AGENT_TOKEN_DURATION, TOKEN_ALGORITHM} from '../configs/constants.js'

const agent_token_duration_ms = ms(AGENT_TOKEN_DURATION)
const agent_token_duration_s = agent_token_duration_ms / 1000

const token_secret = process.env.TOKEN_SECRET
const token_algorithm = TOKEN_ALGORITHM

export const verify_signature = ({public_key_path = 'agent_data.public_key', agent_id_path = 'agent_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const signature = req.headers['x-agent-signature']
            const timestamp = req.headers['x-agent-timestamp']
            const nonce = req.headers['x-agent-nonce']
            if (!signature || !timestamp || !nonce) {
                return res.status(400).json({message: 'Missing security headers'})
            }
            if (isNaN(timestamp)) {
                return res.status(400).json({message: 'Invalid timestamp'})
            }
            const base64_regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
            if (!base64_regex.test(signature)) {
                return res.status(400).json({message: 'Invalid signature'})
            }
            const public_key = get_path(res, public_key_path)
            const agent_id = get_path(res, agent_id_path)
            const message = `${agent_id}:${timestamp}:${nonce}`
            const is_valid = nacl.sign.detached.verify(Buffer.from(message, 'utf8'), Buffer.from(signature, 'base64'), Buffer.from(public_key, 'base64'))
            if (!is_valid) {
                return res.status(403).json({message: 'Invalid signature'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const verify_token_signature = ({public_key_path = 'agent_data.public_key', token_signature_path = 'tunnel_login_data.metas.agent_id', agent_id_path = 'tunnel_login_data.metas.agent_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const public_key = get_path(res, public_key_path)
            const token_signature = get_path(res, token_signature_path)
            const agent_id = get_path(res, agent_id_path)
            const is_valid = nacl.sign.detached.verify(Buffer.from(agent_id, 'utf8'), Buffer.from(token_signature, 'base64'), Buffer.from(public_key, 'base64'))
            if (!is_valid) {
                return res.status(403).json({message: 'Invalid token signature'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const generate_agent_token = ({agent_id_path = 'agent_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const agent_id = get_path(res, agent_id_path)
            const payload = {
                agent_id: agent_id,
            }
            const options = {
                algorithm: token_algorithm,
                expiresIn: agent_token_duration_s,
            }
            const token = jwt.sign(payload, token_secret, options)
            return res.status(200).json(token)
        } catch (error) {
            next(error)
        }
    }
}

export const verify_agent_token = ({agent_id_path = 'agent_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const auth_header = req.headers.authorization
            if (!auth_header || !auth_header.startsWith('Bearer ')) {
                return res.status(401).json({message: 'No token provided'})
            }
            const token = auth_header.split(' ')[1]
            if (!token) {
                return res.status(401).json({message: 'Malformed authorization header'})
            }
            let decoded
            try {
                decoded = jwt.verify(token, token_secret)
            } catch (error) {
                if (error.name === 'TokenExpiredError') {
                    return res.status(401).json({message: 'Token expired'})
                }
                return res.status(401).json({message: 'Invalid token'})
            }
            if (!decoded.agent_id) {
                return res.status(401).json({message: 'Invalid token'})
            }
            set_path(res, agent_id_path, decoded.agent_id)
            res.locals.session_expiry = decoded.exp * 1000
            next()
        } catch (error) {
            next(error)
        }
    }
}
