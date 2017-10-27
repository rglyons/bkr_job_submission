const Promise = require('bluebird');
var exec = require('child_process').exec, child;
const fs = require('fs');

module.exports = {

  executeJob (req, res) {
    // assemble command string
    let test = req.body.test.split('/')[req.body.test.split('/').length-1]
    let cmd = 'bkr workflow-simple --username='+req.body.user+' --password=beaker \
    --family='+req.body.family+'  --distro="'+req.body.distro+'" \
    --hostrequire=pool='+req.body.pool+' \
    --kernel-options="ip=enP6p1s0:dhcp ifname=enP6p1s0:A0:36:9F:D7:73:BD cma=1024M" \
    --ks-meta="clearpart=--initlabel --all zerombr ignoredisk=--only-use=/dev/disk/by-path/platform-APMC0D33:01-ata-1.0" \
    --kernel-options-post="iommu.passthrough=0" \
    --whiteboard=pool_'+req.body.pool+'_'+req.body.distro.replace(/\s/g, '_')+'_'+test+' \
    --task='+req.body.test
    // execute command and collect output
    let p = new Promise(function (resolve, reject) {
      child = exec(cmd,
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
      output.jobId = output.stdout.split('\'')[1].split(':')[1]
      // write the job cfg file
      let kpLine = (req.body.patch) ? 'OS_KERNEL_PATCH: ' + req.body.patch + '\n' : ''
      fs.writeFile(
        '/var/www/html/bkrjobcfg/bkrjobcfg' + output.jobId,
        'OS_PREREQ: ' + req.body.distro + '\n' + kpLine,
        (err) => {
          if (err) throw err;
          console.log('New Beaker job config file has been saved!');
        }
      )
      res.status(200).send(output)
    })
    .catch(error => {
      console.log(error)
      res.status(400).send(error)
    })
  }

}
