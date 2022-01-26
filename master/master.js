const express = require('express');
const http = require('http');
const { Server } = require("socket.io")

const Logger = require("../utils/logger")
const Tools = require("../utils/tools")
const FileMesh = require("./file_mesh")
const NodeMesh = require("./node_mesh")

const app = express()
const server = http.createServer(app)
const io = new Server(server)
app.use(express.json({limit: '500mb'}))

meshCheckAliveInterval = 2.5 * 1000
requestMetaInterval = 10 * 1000
meshCorrectnessValidation = 10 * 1000

class Master {
    clientSocketList = null

    constructor(config) {
        this.masterPort = config.masterAddress.port
        this.clientSocketList = {}

        this.logger = new Logger("MASTER")

        this.nodeMesh = new NodeMesh(config, this.logger)
        this.fileMesh = new FileMesh(config, this.logger)

        this.nodeMesh.giveFileMesh(this.fileMesh)
        this.fileMesh.giveNodeMesh(this.nodeMesh)

    }

    async init() {
        await this.initRoutes()

    }

    async run() {

        server.listen(this.masterPort, () => {
            this.logger.log('Listening on *:' + this.masterPort);
        })



        setInterval(_ => this.nodeMesh.checkAlive(), meshCheckAliveInterval)
        setInterval(_ => this.fileMesh.requestMeta(), requestMetaInterval)
        setInterval(_ => this.fileMesh.validateCorrectness(), meshCorrectnessValidation)
    }


    async initRoutes() {
        app.get('/style.css', (req, res) => res.sendFile(__dirname + '/templates/style.css'))
        app.get('/main.js', (req, res) => res.sendFile(__dirname + '/templates/main.js'))
        app.get('/nodes.js', (req, res) => res.sendFile(__dirname + '/templates/nodes.js'))
        app.get('/', (req, res) => {
            res.sendFile(__dirname + '/templates/main.html');
        })
        app.get('/nodes', (req, res) => {
            res.sendFile(__dirname + '/templates/nodes.html');
        })


        app.get('/api/getFiles', async (req, res) => {
            res.json({files: this.fileMesh.getFileList()})
        })


        app.get('/api/getNodes', async (req, res) => {
            res.json({nodes: this.nodeMesh.getNodes()})
        })

        app.post('/api/add', async (req, res) => {
            let fileData = req.body

            if(!fileData.size) return res.json({error: 'Invalid size for file.'})
            if(!fileData.content) return res.json({error: 'Empty file?'})
            if(!fileData.name) return res.json({error: 'Invalid name for file.'})

            try {
                this.logger.log(`Received ADD request for file with name: ${fileData.name}`, 'info')
                let cmd_res = await this.nodeMesh.commandAdd(fileData)
                this.logger.log(`Successfully added file with name: ${fileData.name}`, 'info')

                try { await this.fileMesh.requestMeta() } catch(e) {}
                res.json({success: `Uploaded successfully to ${cmd_res.length} nodes.`})
            }
            catch(e) {
                res.json({error: e.message})
            }
        })

        app.post('/api/delete', async (req, res) => {
            let fileData = req.body

            if(!fileData.id) return res.json({error: 'Invalid file ID.'})

            try {
                this.logger.log(`Received DELETE request for file ${fileData.id}`, 'info')
                let cmd_res = await this.nodeMesh.commandDel(fileData)
                this.logger.log(`Successfully deleted ${fileData.id}`, 'info')

                try { await this.fileMesh.requestMeta() } catch(e) {}
                res.json({success: `Successfuly deleted file from ${cmd_res.length} nodes.`})
            }
            catch(e) {
                res.json({error: e.message})
            }
        })





        io.on('connection', (socket) => {
            let firstPing = true
            socket.on("ping", (conf) => {
                let nodeID = this.nodeMesh.nodePing(socket, conf)

                if(firstPing) {
                    firstPing = false
                    let nodeRef = this.nodeMesh.mesh[nodeID]
                    this.fileMesh.requestMetaNode(nodeRef, nodeID)
                }
            })

        })
    }


}
module.exports = Master
