const fs = require("fs").promises
const fsc = require("fs").constants
const crc32 = require('js-crc').crc32


class StorageHelper {
    fileStorage = null

    constructor(storageLocation, logger) {
        this.storageLocation = storageLocation
        this.fileStorage = storageLocation + '/' + 'files/'

        this.logger = logger
    }

    async init() {
        await this.ensureDirs()

    }

    async ensureDirs() {
        await fs.mkdir(this.fileStorage, {recursive: true})
    }


    async getFile(fileID) {
        let filePath = this.fileStorage + '/' + fileID


        try {
            var fileData = await fs.readFile(filePath)
        }
        catch (e) {
            if (e.code === 'ENOENT') return btoa("")
            throw e
        }

        return btoa(fileData)
    }

    async getCRC(fileID) {
        let filePath = this.fileStorage + '/' + fileID

        try {
            var fileData = await fs.readFile(filePath)
        }
        catch (e) {
            if (e.code === 'ENOENT') return crc32("")
            throw e
        }

        return crc32(fileData)
    }

    async addFile(fileID, fileContent) {
        let filePath = this.fileStorage + '/' + fileID
        let rawContent = atob(fileContent)

        await fs.writeFile(filePath, rawContent)

        // return crc32(rawContent)
        return true
    }

    async updateFile(fileID, fileContent) {
        let filePath = this.fileStorage + '/' + fileID
        let rawContent = atob(fileContent)

        await fs.writeFile(filePath, rawContent)

        // return crc32(rawContent)
        return true
    }

    async deleteFile(fileID) {
        let filePath = this.fileStorage + '/' + fileID

        try {
            await fs.unlink(filePath)
        }
        catch (e) {
            if (e.code === 'ENOENT') return true
            throw e
        }

        return true
    }

}


module.exports = StorageHelper
