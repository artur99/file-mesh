const { io } = require("socket.io-client")



class Connection {
    // serverLocation = null
    // socket = null

    constructor(serverLocation, nodeConfig, logger) {
        this.serverLocation = serverLocation
        this.nodeConfig = nodeConfig
        this.logger = logger

    }

    init(callbacks) {
        return new Promise((resolve, reject) => {
            this.logger.log("Connecting to server....")

            this.socket = io(`http://${this.serverLocation.address}:${this.serverLocation.port}`)

            this.socket.on("connect", () => {
                this.logger.log("Connected!")
                resolve()
            })

            this.socket.on("connect_error", (e) => {
                reject(new Error(`Connection error: ${e.message}`))
            })

            this.socket.on("connect_failed", (e) => {
                reject(new Error(`Connection failed error: ${e.message}`))
            })

            let expectedCallbacks = ['add', 'delete', 'update', 'metaQuery', 'fileQuery']
            for(let cb of expectedCallbacks) {
                if(!callbacks[cb]) {
                    reject(new Error(`Missing ${cb} callback for socket connection.`))
                }
            }


            this.socket.on("ADD", callbacks.add)
            this.socket.on("DELETE", callbacks.delete)
            this.socket.on("UPDATE", callbacks.update)
            this.socket.on("MetaQuery", callbacks.metaQuery)
            this.socket.on("FileQuery", callbacks.fileQuery)
        })
    }

    ping(pingData) {
        this.socket.emit("ping", pingData)
    }

}


module.exports = Connection
