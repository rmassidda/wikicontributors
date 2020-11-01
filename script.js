const encodeGetParams = p => Object.entries(p).map(kv => kv.map(encodeURIComponent).join("=")).join("&");
const base_url = 'https://it.wikipedia.org/w/api.php?'
const count_edits = (arr, val) => arr.reduce((a, v) => (v === val ? a + 1 : a), 0)

// Global state
var state = {}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function get_revisions(r){
  let tmp = r["query"]["pages"]
  k = Object.keys(tmp)[0]
  return tmp[k]["revisions"]
}

async function retrieve_history(title) {
  // Initial parameters for the API query
  var params = {
    action: 'query',
    continue: '',
    format: 'json',
    prop: 'revisions',
    rvlimit: 'max',
    rvprop: 'timestamp|user',
    origin: '*',
    titles: title
  }

  // Multiple requests may be needed
  let stop = false

  // Accumulate the results
  total = []
  while (!stop) {
    // Get the JSON file from the API
    let url = base_url + encodeGetParams(params)
    console.log('API url:',url)
    let response = await fetch(url)
    if (response.ok) {
      response = await response.json();
    } else {
      alert("HTTP-Error: " + response.status);
    }

    // Extract data and accumulate
    revs    = get_revisions(response)
    total   = total.concat(revs)

    // Eventually do another call
    if (Object.keys(response).includes("continue")) {
      params["continue"]   = response["continue"]["continue"]
      params["rvcontinue"] = response["continue"]["rvcontinue"]
    }
    else{
      stop = true;
    }

    // Be nice!
    await sleep(150)
  }
  return total
}

async function edits_per_user(title){
  var count   = {}
  epu = await retrieve_history(title)
  if (epu[0] == undefined){
    return count
  }
  epu     = epu.map(e => e["user"])
  uniq    = Array.from(new Set(epu))
  for (user of uniq){
    count[user] = count_edits(epu, user)
  }
  return count
}

function update_view(titles){
  // Select the table
  thead = document.getElementById("table_header")
  thead.innerHTML = ""

  // Username
  var node = document.createElement("th")
  var txt  = document.createTextNode("Utente")
  node.appendChild(txt)
  node["scope"] = "col"
  thead.appendChild(node)

  // Titles
  for (k of titles){
    var node = document.createElement("th")
    var txt  = document.createTextNode(k)
    node.appendChild(txt)
    node["scope"] = "col"
    thead.appendChild(node)
  }

  // Sum
  var node = document.createElement("th")
  var txt  = document.createTextNode("Somma")
  node.appendChild(txt)
  node["scope"] = "col"
  thead.appendChild(node)

  // Get unique users list
  users = []
  for (k of titles) {
    users = users.concat(Object.keys(state[k]))
  }
  users = new Set(users)
  users = Array.from(users)

  // Aggregate
  let agg = u => {
    return titles.map(k => (state[k][u]!=undefined)?state[k][u]:0)
  }

  // Prioritize users with multiple pages
  let cnz = e => e.length - e.filter(a=>a!=0).length
  let product = (a,b) => a*b
  let notzero = (e) => e != 0
  let nzp = e => agg(e).filter(notzero).reduce(product,1)
  users.sort((a,b) => {
    return (nzp(a)!=nzp(b)?nzp(b)-nzp(a):cnz(agg(a))-cnz(agg(b)))
  })

  // Plain sum
  // users.sort((a,b) => {
  //   let sum = (x,y) => x+y
  //   return - (agg(a).reduce(sum,0) - agg(b).reduce(sum,0))
  // })

  // Insert data
  tbody = document.getElementById("table_body")
  tbody.innerHTML = ""
  for (i in users){
    let u = users[i]
    // Row
    row = document.createElement("tr")  

    // Username
    th = document.createElement("th")
    th["scope"] = "row"
    th.appendChild(document.createTextNode(u))
    row.appendChild(th)

    // Counters
    for (k of titles){
      td = document.createElement("td")
      td.appendChild(document.createTextNode((state[k][u]!=undefined)?state[k][u]:0))
      row.appendChild(td)
    }

    // Sum
    td = document.createElement("td")
    td.appendChild(document.createTextNode(agg(u).reduce((a,b)=>a+b,0)))
    row.appendChild(td)

    // Append row
    tbody.appendChild(row)
  }
}

function notify_loading(title){
  // Select the table
  thead = document.getElementById("table_header")

  // Username
  var node = document.createElement("th")
  node["scope"] = "col"
  node.innerHTML = `
  <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
  <span class="sr-only">Loading...</span>`+title
  thead.appendChild(node)
}

async function update_state(e){

  titles = document.getElementById("titles").value.split(",")
  titles = titles.filter(e => e!="") // Remove empty
  titles = titles.map(e => (e[0]==" ")?e.slice(1):e) // Remove starting space
  for (title of titles){

    // Check if the object has already been downloaded
    if (Object.keys(state).indexOf(title) > -1){
      console.log(title,"already cached.")
    }
    else{
      notify_loading(title)
      edits = await edits_per_user(title)
      // Check if there is at least one result
      if (Object.keys(edits).length == 0){
        console.log(title,"no results.")
      }
      else{
        state[title] = edits
        console.log(title,"cached.")
      }
    }

    update_view(titles.filter(e=>state[e]!=undefined))
  }
}

function switchDescription() {
  var toggleDesc = document.getElementById("toggle-description");
   if (toggleDesc.checked) {
    toggleDesc.checked = false;
  }
}

function showTable() {
  document.getElementById("main_body").style.display = "block";
}

// Event listeners
document.getElementById("launch").addEventListener("click", update_state)
document.getElementById("launch").addEventListener("click", switchDescription)
document.getElementById("launch").addEventListener("click", showTable)
document.getElementById("titles").addEventListener("keyup", function(event) {
  if (event.keyCode === 13) {
    event.preventDefault();
    document.getElementById("launch").click();
  }
});
