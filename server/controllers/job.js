const Promise = require('bluebird');
var exec = require('child_process').exec, child;
const fs = require('fs');
const logger = require('../logger');

module.exports = {

  executeJob (req, res) {
    // handle varying parts of cmd line
    let cmd_system = (req.body.system.includes('rack')) ? '--machine='+req.body.system : '--hostrequire=pool='+req.body.system
    if (req.body.system.includes('rack')) {
      // build system element of the whiteboard (R<rack no.>-<board no.>_<serial no.>)
      let i = req.body.system.indexOf('rack')
      var wb_system = 'R' + req.body.system.substring(i+4, i+7) + '-'   // rack number
      let temp = req.body.system.split('-')[0]
      temp = temp.substring(temp.length-2, temp.length) // board number (01-08)
      wb_system += temp + '_'
      let start_i = req.body.system.indexOf('-') + 1
      let end_i = req.body.system.indexOf('.rack')
      wb_system += req.body.system.substring(start_i, end_i)   // serial number
    } else {
      var wb_system = req.body.system   // otherwise, just use the pool name
    }
    let wb_test = req.body.test.split('/')[req.body.test.split('/').length-1]
    let wb_distro = req.body.distro.replace(/\s/g, '_')
    let wb_patch = (req.body.patch) ? 'krnlupgrade_' + req.body.patch.substring(0, req.body.patch.indexOf('.ilp')) + '_' : ''
    let wb_fw = (req.body.firmware.smpmpro) ? 'fwupgrade_' : ''
    // build command line for execution
    let cmd = 'bkr workflow-simple --username='+req.body.user+' --password=beaker \
    --arch=aarch64 --family='+req.body.family+'  --distro="'+req.body.distro+'" \
    ' + cmd_system + ' \
    --whiteboard='+wb_system+'_'+wb_fw+wb_distro+'_'+wb_patch+wb_test+' \
    --task='+req.body.test
    logger.info('Executing Beaker command: ' + cmd)
    // execute command and collect output
    let p = new Promise(function (resolve, reject) {
      child = exec(cmd,
        function (error, stdout, stderr) {
          var out = stdout
          var err = stderr
          if (error !== null) {
               logger.info('exec error: ' + error);
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
      logger.info('stdout: ' + output.stdout);
      logger.info('stderr: ' + output.stderr);
      output.jobId = output.stdout.split('\'')[1].split(':')[1]
      // write the job cfg file
      let kpLine = (req.body.patch) ? 'OS_KERNEL_PATCH: ' + req.body.patch + '\n' : 'OS_KERNEL_PATCH:\n'
      let smpLine = (req.body.firmware.smpmpro) ? 'FIRMWARE_SMPMPRO: ' + req.body.firmware.smpmpro + '\n' : 'FIRMWARE_SMPMPRO:\n'
      let aptLine = (req.body.firmware.aptio) ? 'FIRMWARE_APTIO: ' + req.body.firmware.aptio + '\n' : 'FIRMWARE_APTIO:\n'
      let bmcLine = (req.body.firmware.bmc) ? 'FIRMWARE_BMC: ' + req.body.firmware.bmc + '\n' : 'FIRMWARE_BMC:\n'
      fs.writeFile(
        '/var/www/html/bkrjobcfg/bkrjobcfg' + output.jobId,
        'OS_PREREQ: ' + req.body.distro + '\n' + kpLine + smpLine + aptLine + bmcLine,
        (err) => {
          if (err) throw err;
          logger.info('New Beaker job config file has been saved!');
        }
      )
      res.status(200).send(output)
    })
    .catch(error => {
      logger.error(error)
      res.status(400).send(error)
    })
  }

}
