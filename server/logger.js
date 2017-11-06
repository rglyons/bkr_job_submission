const winston = require("winston");

const logger = new winston.Logger({
  transports: [
    new winston.transports.File({
      level: 'info',
      filename: '/home/amcclab/Documents/job_submission/log/job_submission.log',
      handleExceptions: true,
      json: true,
      maxsize: 1*80*100000, // 100,000 lines of 80 characters
      maxFiles: 1,
      colorize: false,
      timestamp: function () {
        return (new Date()).toISOString();
      }
    }),
    new winston.transports.Console({
      level: 'debug',
      handleExceptions: true,
      json: false,
      colorize: true,
      timestamp: function () {
        return (new Date()).toISOString();
      }
    })
  ]
});

module.exports = logger
module.exports.stream = {
  write: function(message, encoding){
    logger.info(message);
  }
};
