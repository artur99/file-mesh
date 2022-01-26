const Logger = require("../utils/logger")
const MemoryHelper = require("./memory")
const Connection = require("./connection")


class Node {
    id = null
    config = null

    constructor(config) {
        this.config = config
        this.id = config.id

        this.logger = new Logger(this.id)
        this.log = this.logger.log

        this.memoryHelper = new MemoryHelper(this.config.storageLocation, this.logger)
        this.connection = new Connection(this.config.masterAddress, this.config, this.logger)

    }

    async init() {
        let self = this
        await this.memoryHelper.init()
        await this.connection.init({
            add: function(){ return self.callbackAdd(...arguments) },
            delete: function(){ return self.callbackDelete(...arguments) },
            update: function(){ return self.callbackUpdate(...arguments) },
            metaQuery: function(){ return self.callbackMetaQuery(...arguments) },
            fileQuery: function(){ return self.callbackFileQuery(...arguments) },
        })


        await this.setNodeTasks()
        await this.pingTask()
    }



    async setNodeTasks() {
        setInterval(_ => this.pingTask(), this.config.global.pingInterval)
        setInterval(_ => this.hashCheckTask(), this.config.global.nodeHashCheckInterval)

    }

    async pingTask() {
        this.connection.ping({
            id: this.config.id,
            fileCount: await this.memoryHelper.getFileCount(),
            fileHash: 0,
        })
    }

    async hashCheckTask() {
        this.memoryHelper.hashCheckTask()
    }




    async callbackAdd(fileData, callback) {
        this.logger.log(`Received ADD request for file with name ${fileData.name}.`, 'info')
        try {
            await this.memoryHelper.addFile(fileData)
            this.logger.log(`Done ADD request for file with name ${fileData.name}.`, 'info')

            if(callback) callback(null, "ok")
        }
        catch(e) {
            this.logger.log(`Error doing ADD for file with name ${fileData.name}: ${e.message}.`, 'error')
            if(callback) callback(e.message)
        }
    }

    async callbackDelete(fileData, callback) {
        this.logger.log(`Received DELETE request for file ${fileData.id}.`, 'info')
        try {
            await this.memoryHelper.deleteFile(fileData)
            this.logger.log(`Done DELETE request for file ${fileData.id}.`, 'info')

            if(callback) callback(null, "ok")
        }
        catch(e) {
            this.logger.log(`Error doing DELETE for file ${fileData.id}: ${e.message}.`, 'error')
            if(callback) callback(e.message)
        }
    }

    async callbackUpdate(fileData, callback) {
        this.logger.log(`Received UPDATE request for file ${fileData.id}.`, 'info')
        try {
            await this.memoryHelper.updateFile(fileData)
            this.logger.log(`Done UPDATE request for file ${fileData.id}.`, 'info')
            if(callback) callback(null, "ok")
        }
        catch(e) {
            this.logger.log(`Error doing UPDATE for file ${fileData.id}: ${e.message}.`, 'error')
            if(callback) callback(e.message)
        }
    }

    async callbackMetaQuery(callback) {
        try {
            let files = await this.memoryHelper.getFileMeta()
            if(callback) callback(null, JSON.stringify({ files: files }))
        }
        catch(e) {
            if(callback) callback(e.message)
        }

    }

    async callbackFileQuery(fileID, callback) {
        try {
            let fileData = await this.memoryHelper.getFile(fileID, true)
            if(callback) callback(null, JSON.stringify({ file: fileData }))
        }
        catch(e) {
            if(callback) callback(e.message)
        }
    }







    run() {
        if(typeof GLOBAL_DEBUG !== 'undefined') {
            setInterval(_ => {
                let newFiles = Object.keys(this.memoryHelper.memory.files).join(", ")
                if(newFiles == this.lastFiles) return

                console.log(`Running (${this.config.id}). Files: ${newFiles}`)
                this.lastFiles = newFiles
            }, 5000)
        }
        
    }
}


module.exports = Node
