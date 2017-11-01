const Promise = require('bluebird');
const mysql = require('mysql');
const fs = require('fs');

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


module.exports = {

  getLabData (req, res) {
    let pool = initConnectionPool(5)
    var promises = [
      // get users
      execAsyncQuery(pool, 'SELECT user_name as username, display_name as name from tg_user \
                            WHERE user_name NOT LIKE \'beaker-controller-rack%\' \
                            AND removed IS NULL'),
      // get distros and distro families (present on a lab controller)
      execAsyncQuery(pool, 'SELECT DISTINCT OS.osmajor, D.name as distro from \
                            distro D join distro_tree DT on D.id=DT.distro_id \
                            join distro_tree_lab_controller_map DM on DT.id=DM.distro_tree_id \
                            join osversion O on D.osversion_id=O.id \
                            join osmajor OS on O.osmajor_id=OS.id'),
      // get available system pools
      execAsyncQuery(pool, 'SELECT name FROM system_pool'),
      // get all tasks that can be executed
      execAsyncQuery(pool, 'SELECT name FROM task WHERE valid = 1'),
      // get non-removed systems
      execAsyncQuery(pool, 'SELECT fqdn FROM system WHERE status != \'Removed\''),
    ]
    return Promise.all(promises)
      .then(queryData => {
        teardownConnectionPool(pool)
        // format user data
        queryData[0].map(function (u) {
          u.full = u.username + ' <' + u.name + '>'
        })
        queryData[0].sort(function (u1, u2) {
          var A = u1.username.toLowerCase();
          var B = u2.username.toLowerCase();
          return (A < B) ? -1 : (A > B) ? 1 : 0;
        })
        // format distro data
        let distros_temp = {}
        let distros = []
        for (let i of queryData[1]) {
          if (!distros_temp[i.osmajor]) distros_temp[i.osmajor] = {name: i.osmajor, versions: [i.distro]}
          else distros_temp[i.osmajor].versions.push(i.distro)
        }
        for (let prop in distros_temp) {
          distros.push(distros_temp[prop])
        }
        //format task data
        let tests_temp = {}
        let tests = []
        for (let i of queryData[3]) {
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
        // get the APM linux versions on the local drive
        let files = fs.readdirSync('/var/www/html/apm/kernelpatch')
        let patches = []
        files.forEach(file => {
          patches.push({
            name: file
          })
        })
        // get firmware files
        files = fs.readdirSync('/var/www/html/apm/firmware')
        var firmware = { smpmpro: [], aptio: [], bmc: [] }
        files.forEach(file => {
          if (file.includes('smpmpro')) firmware.smpmpro.push({name: file})
          else if (file.includes('atfbios')) firmware.aptio.push({name: file})
          else if (file.includes('ast2500')) firmware.bmc.push({name: file})
        })
        // compile resulting data object
        let result = {
          users: queryData[0],
          distros: distros,
          pools: queryData[2],
          tests: tests,
          patches: patches,
          firmware: firmware
        }
        // allow CORS for speedy development
        return res.status(200).send(result)
      })
      .catch(error => {
        if (error.message == 'FS READDIR ERROR') {
          res.status(400).send({
            message: 'Error in reading server filesystem'
          });
        } else {
          console.log(error)
          res.status(400).send(error)
        }
      })
    }
}
