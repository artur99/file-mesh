const fs = require("fs").promises
const fsc = require("fs").constants
const crc32 = require('js-crc').crc32

const StorageHelper = require("./storage")


class MemoryHelper {
    storageLocation = null
    memoryFile = null
    memory = null
    deletionTimeout = 48 * 60 * 60 * 1000 // 2 days

    constructor(storageLocation, logger) {
        this.storageLocation = storageLocation
        this.memoryFile = storageLocation + '/' + 'memory.json'
        this.logger = logger

        this.memory = {files: {}}
        this.storage = new StorageHelper(storageLocation, logger)

    }

    async init() {
        await this.ensureDirs()
        await this.storage.init()

        // Load in-file memory
        await this.loadMemory()

        await this.hashCheckTask()

        // Initial commit
        await this.saveMemory()
    }

    async ensureDirs() {
        await fs.mkdir(this.storageLocation, {recursive: true})
    }

    async loadMemory() {
        var tmp_memory = null
        try {
            var memory_data = await fs.readFile(this.memoryFile, "utf-8")
            var memory_parsed = JSON.parse(memory_data)
            if(typeof memory_parsed.files != "object") {
                this.logger.log(`Invalid memory file: missing or invalid key: 'files'.`)
            }
            else {
                tmp_memory = memory_parsed
            }
        }
        catch (e) {
            if(e.code != 'ENOENT') {
                this.logger.log(`Failed reading/parsing memory file ${this.memoryFile}: ${e.message}`)
            }
            // File doesn't exist yet
            // Just continue
        }
        if(tmp_memory !== null) {
            this.memory = tmp_memory
        }
        return this.memory
    }

    async saveMemory(memoryData = null) {
        if(memoryData == null) {
            memoryData = this.memory
            // throw new Error(`Memory is null. Cannot save null memory (${JSON.stringify(memoryData)}).`)
        }

        let memory_json = JSON.stringify(memoryData)

        try {
            await fs.writeFile(this.memoryFile, memory_json, "utf-8")
        }
        catch (e) {
            throw new Error(`Failed writing memory file ${this.memoryFile}: ${e.message}.`)
        }
    }

    async getFileCount() {
        return Object.keys(this.memory.files)
            .filter(f => this.memory.files[f].status != "deleted").length
    }

    async getFileMeta() {
        return this.memory.files
    }

    objectCRC(obj) {
        let out_str = Object.keys(obj)
            .sort()
            .map(k => `${k}:${obj[k]}`)
            .join('/')

        return crc32(out_str)
    }


    async hashCheckTask() {
        for(let fileID of Object.keys(this.memory.files)) {
            let file = this.memory.files[fileID]

            if(file.locked) continue

            if(file.status != "live") {
                if(file.status == "deleted" && Date.now() - file.dateDeleted > this.deletionTimeout) {
                    // Cleanup
                    delete this.memory.files[fileID]
                }
            }

            let metaCRC = this.objectCRC(file.meta)
            if(metaCRC != file.metaCRC) {
                this.logger.log(`Corrupted metaCRC found for file ${fileID}. Old one was ${file.metaCRC}, updated to ${metaCRC}.`)
                file.metaCRC = metaCRC
            }

            let fileDataCRC = await this.storage.getCRC(fileID)
            if(fileDataCRC != file.fileCRC) {
                this.logger.log(`Corrupted file data CRC found for file ${fileID}. Old one was ${file.fileCRC}, updated to ${fileDataCRC}.`)
                file.fileCRC = fileDataCRC
            }
        }
        return true
    }


    async addFile(fileData) {
        let fileID = fileData.id
        let fileVersion = fileData.version
        let fileDataB64 = fileData.data
        let fileMeta = fileData.meta
        let fileNmae = fileMeta.name

        this.memory.files[fileID] = {
            id: fileID,
            version: fileVersion,
            meta: fileMeta,
            locked: true,
            status: "pending",

            dateAdded: Date.now(),
            dateUpdated: Date.now(),
            dateDeleted: null
        }

        await this.storage.addFile(fileID, fileDataB64)

        let fileDataCRC = await this.storage.getCRC(fileID)
        let metaCRC = this.objectCRC(fileMeta)
        this.memory.files[fileID].fileCRC = fileDataCRC
        this.memory.files[fileID].metaCRC = metaCRC


        let theFile = this.memory.files[fileID]
        this.logger.log(`Added file ${fileID} v${theFile.version} (${theFile.meta.name}).`)

        this.memory.files[fileID].status = fileData.status || "live"
        this.memory.files[fileID].locked = false

        this.saveMemory()
        return true
    }


    async updateFile(fileData) {
        let fileID = fileData.id
        let fileVersion = fileData.version
        let fileDataB64 = fileData.data
        let fileMeta = fileData.meta
        let fileName = fileMeta.name

        if(!this.memory.files[fileID]) {
            throw new Error(`This file doesn't exist.`)
        }

        this.memory.files[fileID].locked = true


        if(fileVersion) this.memory.files[fileID].version = fileVersion
        if(fileMeta) this.memory.files[fileID].meta = fileMeta

        if(fileData.status) {
            if(fileData.status == "deleted" && this.memory.files[fileID].status != "deleted") {
                await this.storage.deleteFile(fileID)
            }
            this.memory.files[fileID].status = fileData.status
        }

        this.memory.files[fileID].dateUpdated = fileData.dateUpdated || Date.now()

        if(fileData.dateAdded) this.memory.files[fileID].dateAdded = fileData.dateAdded
        if(fileData.dateDeleted) this.memory.files[fileID].dateDeleted = fileData.dateDeleted


        if(fileDataB64) {
            await this.storage.updateFile(fileID, fileDataB64)
        }

        let fileDataCRC = await this.storage.getCRC(fileID)
        let metaCRC = this.objectCRC(this.memory.files[fileID].meta)
        this.memory.files[fileID].fileCRC = fileDataCRC
        this.memory.files[fileID].metaCRC = metaCRC


        let theFile = this.memory.files[fileID]
        this.logger.log(`Updated file ${fileID} v${theFile.version} (${theFile.meta.name}).`)

        this.memory.files[fileID].locked = false

        this.saveMemory()
        return true
    }


    async deleteFile(fileData) {
        let fileID = fileData.id

        if(!this.memory.files[fileID]) {
            throw new Error(`This file doesn't exist.`)
        }

        if(fileData.force) {
            await this.storage.deleteFile(fileID)
            delete this.memory.files[fileID]

            this.saveMemory()
            return true
        }

        // let fileVersion = this.memory.files[fileID].version
        // let fileVersion = this.memory.files[fileID].version

        this.memory.files[fileID].locked = true

        this.memory.files[fileID].status = "deleted"
        this.memory.files[fileID].meta.deleted = true
        this.memory.files[fileID].dateDeleted = Date.now()
        this.memory.files[fileID].version = fileData.version


        await this.storage.deleteFile(fileID)


        this.logger.log(`Deleted file ${fileID} (${this.memory.files[fileID].meta.name}).`)

        this.memory.files[fileID].locked = false


        this.saveMemory()
        return true
    }


    async getFile(fileID, getContent = false) {
        if(!this.memory.files[fileID]) {
            throw new Error(`This file doesn't exist.`)
        }

        if(getContent) {
            var fileContentB64 = await this.storage.getFile(fileID)
        }

        let theFile = this.memory.files[fileID]
        this.logger.log(`File requested: ${fileID} v${theFile.version} (${theFile.meta.name}).`)



        let retFileData = {
            ...theFile
        }

        delete retFileData.locked

        if(getContent) {
            retFileData.data = fileContentB64
        }

        return retFileData
    }


}


module.exports = MemoryHelper
