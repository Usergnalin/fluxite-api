import mysql from 'mysql2/promise'
import logger from './logger.js'
import fs from 'fs'
import path from 'path'

const setting = {
    connectionLimit: 100,
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    multipleStatements: true,
    dateStrings: true,
}

if (process.env.MYSQL_USE_SSL === 'true') {
    try {
        const cert_path = path.join(process.cwd(), 'ca-certificate.crt')
        setting.ssl = {
            ca: fs.readFileSync(cert_path),
        }
        logger.info({}, 'MySQL SSL enabled')
    } catch (error) {
        logger.fatal(error, 'Failed to configure MySQL SSL')
        throw error
    }
} else {
    logger.warn('MySQL connecting without SSL')
}

const pool = mysql.createPool(setting)

export default pool
