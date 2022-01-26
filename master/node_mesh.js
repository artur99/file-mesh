const Tools = require("../utils/tools")

class NodeMesh {
    // mesh = null

    constructor(config, logger) {
        this.pingTimeout = config.global.connectionTimeout
        this.logger = logger

        this.mesh = {}
    }

    giveFileMesh(fileMesh) {
        this.fileMesh = fileMesh
    }

    nodeConnected(socket) {
        // ...
    }

    nodePing(socket, data) {
        let nodeID = data.id
        let existed = false
        let wasDead = false

        if(!this.mesh[nodeID]) {
            existed = false

            this.mesh[nodeID] = {
                socket: socket,
                firstStart: Date.now(),
                lastStart: Date.now(),
                alive: true,
                healthy: true
            }

            this.logger.log(`New node connected: ${nodeID}.`)
        }
        else {
            existed = true
            if(this.mesh[nodeID].alive == false) {
                wasDead = true
                this.logger.log(`Node reconnected: ${nodeID}.`)
            }
        }

        if(existed && wasDead) {
            this.mesh[nodeID].healthy = false
            this.mesh[nodeID].lastStart = Date.now()
        }

        this.mesh[nodeID].alive = true
        this.mesh[nodeID].lastPing = Date.now()
        this.mesh[nodeID].socket = socket
        this.mesh[nodeID].fileCount = data.fileCount

        this.mesh[nodeID].data = data

        return nodeID
    }

    getNodes() {
        let list = []
        for(let key of Object.keys(this.mesh)) {
            let node = this.mesh[key]
            list.push({
                id: key,
                name: key,
                alive: node.alive,
                healthy: node.healthy,
                lastPing: node.lastPing,
                firstStart: node.firstStart,
                lastStart: node.lastStart,
                fileCount: node.fileCount,
            })
        }

        return list
    }

    checkAlive() {
        let whoDied = []

        for(let nodeID of Object.keys(this.mesh)) {
            if(!this.mesh[nodeID].alive) continue

            let timeSinceLastPing = Date.now() - this.mesh[nodeID].lastPing


            if(timeSinceLastPing >= this.pingTimeout || !this.mesh[nodeID].socket.connected) {
                this.mesh[nodeID].alive = false
                this.mesh[nodeID].lastDead = Date.now()

                this.logger.log(`Node just died: ${nodeID}.`)

                whoDied.push(nodeID)
            }
        }

        return whoDied
    }


    async commandAdd(fileData, uuid = null) {
        this.checkAlive()
        let fileUUID = uuid || Tools.uuidGen()


        let onlineNodes = Object.keys(this.mesh).filter(x => this.mesh[x].alive).sort((a, b) => {
            return this.mesh[a].fileCount - this.mesh[b].fileCount
        })

        let prom = []

        for(let i in onlineNodes.slice(0, 3)) {
            let nodeID = onlineNodes[i]

            prom.push(new Promise((resolve, reject) => {
                this.mesh[nodeID].socket.emit("ADD", {
                    id: fileUUID,
                    version: 1,
                    data: fileData.content,
                    meta: {
                        name: fileData.name,
                        size: fileData.size
                    }
                }, function(err, ok) {
                    if(err) return reject(err)
                    resolve(ok)
                })
            }))

        }

        return await Promise.all(prom)
    }


    async commandDel(fileData) {
        this.checkAlive()
        let fileID = fileData.id

        let lmx = 40
        while(this.fileMesh.mesh[fileID].locked && lmx-- > 0) Tools.sleep(50)

        this.fileMesh.mesh[fileID].locked = true

        let onlineNodes = Object.keys(this.mesh).filter(x => this.mesh[x].alive)
        let nodeList = Object.keys(this.fileMesh.mesh[fileID].nodes)

        var currentVersion = this.fileMesh.mesh[fileID].nodes[nodeList[0]].version

        let prom = []

        for(let i in nodeList) {
            let nodeID = nodeList[i]
            if(!onlineNodes.includes(nodeID)) continue

            prom.push(new Promise((resolve, reject) => {
                this.mesh[nodeID].socket.emit("DELETE", {
                    id: fileID,
                    version: 100 + currentVersion
                }, function(err, ok) {
                    if(err) return reject(err)
                    resolve(ok)
                })
                setTimeout(() => reject(`Timeout`), 5 * 1000)
            }))

        }

        let res = await Promise.all(prom)

        this.fileMesh.mesh[fileID].locked = false

        return res
    }


}


module.exports = NodeMesh
