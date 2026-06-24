import {redis_client} from '../providers/redis.js'
import {OAUTH_NONCE_MAX_DURATION} from '../configs/constants.js'
import * as identity_model from '../models/identityModel.js'
import * as user_model from '../models/userModel.js'
import {OAuth2Client} from 'google-auth-library'
import {get_path, set_path} from '../utils.js'
import crypto from 'crypto'
import ms from 'ms'

const google_oauth_client = new OAuth2Client(process.env.OAUTH_CLIENT_ID)

const nonce_duration_s = ms(OAUTH_NONCE_MAX_DURATION) / 1000

export const generate_oauth_url = ({oauth_url_path = "oauth_url"} = {}) => {
    return async (req, res, next) => {
        try {
            const oauth_nonce = crypto.randomBytes(32).toString('hex')
            await redis_client.set(`oauth_nonce:${oauth_nonce}`, '1', "EX", nonce_duration_s)
            const url = new URL(process.env.OAUTH_AUTH_URL)
            url.searchParams.set('client_id', process.env.OAUTH_CLIENT_ID)
            url.searchParams.set('redirect_uri', `https://${process.env.API_BASE}/auth/google/callback`)
            url.searchParams.set('response_type', 'code')
            url.searchParams.set('scope', 'openid profile')
            url.searchParams.set('state', oauth_nonce)
            const oauth_url = url.toString()
            console.log(oauth_url)
            set_path(res, oauth_url_path, oauth_url)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const validate_nonce = ({nonce_path = "state"} = {}) => {
    return async (req, res, next) => {
        try {
            const oauth_nonce = get_path(res, nonce_path)
            const result = await redis_client.del(`oauth_nonce:${oauth_nonce}`)
            if (result === 0) {
                return res.status(401).json({message: 'Invalid Oauth nonce'})
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const exchange_code = ({code_path = "code", provider_user_id_path = "provider_user_id", oauth_username_path = "oauth_username"} = {}) => {
    return async (req, res, next) => {
        try {
            const code = get_path(res, code_path)
            const response = await fetch(process.env.OAUTH_TOKEN_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: new URLSearchParams({
                    code,
                    client_id: process.env.OAUTH_CLIENT_ID,
                    client_secret: process.env.OAUTH_CLIENT_SECRET,
                    redirect_uri: `https://${process.env.API_BASE}/auth/google/callback`,
                    grant_type: 'authorization_code',
                })
            })
            const {id_token} = await response.json()
            const ticket = await google_oauth_client.verifyIdToken({ 
                idToken: id_token,
                audience: process.env.OAUTH_CLIENT_ID,
            })
            const payload = ticket.getPayload()
            const provider_user_id = payload['sub']
            const oauth_username = payload['name'] || payload['given_name'] || null
            set_path(res, provider_user_id_path, provider_user_id)
            set_path(res, oauth_username_path, oauth_username)
            next()
        } catch (error) {
            next(error)
        }
    }
}

export const get_or_create_oauth_user = ({provider, provider_user_id_path = "provider_user_id", oauth_username_path = "oauth_username", output_user_id_path = "user_id"} = {}) => {
    return async (req, res, next) => {
        try {
            const provider_user_id = get_path(res, provider_user_id_path)
            const oauth_username = get_path(res, oauth_username_path)
            const select_result = await identity_model.select_by_provider_user_id_and_provider(provider, provider_user_id, ['user_id'])
            let user_id
            if (!select_result) {
                const insert_result = await user_model.insert_single_with_identity(provider, provider_user_id, oauth_username)
                user_id = insert_result.user_id
            } else {
                user_id = select_result.user_id
            }
            set_path(res, output_user_id_path, user_id)
            next()
        } catch (error) {
            next(error)
        }
    }
}