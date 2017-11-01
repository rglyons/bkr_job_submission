const Promise = require('bluebird');
const mysql = require('mysql');
const fs = require('fs');


/*
* Establish & control a DB connection
*/
function initConnectionPool(nConn) {
  console.log("Creating new connection pool instance with "
              + nConn + " connection(s)...");
  var pool  = mysql.createPool({
    connectionLimit : nConn,
    host: '10.76.135.5',
    user: 'root',
    password: 'amcc1234',
    database: 'beaker'
  });
  // pool status logging
  pool.on('acquire', function (connection) {
    console.log('Connection %d acquired', connection.threadId);
  });
  pool.on('release', function (connection) {
    console.log('Connection %d released', connection.threadId);
  });
  return pool
}

function teardownConnectionPool(pool) {
  // close all connections in the pool
  pool.end(function (err) {
    if (err) {
      console.log('POOL END ERROR: ' + err.message);
    }
    console.log('all pool connections have ended.');
  })
}

/*
* Execute an asynchronous query
* by wrapping it in a Promise
*/
function execAsyncQuery(pool, query) {
  return new Promise(function (resolve, reject) {
    pool.getConnection(function (err, connection) {
      if (err) {
        console.log("POOL GET CONNECTION ERROR: " + err.message);
        reject(err);
      } else {
        //resolve(connection);
        console.log('time to query')
        connection.query(
          {
            sql: query,
            timeout: 20000, //20s
          },
          function (err, results, fields) {
            connection.release();   // release DB connection back to the pool
            if (err) {
              console.log("QUERY ERROR: " + err.message);
              reject(err)
            } else {
              //console.log('QUERY RESULTS: ' + results)
              resolve(results)
            }
          });
      }
    })
  })
}

/*
* Execute queries on the DB
* and format the return to be
* usable in the front end
*/
function getUsers (pool) {
  return execAsyncQuery(pool,
    'SELECT user_name as username, display_name as name from tg_user \
    WHERE user_name NOT LIKE \'beaker-controller-rack%\' \
    AND removed IS NULL')
  .then(queryData => {
    // format user data
    queryData.map(function (u) {
      u.full = u.username + ' <' + u.name + '>'
    })
    queryData.sort(function (u1, u2) {
      var A = u1.username.toLowerCase();
      var B = u2.username.toLowerCase();
      return (A < B) ? -1 : (A > B) ? 1 : 0;
    })
    return queryData
  })
  .catch(error => {
    console.log(error)
    return error
  })
}

function getDistros (pool) {
  // get distros and distro families (present on a lab controller)
  return execAsyncQuery(pool,
    'SELECT DISTINCT OS.osmajor, D.name as distro from \
    distro D join distro_tree DT on D.id=DT.distro_id \
    join distro_tree_lab_controller_map DM on DT.id=DM.distro_tree_id \
    join osversion O on D.osversion_id=O.id \
    join osmajor OS on O.osmajor_id=OS.id')
  .then(queryData => {
    // format distro data
    let distros_temp = {}
    let distros = []
    for (let i of queryData) {
      if (!distros_temp[i.osmajor]) distros_temp[i.osmajor] = {name: i.osmajor, versions: [i.distro]}
      else distros_temp[i.osmajor].versions.push(i.distro)
    }
    for (let prop in distros_temp) {
      distros.push(distros_temp[prop])
    }
    distros.sort(function(d1, d2) {
      var A = d1.name.toLowerCase();
      var B = d2.name.toLowerCase();
      return (A < B) ? -1 : (A > B) ? 1 : 0;
    })
    for (grp of distros) grp.versions.sort()
    return distros
  })
  .catch(error => {
    console.log(error)
    return error
  })
}

function getSystemPools (pool) {
  return execAsyncQuery(pool, 'SELECT name FROM system_pool')
  .catch(error => {
    console.log(error)
    return error
  })
}

function getTasks (pool) {
  return execAsyncQuery(pool, 'SELECT name FROM task WHERE valid = 1')
  .then(queryData => {
    //format task data
    let tests_temp = {}
    let tests = []
    for (let i of queryData) {
      let cat = i.name.split('/')[1]
      if (!tests_temp[cat]) tests_temp[cat] = {category: cat, tasks: [i.name]}
      else tests_temp[cat].tasks.push(i.name)
    }
    for (let prop in tests_temp) {
      tests.push(tests_temp[prop])
    }
    tests.sort(function(t1, t2) {
      var A = t1.category.toLowerCase();
      var B = t2.category.toLowerCase();
      return (A < B) ? -1 : (A > B) ? 1 : 0;
    })
    for (grp of tests) grp.tasks.sort()
    return tests
  })
  .catch(error => {
    console.log(error)
    return error
  })
}

function getSystems (pool) {
  return execAsyncQuery(pool, 'SELECT fqdn FROM system WHERE status != \'Removed\'')
  .then(queryData => {
    // format system data
    let sys_temp = {}
    let systems = []
    for (let i of queryData) {
      let j = i.fqdn.indexOf('rack')
      let rack = i.fqdn.substring(j, j+7)
      rack = rack.charAt(0).toUpperCase() + rack.slice(1, 4) + ' ' + rack.slice(4)
      if (!sys_temp[rack]) sys_temp[rack] = {rack: rack, boards: [i.fqdn]}
      else sys_temp[rack].boards.push(i.fqdn)
    }
    for (let prop in sys_temp) {
      systems.push(sys_temp[prop])
    }
    systems.sort(function(s1, s2) {
      var A = s1.rack.toLowerCase();
      var B = s2.rack.toLowerCase();
      return (A < B) ? -1 : (A > B) ? 1 : 0;
    })
    for (grp of systems) grp.boards.sort()
    return systems
  })
  .catch(error => {
    console.log(error)
    return error
  })
}

/*
* Read the local filesystem
* for kernel patches and firmware
* files
*/
function getKernelPatches () {
  return new Promise(function (resolve, reject) {
    // get the APM linux versions on the local drive
    fs.readdir('/var/www/html/apm/kernelpatch', (err, files) => {
      if (err) {
        console.log(err)
        reject(err)
      }
      let patches = []
      files.forEach(file => {
        patches.push({
          name: file
        })
      })
      patches.sort(function(p1, p2) {
        var A = p1.name.toLowerCase();
        var B = p2.name.toLowerCase();
        return (A < B) ? -1 : (A > B) ? 1 : 0;
      })
      resolve(patches)
    })
  })
}

function getFirmware () {
  return new Promise(function (resolve, reject) {
    fs.readdir('/var/www/html/apm/firmware', (err, files) => {
      if (err) {
        console.log(err)
        reject(err)
      }
      var firmware = { smpmpro: [], aptio: [], bmc: [] }
      files.forEach(file => {
        if (file.includes('smpmpro')) firmware.smpmpro.push({name: file})
        else if (file.includes('atfbios')) firmware.aptio.push({name: file})
        else if (file.includes('ast2500')) firmware.bmc.push({name: file})
      })
      firmware.smpmpro.sort(function(a, b) {
        var A = a.name.toLowerCase();
        var B = b.name.toLowerCase();
        return (A < B) ? -1 : (A > B) ? 1 : 0;
      })
      firmware.aptio.sort(function(a, b) {
        var A = a.name.toLowerCase();
        var B = b.name.toLowerCase();
        return (A < B) ? -1 : (A > B) ? 1 : 0;
      })
      firmware.bmc.sort(function(a, b) {
        var A = a.name.toLowerCase();
        var B = b.name.toLowerCase();
        return (A < B) ? -1 : (A > B) ? 1 : 0;
      })
      resolve(firmware)
    })
  })
}



module.exports = {

  getLabData (req, res) {
    let pool = initConnectionPool(5)
    var promises = [
      getUsers(pool),
      getDistros(pool),
      getSystemPools(pool),
      getTasks(pool),
      getSystems(pool),
      getKernelPatches(),
      getFirmware()
    ]
    return Promise.all(promises)
      .then(data => {
        teardownConnectionPool(pool)
        // compile resulting data object
        let result = {
          users: data[0],
          distros: data[1],
          pools: data[2],
          tests: data[3],
          systems: data[4],
          patches: data[5],
          firmware: data[6]
        }
        return res.status(200).send(result)
      })
      .catch(error => {
        console.log(error)
        res.status(400).send(error)
      })
    }
}
