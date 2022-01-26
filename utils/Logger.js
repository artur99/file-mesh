class Logger {
    name = null

    constructor(name = null) {
        this.name = name
    }

    log(text, type = "info") {
        let date = (new Date()).toISOString().replace("T", " ").split(".")[0]
        type = type.toUpperCase()
        console.log(`[${this.name}] [${type}] [${date}] ${text}`)
    }
}

module.exports = Logger
