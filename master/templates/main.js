var GLOBAL_FileCache = null;
var GLOBAL_NodeCache = null;
var GLOBAL_ActiveFile = null;
var GLOBAL_ActiveNode = null;

const escapeHtml = (unsafe) => {
    return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
const round = function(num, dec = 2) {
    return Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
}
const beautifySize = size => {
    let steps = ['B', 'KB', 'MB', 'GB']
    for(let step of steps) {
        if(size < 1024) {
            return `${round(size, 2)} ${step}`
        }
        size /= 1024
    }
}
const beautifyPeriod = startTime => {
    let diff = Math.round((Date.now() - startTime) / 1000)
    if(diff < 60) return `${diff} sec`

    diff = round(diff / 60, 0)
    if(diff < 60) return `${diff} min`

    diff = round(diff / 60, 1)
    if(diff < 24) return `${diff} hours`

    diff = round(diff / 24, 1)
    if(diff < 24) return `${diff} days`


}

let fileReaderB64 = function(fileObj) {
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.readAsDataURL(fileObj);

        reader.onload = function () {
            let b64_only = reader.result.split('base64,', 2)
            if(b64_only.length <= 1) {
                return reject(new Error("File read failed, invalid base64 encoding."))
            }

            resolve(b64_only[1])
        }
        reader.onerror = function (error) { reject(error) }
    })
}


let actionAddFile = async function() {
    let file = document.querySelector("#file-input")
    let fileObj = file.files[0]

    if(!fileObj) {
        return Swal.fire("Error", "Please select a file to upload.", 'error')
    }

    let fileContents = await fileReaderB64(fileObj)
    let fileData = {
        size: fileObj.size,
        name: fileObj.name,
        content: fileContents
    }

    let res = await fetch("/api/add", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fileData)
    }).then(x => x.json())

    if(res.error) Swal.fire("Error", res.error, 'error')
    else if(res.success) Swal.fire("Success", res.success, 'success')
    else Swal.fire("Success", "File added...", 'success')

    document.querySelector("#file-input").value = ""

    updateFileList()
}


let actionDelFile = async function(fileID) {
    let fileData = { id: fileID }

    let res = await fetch("/api/delete", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fileData)
    }).then(x => x.json())

    if(res.error) Swal.fire("Error", res.error, 'error')
    else if(res.success) Swal.fire("Success", res.success, 'success')
    else Swal.fire("Success", "File deleted...", 'success')

    updateFileList()

    if(fileID == GLOBAL_ActiveFile) {
        updatePanel('upload')
    }
}

let updateFileList = async function() {
    document.querySelector(".loading-inforer").style.display = "inline"
    let res = await fetch("/api/getFiles").then(x => x.json())
    let res_nodes = await fetch("/api/getNodes").then(x => x.json())
    let files = res.files.sort((a, b) => a.id.localeCompare(b.id))
    let nodes = res.nodes
    GLOBAL_FileCache = files
    GLOBAL_NodeCache = nodes

    let html = ''

    for(let file of files) {
        html += `<div class="file ${GLOBAL_ActiveFile == file.id ? 'active' : ''}" data-id="${file.id}">
            <div class="icon"><span class="material-icons">insert_drive_file</span></div>
            <div class="name">${escapeHtml(file.name)}</div>
            <div class="size">Size: ${beautifySize(file.info.meta.size)}</div>
            <div class="actions">
                <a href="#" class="action-del" data-id="${file.id}"><span class="material-icons">delete</span></a>
            </div>
        </div>`
    }
    if(!files.length) {
        html = '<i>No files found...</i>'
    }

    document.querySelector(".file-container").innerHTML = html
    document.querySelectorAll(".file-container .file").forEach(el => el.onclick = e => {
        e.preventDefault()
        let fileID = el.dataset.id

        let oldActive = document.querySelector(".file-container .file.active")
        if(oldActive) oldActive.classList.remove("active")

        el.classList.add("active")

        fillFilePanel(fileID)
        updatePanel('file')
    })
    document.querySelectorAll(".file-container .action-del").forEach(el => el.onclick = async e => {
        e.preventDefault()
        let fileID = el.dataset.id

        let confirm = await Swal.fire({
            title: 'Delete?',
            icon: 'warning',
            text: "Are you sure you want to delete this file?",
            showCancelButton: true, confirmButtonText: 'Delete', denyButtonText: `Cancel`
        })
        if(!confirm.value) return

        actionDelFile(fileID)

    })

    fillFilePanel()

    document.querySelector(".loading-inforer").style.display = "none"
}

let fillFilePanel = function(fileID = null) {
    if(fileID == null) fileID = GLOBAL_ActiveFile
    else GLOBAL_ActiveFile = fileID

    if(!fileID) return

    let fileData = GLOBAL_FileCache.filter(x => x.id == fileID)[0]
    let panel = document.querySelector(".screen-file")

    panel.querySelector(".name").innerHTML = fileData.name
    panel.querySelector(".id").innerHTML = `ID: ${fileData.id}`
    panel.querySelector(".size").innerHTML = beautifySize(fileData.info.meta.size)
    panel.querySelector(".date-added").innerHTML = (new Date(fileData.info.dateAdded)).toString().split("GMT")[0]

    panel.querySelector(".replica-list").innerHTML = fileData.nodes.map(x => `<span class="replica-entry">${x.substr(4)}</span>`).join('')
}

let updatePanel = function(mode) {
    if(mode == 'upload') {
        GLOBAL_ActiveFile = null
        document.querySelector(".screens .screen-upload").style.display = 'block'
        document.querySelector(".screens .screen-file").style.display = 'none'
    }
    else if(mode == 'file') {
        document.querySelector(".screens .screen-upload").style.display = 'none'
        document.querySelector(".screens .screen-file").style.display = 'block'
    }
}


document.addEventListener("DOMContentLoaded", function(e) {
    if(!document.querySelector("body").classList.contains("files")) return

    document.querySelector(".action-upload-file").onclick = function(e) {
        e.preventDefault()
        actionAddFile();
    }
    document.querySelector(".btn.upload-btn").onclick = function(e) {
        e.preventDefault()
        updatePanel('upload')
    }
    document.querySelector(".btn.refresh-btn").onclick = function(e) {
        e.preventDefault()
        updateFileList()
    }

    updateFileList()
})
