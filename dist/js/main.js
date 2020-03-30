let prizes = []
let medallions = []

let itemGrid = []
let itemLayout = []
let showchests = true
let showprizes = true
let showmedals = true

let editmode = false
let selected = {}

function setCookie(obj) {
    let d = new Date()
    d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000))
    let expires = "expires=" + d.toUTCString()
    let val = JSON.stringify(obj)
    document.cookie = "key=" + val + ";" + expires + ";path=/"
}

function getCookie() {
    let name = "key="
    let ca = document.cookie.split(';')
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i]
        while (c.charAt(0) == ' ') {
            c = c.substring(1)
        }
        if (c.indexOf(name) == 0) {
            return JSON.parse(c.substring(name.length, c.length))
        }
    }
    return {}
}

let cookiekeys = ['map', 'iZoom', 'mZoom', 'mOrien', 'mPos', 'chest', 'prize', 'medal', 'items']
let cookieDefault = {
    map: 1,
    iZoom: 100,
    mZoom: 51,
    mOrien: 0,
    mPos: 0,
    chest: 1,
    prize: 1,
    medal: 1,
    items: defaultItemGrid
}

let cookielock = false

function loadCookie() {
    if (cookielock) {
        return
    }
    cookielock = true

    cookieobj = getCookie()

    cookiekeys.forEach(function (key) {
        if (cookieobj[key] === undefined) {
            cookieobj[key] = cookieDefault[key]
        }
    })

    initGridRow(JSON.parse(JSON.stringify(cookieobj.items)))

    document.getElementsByName('showmap')[0].checked = !!cookieobj.map
    document.getElementsByName('showmap')[0].onchange()

    document.getElementsByName('maporientation')[cookieobj.mOrien].click()
    document.getElementsByName('mapposition')[cookieobj.mPos].click()

    document.getElementsByName('showchest')[0].checked = !!cookieobj.chest
    document.getElementsByName('showchest')[0].onchange()
    document.getElementsByName('showcrystal')[0].checked = !!cookieobj.prize
    document.getElementsByName('showcrystal')[0].onchange()
    document.getElementsByName('showmedallion')[0].checked = !!cookieobj.medal
    document.getElementsByName('showmedallion')[0].onchange()

    cookielock = false
}

function saveCookie() {
    if (cookielock) {
        return
    }
    cookielock = true

    cookieobj = {}

    cookieobj.map = document.getElementsByName('showmap')[0].checked ? 1 : 0
    cookieobj.iZoom = document.getElementsByName('itemdivsize')[0].value
    cookieobj.mZoom = document.getElementsByName('mapdivsize')[0].value


    cookieobj.mOrien = document.getElementsByName('maporientation')[1].checked ? 1 : 0
    cookieobj.mPos = document.getElementsByName('mapposition')[1].checked ? 1 : 0


    cookieobj.chest = document.getElementsByName('showchest')[0].checked ? 1 : 0
    cookieobj.prize = document.getElementsByName('showcrystal')[0].checked ? 1 : 0
    cookieobj.medal = document.getElementsByName('showmedallion')[0].checked ? 1 : 0

    cookieobj.items = JSON.parse(JSON.stringify(itemLayout))

    setCookie(cookieobj)

    cookielock = false
}

// Event of clicking a chest on the map
function toggleChest(x) {
    chests[x].isOpened = !chests[x].isOpened
    if (chests[x].isOpened) {
        document.getElementById(x).className = "mapspan chest opened"
    } else {
        document.getElementById(x).className = "mapspan chest " + chests[x].isAvailable()
    }
}

// Highlights a chest location and shows the name as caption
function highlight(x) {
    document.getElementById(x).style.backgroundImage = "url(/dist/img/highlighted.png)"
    document.getElementById("caption").innerHTML = chests[x].name
}

function unhighlight(x) {
    document.getElementById(x).style.backgroundImage = "url(/dist/img/poi.png)"
    document.getElementById("caption").innerHTML = "&nbsp;"
}

// Highlights a chest location and shows the name as caption (but for dungeons)
function highlightDungeon(x) {
    document.getElementById("dungeon" + x).style.backgroundImage = "url(/dist/img/highlighted.png)"
    document.getElementById("caption").innerHTML = dungeons[x].name
}

function unhighlightDungeon(x) {
    document.getElementById("dungeon" + x).style.backgroundImage = "url(/dist/img/poi.png)"
    document.getElementById("caption").innerHTML = "&nbsp;"
}

function showChest(sender) {
    showchests = sender.checked
    updateGridItemAll()
    saveCookie()
}

function showCrystal(sender) {
    showprizes = sender.checked
    updateGridItemAll()
    saveCookie()
}

function showMedallion(sender) {
    showmedals = sender.checked
    updateGridItemAll()
    saveCookie()
}

function setOrder(H) {
    if (H) {
        document.getElementById('layoutdiv')
            .classList
            .remove('flexcontainer')
    } else {
        document.getElementById('layoutdiv')
            .classList
            .add('flexcontainer')
    }
    saveCookie()
}

function setOrientation() {

}

let prevH = false

function setMapOrientation(H) {
    if (H == prevH) {
        return
    }
    prevH = H


    let chest = document.getElementsByClassName("mapspan")
    let i

    if (H) {
        document.getElementById("mapdiv")
            .classList
            .remove('mapdiv')
        document.getElementById("mapdiv")
            .classList
            .add('mapvdiv')
        for (i = 0; i < chest.length; i++) {
            let x = parseFloat(chest[i].style.left) / 100
            let y = parseFloat(chest[i].style.top) / 100

            if (x > 0.5) {
                chest[i].style.left = (((x - 0.5) * 2) * 100) + '%'
                chest[i].style.top = (((y / 2) + 0.5) * 100) + '%'
            } else {
                chest[i].style.left = ((x * 2) * 100) + '%'
                chest[i].style.top = ((y / 2) * 100) + '%'
            }
        }
    } else {
        document.getElementById("mapdiv")
            .classList
            .add('mapdiv')
        document.getElementById("mapdiv")
            .classList
            .remove('mapvdiv')
        for (i = 0; i < chest.length; i++) {
            let x = parseFloat(chest[i].style.left) / 100
            let y = parseFloat(chest[i].style.top) / 100

            if (y > 0.5) {
                chest[i].style.left = (((x / 2) + 0.5) * 100) + '%'
                chest[i].style.top = (((y - 0.5) * 2) * 100) + '%'
            } else {
                chest[i].style.left = ((x / 2) * 100) + '%'
                chest[i].style.top = ((y * 2) * 100) + '%'
            }
        }
    }
    saveCookie()
}

function showSettings(sender) {
    if (editmode) {
        let r, c
        let startdraw = false
        for (r = 7; r >= 0 && !startdraw; r--) {
            if (!itemLayout[r] || !itemLayout[r].length) {
                itemGrid[r]['row'].style.display = 'none'
            } else {
                for (c = 0; c < 8; c++) {
                    if (!!itemLayout[r][c] && itemLayout[r][c] != 'blank') {
                        startdraw = true
                        r++
                        break
                    }
                }

                if (!startdraw) {
                    itemGrid[r]['row'].style.display = 'none'
                    itemGrid[r]['half'].style.display = 'none'
                }
            }
        }

        for (; r >= 0; r--) {
            itemGrid[r]['row'].style.display = ''
            itemGrid[r]['button'].style.display = 'none'
        }

        showchests = document.getElementsByName('showchest')[0].checked
        showprizes = document.getElementsByName('showcrystal')[0].checked
        showmedals = document.getElementsByName('showmedallion')[0].checked
        editmode = false
        updateGridItemAll()
        showTracker('mapdiv', document.getElementsByName('showmap')[0])
        document.getElementById('itemconfig').style.display = 'none'

        sender.innerHTML = '🔧'
        saveCookie()
    } else {
        let x = document.getElementById("settings")
        if (!x.style.display || x.style.display == 'none') {
            x.style.display = 'initial'
            sender.innerHTML = 'X'
        } else {
            x.style.display = 'none'
            sender.innerHTML = '🔧'
        }
    }
}

function showTracker(target, sender) {
    if (sender.checked) {
        document.getElementById(target).style.display = ''
    } else {
        document.getElementById(target).style.display = 'none'
    }
}

function clickRowButton(row) {
    if (itemLayout[row].length % 2 == 0) {
        itemGrid[row]['button'].innerHTML = '-'
        itemGrid[row]['button'].style.backgroundColor = 'red'
        itemGrid[row][6]['item'].style.display = ''
        itemGrid[row]['half'].style.display = 'none'
        itemLayout[row][6] = 'blank'
    } else {
        itemGrid[row]['button'].innerHTML = '+'
        itemGrid[row]['button'].style.backgroundColor = 'green'
        itemGrid[row][6]['item'].style.display = 'none'
        itemGrid[row]['half'].style.display = ''
        document.getElementById(itemLayout[row][6]).style.opacity = 1
        itemLayout[row].splice(-1, 1)
    }
    updateGridItem(row, 6)
}


function EditMode() {
    let r, c

    for (r = 0; r < 8; r++) {
        itemGrid[r]['row'].style.display = ''
        itemGrid[r]['button'].style.display = ''
    }

    showchests = false
    showprizes = false
    showmedals = false
    updateGridItemAll()
    editmode = true
    updateGridItemAll()
    showTracker('mapdiv', {checked: false})
    document.getElementById('settings').style.display = 'none'
    document.getElementById('itemconfig').style.display = ''

    document.getElementById('settingsbutton').innerHTML = 'Exit Edit Mode'
}


function createItemTracker(sender) {
    let r
    for (r = 0; r < 8; r++) {
        itemGrid[r] = []
        itemLayout[r] = []

        itemGrid[r]['row'] = document.createElement('table')
        itemGrid[r]['row'].className = 'tracker'
        sender.appendChild(itemGrid[r]['row'])

        let tr = document.createElement('tr')
        itemGrid[r]['row'].appendChild(tr)

        itemGrid[r]['half'] = document.createElement('td')
        itemGrid[r]['half'].className = 'halfcell'
        tr.appendChild(itemGrid[r]['half'])

        let i
        for (i = 0; i < 7; i++) {
            itemGrid[r][i] = []
            itemLayout[r][i] = 'blank'

            itemGrid[r][i]['item'] = document.createElement('td')
            itemGrid[r][i]['item'].className = 'griditem'
            tr.appendChild(itemGrid[r][i]['item'])

            let tdt = document.createElement('table')
            tdt.className = 'lonk'
            itemGrid[r][i]['item'].appendChild(tdt)

            let tdtr1 = document.createElement('tr')
            tdt.appendChild(tdtr1)
            itemGrid[r][i][0] = document.createElement('th')
            itemGrid[r][i][0].className = 'corner'
            itemGrid[r][i][0].onclick = new Function("gridItemClick(" + r + "," + i + ",0)")
            tdtr1.appendChild(itemGrid[r][i][0])
            itemGrid[r][i][1] = document.createElement('th')
            itemGrid[r][i][1].className = 'corner'
            itemGrid[r][i][1].onclick = new Function("gridItemClick(" + r + "," + i + ",1)")
            tdtr1.appendChild(itemGrid[r][i][1])
            let tdtr2 = document.createElement('tr')
            tdt.appendChild(tdtr2)
            itemGrid[r][i][2] = document.createElement('th')
            itemGrid[r][i][2].className = 'corner'
            itemGrid[r][i][2].onclick = new Function("gridItemClick(" + r + "," + i + ",2)")
            tdtr2.appendChild(itemGrid[r][i][2])
            itemGrid[r][i][3] = document.createElement('th')
            itemGrid[r][i][3].className = 'corner'
            itemGrid[r][i][3].onclick = new Function("gridItemClick(" + r + "," + i + ",3)")
            tdtr2.appendChild(itemGrid[r][i][3])
        }

        let half = document.createElement('td')
        half.className = 'halfcell'
        tr.appendChild(half)
        itemGrid[r]['button'] = document.createElement('button')
        itemGrid[r]['button'].innerHTML = '-'
        itemGrid[r]['button'].style.backgroundColor = 'red'
        itemGrid[r]['button'].style.color = 'white'
        itemGrid[r]['button'].onclick = new Function("clickRowButton(" + r + ")")

        half.appendChild(itemGrid[r]['button'])
    }
}

function updateGridItem(row, index) {
    let item = itemLayout[row][index]

    if (editmode) {
        if (!item || item == 'blank') {
            itemGrid[row][index]['item'].style.backgroundImage = ("url(/dist/img/blank.png)")
        } else if ((typeof items[item]) == "boolean") {
            itemGrid[row][index]['item'].style.backgroundImage = "url(/dist/img/" + item + ".png)"
        } else {
            itemGrid[row][index]['item'].style.backgroundImage = "url(/dist/img/" + item + itemsMax[item] + ".png)"
        }

        itemGrid[row][index]['item'].style.border = '1px solid white'
        itemGrid[row][index]['item'].style.opacity = 1

        return
    }

    itemGrid[row][index]['item'].style.border = '0px'
    itemGrid[row][index]['item'].style.opacity = ''

    if (!item || item == 'blank') {
        itemGrid[row][index]['item'].style.backgroundImage = ''
        return
    }

    if ((typeof items[item]) == "boolean") {
        itemGrid[row][index]['item'].style.backgroundImage = "url(/dist/img/" + item + ".png)"
    } else {
        itemGrid[row][index]['item'].style.backgroundImage = "url(/dist/img/" + item + items[item] + ".png)"
    }

    itemGrid[row][index]['item'].className = "griditem " + (!!items[item])

    if (item.substring(0, 4) == "boss") {
        let d = item.substring(4, 5)

        if (showchests) {
            itemGrid[row][index][2].style.backgroundImage = "url(/dist/img/chest" + dungeonchests[d] + ".png)"
        } else {
            itemGrid[row][index][2].style.backgroundImage = ''
        }

        if (showprizes) {
            itemGrid[row][index][3].style.backgroundImage = "url(/dist/img/dungeon" + prizes[d] + ".png)"
        } else {
            itemGrid[row][index][3].style.backgroundImage = ''
        }

        if (showmedals && d >= 8) {
            itemGrid[row][index][1].style.backgroundImage = "url(/dist/img/medallion" + medallions[d] + ".png)"
        } else {
            itemGrid[row][index][1].style.backgroundImage = ''
        }
    }
}

function updateGridItemAll() {
    for (r = 0; r < 8; r++) {
        for (c = 0; c < 7; c++) {
            updateGridItem(r, c)
        }
    }
}

function setGridItem(item, row, index) {
    itemLayout[row][index] = item
    if (item != 'blank') {
        document.getElementById(item).style.opacity = "0.25"
    }
    updateGridItem(row, index)
}

function initGridRow(itemsets) {
    prizes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    medallions = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    let r, c
    let startdraw = false
    for (r = 7; r >= 0 && !startdraw; r--) {
        if (!itemsets[r] || !itemsets[r].length) {
            itemGrid[r]['row'].style.display = 'none'
            itemGrid[r]['half'].style.display = 'none'
        } else {
            for (c = 0; c < 8; c++) {
                if (!!itemsets[r][c] && itemsets[r][c] != 'blank') {
                    startdraw = true
                    r++
                    break
                }
            }

            if (!startdraw) {
                itemGrid[r]['row'].style.display = 'none'
                itemGrid[r]['half'].style.display = 'none'
            }
        }
    }

    for (; r >= 0; r--) {
        itemGrid[r]['row'].style.display = ''

        if (itemsets[r].length % 2 != 0) {
            itemGrid[r]['half'].style.display = 'none'
            itemGrid[r][6]['item'].style.display = ''
        } else {
            clickRowButton(r)
        }
        itemGrid[r]['button'].style.display = 'none'

        for (c = 0; c < 7; c++) {
            if (itemsets[r][c]) {
                setGridItem(itemsets[r][c], r, c)
            }
        }
    }
}

function gridItemClick(row, col, corner) {
    if (editmode) {
        if (selected.item) {
            document.getElementById(selected.item).style.border = '1px solid white'
            let old = itemLayout[row][col]

            if (old == selected.item) {
                selected = {}
                return
            }

            if (selected.item != 'blank') {
                document.getElementById(selected.item).style.opacity = "0.25"

                let r, c
                let found = false
                for (r = 0; r < 8; r++) {
                    for (c = 0; c < 7; c++) {
                        if (itemLayout[r][c] == selected.item) {
                            itemLayout[r][c] = 'blank'
                            found = true
                            break
                        }
                    }

                    if (found) {
                        break
                    }
                }
            }

            itemLayout[row][col] = selected.item
            updateGridItem(row, col)

            document.getElementById(old).style.opacity = "1"

            selected = {}
        } else if (selected.row !== undefined) {
            itemGrid[selected.row][selected.col]['item'].style.border = '1px solid white'

            let temp = itemLayout[row][col]
            itemLayout[row][col] = itemLayout[selected.row][selected.col]
            itemLayout[selected.row][selected.col] = temp
            updateGridItem(row, col)
            updateGridItem(selected.row, selected.col)

            selected = {}
        } else {
            itemGrid[row][col]['item'].style.border = '3px solid yellow'
            selected = {row: row, col: col}
        }
        return
    }

    let item = itemLayout[row][col]

    if (item.substring(0, 4) == "boss") {
        let d = item.substring(4, 5)

        if (corner == 1 && showmedals && d >= 8) {
            medallions[d]++
            if (medallions[d] == 4) {
                medallions[d] = 0
            }
            // Update availability of dungeon boss AND chests
            if (dungeons[d].isBeaten) {
                document.getElementById("bossMap" + d).className = "mapspan boss opened"
            } else {
                document.getElementById("bossMap" + d).className = "mapspan boss " + dungeons[d].isBeatable()
            }

            if (dungeonchests[d] > 0) {
                document.getElementById("dungeon" + d).className = "mapspan 1dungeon " + dungeons[d].canGetChest()
            }
            // TRock medallion affects Mimic Cave
            if (d == 9) {
                chests[4].isOpened = !chests[4].isOpened
                toggleChest(4)
            }
            // Change the mouseover text on the map
            let dungeonName
            if (d == 8) {
                dungeonName = "Misery Mire"
            } else {
                dungeonName = "Turtle Rock"
            }
            dungeons[d].name = dungeonName + " <img src='/dist/img/medallion" + medallions[d] + ".png' class='mini'><img src='/dist/img/lantern.png' class='mini'>"
        } else if (corner == 2 && showchests) {
            let chestitem = 'chest' + d
            dungeonchests[d]--
            if (dungeonchests[d] < 0) {
                dungeonchests[d] = itemsMax[chestitem]
            }

            if (dungeonchests[d] == 0) {
                document.getElementById("dungeon" + d).className = "mapspan dungeon opened"
            } else {
                document.getElementById("dungeon" + d).className = "mapspan dungeon " + dungeons[d].canGetChest()
            }
        } else if (corner == 3 && showprizes) {
            prizes[d]++
            if (prizes[d] == 5) {
                prizes[d] = 0
            }
            // Update Sahasralah, Fat Fairy, and Master Sword Pedestal
            let pendantChests = [25, 61, 62]
            for (k = 0; k < pendantChests.length; k++) {
                if (!chests[pendantChests[k]].isOpened) {
                    document.getElementById(pendantChests[k]).className = "mapspan chest " + chests[pendantChests[k]].isAvailable()
                }
            }
        } else {
            items[item]++
            if (items[item] > itemsMax[item]) {
                items[item] = itemsMin[item]
            }

            dungeons[d].isBeaten = !dungeons[d].isBeaten
            if (dungeons[d].isBeaten) {
                document.getElementById("bossMap" + d).className = "mapspan boss opened"
            } else {
                document.getElementById("bossMap" + d).className = "mapspan boss " + dungeons[d].isBeatable()
            }

        }
    } else if ((typeof items[item]) == "boolean") {
        items[item] = !items[item]
    } else {
        items[item]++
        if (items[item] > itemsMax[item]) {
            items[item] = itemsMin[item]
        }
    }

    for (k = 0; k < chests.length; k++) {
        if (!chests[k].isOpened) {
            document.getElementById(k).className = "mapspan chest " + chests[k].isAvailable()
        }
    }
    for (k = 0; k < dungeons.length; k++) {
        if (!dungeons[k].isBeaten) {
            document.getElementById("bossMap" + k).className = "mapspan boss " + dungeons[k].isBeatable()
        }
        if (dungeonchests[k]) {
            document.getElementById("dungeon" + k).className = "mapspan dungeon " + dungeons[k].canGetChest()
        }
    }

    updateGridItem(row, col)
}

function itemConfigClick(sender) {
    let item = sender.id

    if (selected.item) {
        document.getElementById(selected.item).style.border = '0px'
        sender.style.border = '3px solid yellow'
        selected = {item: item}
    } else if (selected.row !== undefined) {
        itemGrid[selected.row][selected.col]['item'].style.border = '1px solid white'
        let old = itemLayout[selected.row][selected.col]

        if (old == item) {
            selected = {}
            return
        }

        if (item != 'blank') {
            sender.style.opacity = "0.25"

            let r, c
            let found = false
            for (r = 0; r < 8; r++) {
                for (c = 0; c < 7; c++) {
                    if (itemLayout[r][c] == item) {
                        itemLayout[r][c] = 'blank'
                        updateGridItem(r, c)
                        found = true
                        break
                    }
                }

                if (found) {
                    break
                }
            }
        }

        itemLayout[selected.row][selected.col] = item
        updateGridItem(selected.row, selected.col)

        document.getElementById(old).style.opacity = "1"

        selected = {}
    } else {
        sender.style.border = '3px solid yellow'
        selected = {item: item}
    }
}

function populateMapdiv() {
    let mapdiv = document.getElementById('mapdiv')

    // Initialize all chests on the map
    for (k = 0; k < chests.length; k++) {
        let s = document.createElement('span')
        s.style.backgroundImage = 'url(/dist/img/poi.png)'
        s.style.color = 'black'
        s.id = k
        s.onclick = new Function('toggleChest(' + k + ')')
        s.onmouseover = new Function('highlight(' + k + ')')
        s.onmouseout = new Function('unhighlight(' + k + ')')
        s.style.left = chests[k].x
        s.style.top = chests[k].y
        if (chests[k].isOpened) {
            s.className = "mapspan chest opened"
        } else {
            s.className = "mapspan chest " + chests[k].isAvailable()
        }
        mapdiv.appendChild(s)
    }

    // Dungeon bosses & chests
    for (k = 0; k < dungeons.length; k++) {
        let s = document.createElement('span')
        s.style.backgroundImage = 'url(/dist/img/' + dungeons[k].image + ')'
        s.id = 'bossMap' + k
        s.onmouseover = new Function('highlightDungeon(' + k + ')')
        s.onmouseout = new Function('unhighlightDungeon(' + k + ')')
        s.style.left = dungeons[k].x
        s.style.top = dungeons[k].y
        s.className = "mapspan boss " + dungeons[k].isBeatable()
        mapdiv.appendChild(s)

        s = document.createElement('span')
        s.style.backgroundImage = 'url(/dist/img/poi.png)'
        s.id = 'dungeon' + k
        s.onmouseover = new Function('highlightDungeon(' + k + ')')
        s.onmouseout = new Function('unhighlightDungeon(' + k + ')')
        s.style.left = dungeons[k].x
        s.style.top = dungeons[k].y
        s.className = "mapspan dungeon " + dungeons[k].canGetChest()
        mapdiv.appendChild(s)
    }
}

function populateItemconfig() {
    let grid = document.getElementById('itemconfig')

    let i = 0

    let row

    for (let key in items) {
        if (i % 10 == 0) {
            row = document.createElement('tr')
            grid.appendChild(row)
        }
        i++

        let rowitem = document.createElement('td')
        rowitem.className = 'corner'
        rowitem.id = key
        rowitem.style.backgroundSize = '100% 100%'
        rowitem.onclick = new Function('itemConfigClick(this)')
        if ((typeof items[key]) == "boolean") {
            rowitem.style.backgroundImage = "url(/dist/img/" + key + ".png)"
        } else {
            rowitem.style.backgroundImage = "url(/dist/img/" + key + itemsMax[key] + ".png)"
        }
        row.appendChild(rowitem)
    }
}

function init() {
    createItemTracker(document.getElementById('itemdiv'))
    populateMapdiv()
    populateItemconfig()

    loadCookie()
    saveCookie()
}
