const express = require('express')
const bodyParser = require('body-parser')
const logger = require('./server/logger')
const morgan = require('morgan')
const app = express()

// Parse incoming requests data (https://github.com/expressjs/body-parser)
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.use('/static', express.static(__dirname + '/static'))
app.use('/node_modules', express.static(__dirname + '/node_modules'))

// app logging
logger.debug("Overriding 'Express' logger");
app.use(morgan('dev', {
  'stream': logger.stream
}))

app.get('/', function (req, res) {
  // res.sendFile(__dirname + '/webpage/src/index.html')
  res.sendFile(__dirname + '/index.html')
})

// Require our other routes into the application.
require('./server/routes')(app)

app.listen(3030, function () {
  logger.info('Beaker Job Submission application listening on port 3030')
})
