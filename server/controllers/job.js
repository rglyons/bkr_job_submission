const Promise = require('bluebird');
var exec = require('child_process').exec, child;

module.exports = {

  executeJob (req, res) {
    console.log(req.body.command)
    // execute command and collect output
    let p = new Promise(function (resolve, reject) {
      child = exec(req.body.command,
        function (error, stdout, stderr) {
          var out = stdout
          var err = stderr
          if (error !== null) {
               console.log('exec error: ' + error);
               reject(error)
          }
          resolve({
            stdout: out,
            stderr: err
          })
        }
      );
    })
    .then(output => {
      console.log('stdout: ' + output.stdout);
      console.log('stderr: ' + output.stderr);
      res.status(200).send(output)
    })
    .catch(error => {
      console.log(error)
      res.status(400).send(error)
    })
  }

}
