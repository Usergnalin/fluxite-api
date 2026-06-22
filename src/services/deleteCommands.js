import logger from  '../providers/logger.js'
import * as command_model from '../models/commandModel.js'
import {TEAM_TYPES, COMMAND_DELETE_BATCH_SIZE} from '../configs/constants.js'

export default async () => {
    logger.info("Starting old command deletion")
    try {
        for (const team_type of Object.keys(TEAM_TYPES)) {
            while (true) {
                const deleted_rows = await command_model.delete_by_team_type(team_type)
                if (deleted_rows.length < COMMAND_DELETE_BATCH_SIZE) break
                await new Promise(r => setTimeout(r, 100))
            }
        }
    } catch (error) {
        logger.error(error, "Failed to delete old commands")
    }
    logger.info("Old command deletion complete")
}
