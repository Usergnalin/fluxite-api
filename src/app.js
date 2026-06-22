import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import cors from 'cors'
import mainRoutes from './routes/mainRoutes.js'
import pinoHttp from 'pino-http'
import logger from './providers/logger.js'
import {JSON_MAX_BODY_SIZE} from './configs/constants.js'

const app = express()

const content_security_policy = {
    directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", 'https://fonts.googleapis.com'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'connect-src': [
            "'self'", 
            `https://${process.env.API_BASE}`,
            'https://accounts.google.com'
        ],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'", 'https://accounts.google.com'],
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': [],
    },
}

app.use(
    helmet({
        contentSecurityPolicy: content_security_policy,
        hsts: true,
    }),
)

const allowedOrigins = [`https://www.${process.env.PANEL_BASE}`, `https://${process.env.PANEL_BASE}`]

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true)
            } else {
                callback(null, false)
            }
        },
        credentials: true,
    }),
)

app.disable('x-powered-by')
app.use(pinoHttp({
    logger,
    customLogLevel: (req, res, err) => {
        if (err || res.statusCode >= 500) return 'error'
        if (res.statusCode >= 400) return 'warn'
        return 'info'
    }
}))
app.use(express.json({limit: JSON_MAX_BODY_SIZE}))
app.use(express.urlencoded({extended: false}))
app.use(cookieParser())
app.set('trust proxy', 1)

app.use('/', mainRoutes)

app.use((req, res, _next) => {
    res.status(404).send('Page Not Found')
})

app.use((err, req, res, _next) => {
    try {
        req.log.error(err)
        res.status(500).json({error: 'Internal Server Error'})
    } catch (error) {
        logger.error(error, 'Failed to handle error')
    }
})

export default app
