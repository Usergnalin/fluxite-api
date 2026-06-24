import pino from 'pino'

export default pino({
    level: process.env.LOG_LEVEL,
    redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            singleLine: true,
            ignore: 'pid,hostname',
        },
    },
})
