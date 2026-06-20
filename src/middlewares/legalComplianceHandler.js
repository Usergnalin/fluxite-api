import * as user_model from '../models/userModel.js'
import {get_path} from '../utils.js'
import {LEGAL_COMPLIANCE_VERSION, TOKEN_ALGORITHM, USER_PARTIAL_LOGIN_TOKEN_DURATION} from '../configs/constants.js'
import jwt from 'jsonwebtoken'
import ms from 'ms'

const token_secret = process.env.TOKEN_SECRET
const token_algorithm = TOKEN_ALGORITHM

const user_partial_login_token_duration_ms = ms(USER_PARTIAL_LOGIN_TOKEN_DURATION)
const user_partial_login_token_duration_s = user_partial_login_token_duration_ms / 1000

export const check_user_legal_compliance_by_user_id = ({user_id_path = 'user_id'} = {}) => {
    return async (req, res, next) => {
        try {
            const user_id = get_path(res, user_id_path)
            const results = await user_model.select_by_user_id(user_id, ['accepted_legal_compliance_version', 'legal_compliance_accepted_at'])
            if (results === undefined) {
                return res.status(404).json({message: 'User not found'})
            }
            if (results.accepted_legal_compliance_version < LEGAL_COMPLIANCE_VERSION) {
                const options = {
                    algorithm: token_algorithm,
                    expiresIn: user_partial_login_token_duration_s,
                }
                const partial_login_token = jwt.sign({user_id}, token_secret, options)
                res.clearCookie('session_token', {
                    domain: `.${process.env.DOMAIN}`,
                    path: '/',
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                })
                res.clearCookie('refresh_token', {
                    domain: `.${process.env.DOMAIN}`,
                    path: '/auth',
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                })
                res.cookie('partial_login_token', partial_login_token, {
                    domain: `.${process.env.DOMAIN}`,
                    path: '/auth',
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                    maxAge: user_partial_login_token_duration_ms,
                })  
                return res.redirect(`https://${process.env.PANEL_BASE}/legal`)
            }
            next()
        } catch (error) {
            next(error)
        }
    }
}