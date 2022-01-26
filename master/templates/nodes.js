var GLOBAL_FileCache = null;
var GLOBAL_NodeCache = null;
var GLOBAL_ActiveFile = null;
var GLOBAL_ActiveNode = null;


var updateNodeList = async function() {
    document.querySelector(".loading-inforer").style.display = "inline"
    let res_nodes = await fetch("/api/getNodes").then(x => x.json())
    let nodes = res_nodes.nodes.sort((a, b) => a.id.localeCompare(b.id))
    GLOBAL_NodeCache = nodes

    let html = ''

    for(let node of nodes) {
        html += `<div class="node ${GLOBAL_ActiveNode == node.id ? 'active' : ''} ${!node.alive ? 'off' : ''}" data-id="${node.id}">
            <div class="icon"><span class="material-icons">cloud</span></div>
            <div class="name">${node.id}</div>
            <div class="health ${!node.healthy || !node.alive ? "bad": ""}">${node.alive ? (node.healthy ? "Healthy" : "Bad health") : "Offline"}</div>
            <div class="meta">${node.fileCount} <span class="material-icons">insert_drive_file</span></div>
            <div class="fbubbles">
                ${Array.from(Array(node.fileCount).keys()).map(x => `<span></span>`).join('')}
                ${node.fileCount == 0 ? '<span class="filler"></span>' : ''}
            </div>
        </div>`
    }
    if(!nodes.length) {
        html = ''
    }

    document.querySelector(".nodes-container").innerHTML = html

    document.querySelectorAll(".nodes-container .node").forEach(el => el.onclick = e => {
        e.preventDefault()
        let nodeID = el.dataset.id

        let oldActive = document.querySelector(".nodes-container .node.active")
        if(oldActive) oldActive.classList.remove("active")

        el.classList.add("active")

        fillNodePanel(nodeID)
    })

    document.querySelector(".loading-inforer").style.display = "none"
}

var fillNodePanel = function(nodeID = null) {
    if(nodeID == null) nodeID = GLOBAL_ActiveNode
    else GLOBAL_ActiveNode = nodeID

    if(!nodeID) return

    let nodeData = GLOBAL_NodeCache.filter(x => x.id == nodeID)[0]
    let panel = document.querySelector(".screen-node")

    panel.querySelector("h2").innerHTML = nodeData.id
    panel.querySelector(".alive").innerHTML = `${nodeData.alive ? 'true' : 'false'}`
    panel.querySelector(".healthy").innerHTML = `${nodeData.healthy ? 'true' : 'false'}`
    panel.querySelector(".file-count").innerHTML = `${nodeData.fileCount}`
    panel.querySelector(".last-ping").innerHTML = `${beautifyPeriod(nodeData.lastPing)} ago`
    panel.querySelector(".first-start").innerHTML = `${beautifyPeriod(nodeData.firstStart)} ago`
    panel.querySelector(".last-start").innerHTML = `${beautifyPeriod(nodeData.lastStart)} ago`


    return
    panel.querySelector(".size").innerHTML = beautifySize(fileData.info.meta.size)
    panel.querySelector(".date-added").innerHTML = (new Date(fileData.info.dateAdded)).toString().split("GMT")[0]

    panel.querySelector(".replica-list").innerHTML = fileData.nodes.map(x => `<span class="replica-entry">${x.substr(4)}</span>`).join('')
}


document.addEventListener("DOMContentLoaded", function(e) {
    document.querySelector(".btn.refresh-btn").onclick = function(e) {
        e.preventDefault()
        updateNodeList()
    }

    updateNodeList()
})
