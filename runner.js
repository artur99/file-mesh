const fs = require('fs')


globalConfigs = {
    pingInterval: 5 * 1000,
    connectionTimeout: 20 * 1000,
    nodeHashCheckInterval: 25 * 1000,
    nodeStorageLocation: "./.storage/",
    general: {
        "masterAddress": "127.0.0.1",
        "masterPort": 3000
    }
}

async function runMaster(masterAddress) {
    const Master = require("./master/master")

    let master = new Master({
        masterAddress: masterAddress,
        global: globalConfigs
    })

    try {
        await master.init()
        master.run()

    }
    catch(err) {
        console.error(`Master startup failed: ${err.message}`)
        process.exit(4)
    }
}

async function runNode(masterAddress, nodeName, nodeStorage) {
    const Node = require("./nodes/node")

    let node = new Node({
        id: nodeName,
        storageLocation: nodeStorage,
        masterAddress: masterAddress,
        global: globalConfigs
    })

    try {
        await node.init()
        node.run()

    }
    catch(err) {
        console.error(`Node startup failed: ${err.message}`)
        process.exit(3)
    }
}


async function main(args) {
    if(args.length <= 2) {
        console.error("Missing argument. Usage: 'node runner MASTER' or 'node runner NODE <x>' where <x> is node name")
        process.exit(1)
    }


    let masterAddress = globalConfigs.general.masterAddress
    let masterPort = globalConfigs.general.masterPort
    let masterLocation = {address: masterAddress, port: masterPort}


    let type = args[2]

    if(type == "MASTER") {
        return await runMaster(masterLocation)
    }

    if(type == "NODE") {
        if(args.length <= 3) {
            console.error("Missing node name to start. Usage: 'node runner NODE <x>' where <x> is node name")
            process.exit(1)
        }

        let nodeName = args[3].trim().toLowerCase()
        let nodeStorage = globalConfigs.nodeStorageLocation + nodeName + "/"


        if(!nodeName.match(/^[a-z0-9]+$/i)) {
            console.error("Invalid node name, must contain alphanumeric characters only.")
            process.exit(2)
        }

        return await runNode(masterLocation, nodeName, nodeStorage)
    }

    console.log("Invalid command. Usage: 'node runner MASTER' or 'node runner NODE <x>', where <x> is node name")
    process.exit(4)
}


main(process.argv)
